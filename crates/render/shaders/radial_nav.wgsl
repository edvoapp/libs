const angle_width       = 0.000001;
const blur_radius       = 10.0;
const blurriness        = 1.41421356;
const boxshadow_opacity = 0.2;
const inner_ring_radius = 55.0;
const inner_ring_width  = 1.0;
const k_inv_pi          = 0.3183098861837697; // 1.0 / 3.141592
const min_radius        = 40.0;
const max_radius        = 100.0;
const pi                = 3.14159265359;
const tau               = 6.28318530718; // 2.0 * 3.14159265359
const offset            = vec2<f32>(20.0, 20.0);
const circle_color      = vec4<f32>(1.0, 1.0, 1.0, 1.0);
const slice_color       = vec4<f32>(0.0, 0.0, 0.0, 0.1);
const boxshadow_color = vec3<f32>(
    0.0392156862745098,
    0.03137254901960784,
    0.043137254901960784
);
const ring_color = vec3<f32>(
    0.8313725490196079,
    0.8235294117647058,
    0.9098039215686274
);
const segment_color0 = vec3<f32>(
    0.18823529411764706,
    0.30980392156862746,
    0.996078431372549
);
const segment_color1 = vec3<f32>(
    0.48627450980392156,
    0.25882352941176473,
    0.807843137254902
);

struct ViewportUniform {
    factor: vec2<f32>,
    _padding: vec2<f32>
};
@group(0) @binding(0)
var<uniform> viewport: ViewportUniform;

struct VertexInput {
    @location(0) vpos: vec2<f32>,
    @location(1) color: vec4<f32>,
};

struct InstanceInput {
    @location(2) ipos: vec2<f32>,
    @location(3) radius: f32,
    @location(4) presence: f32,
    @location(5) slice_angle: f32,
    @location(6) slice_transition: f32,
    @location(7) target_action: f32,
    @location(8) segment_width: f32,
    @location(9) fadein: f32,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(4) screen_position: vec2<f32>,
    @location(5) center: vec2<f32>,
    @location(6) radius: f32,
    @location(7) presence: f32,
    @location(8) slice_len: f32,
    @location(9) slice_transition: f32,
    @location(10) target_action: f32,
    @location(11) start1: f32,
    @location(12) start2: f32,
    @location(13) end1: f32,
    @location(14) end2: f32,
    @location(15) fadein: f32,
    @location(16) topleft: vec2<f32>,
};

// Convert from screen coordinates (0..n, 0..m) to normalized coordinates (-1..1, 1..-1).
fn screen_to_normal(v: vec2<f32>, max: vec2<f32>) -> vec2<f32> {
    return v / max * vec2(2.0, -2.0) + vec2(-1.0, 1.0);
}

// TODO: Document this
// Actually not 100% sure what this is...
fn sd_round_rect(p: vec2<f32>, r: f32) -> f32 {
    let q = abs(p);
    return clamp(q.x, q.y, 0.0) + length(max(q, vec2(0.0))) - r;
}

fn normal_blend(src: vec4<f32>, dst: vec4<f32>) -> vec4<f32> {
    let alpha = src.a + dst.a * (1.0 - src.a);
    return vec4((src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / alpha, 1.0 - alpha);
}

fn sigmoid(t: f32) -> f32 {
    return 1.0 / (1.0 + exp(-t));
}

@vertex
fn vs_main(
    model: VertexInput,
    instance: InstanceInput,
) -> VertexOutput {
    var out: VertexOutput;

    out.screen_position = model.vpos.xy + instance.ipos;
    out.center = instance.ipos + offset + max_radius;
    out.topleft = viewport.factor - offset * 2.0 - max_radius * 2.0;

    let normalized = screen_to_normal(out.screen_position, viewport.factor); // convert to NDC
    out.clip_position = vec4<f32>(normalized, 0.0, 1.0);

    out.radius = instance.radius;
    out.presence = instance.presence;
    out.slice_transition = instance.slice_transition;
    out.fadein = instance.fadein;

    out.slice_len = instance.segment_width * smoothstep(-1.0, -1.0 + angle_width, instance.target_action); // percent of a whole pie
    let target_action = instance.target_action;

    // Pass an instance to switch target.
    // `-1.0` -> none
    //  `0.1` -> search  (id: 0)
    //  `0.3` -> portal  (id: 1)
    //  `0.5` -> browser (id: 2)
    // `-0.1` -> card    (id: 3)
    // `-0.3` -> sticky  (id: 4)
    let half_segment_width = instance.segment_width / 2.0;
    out.start1 = clamp(-instance.slice_angle + half_segment_width, -0.3, half_segment_width)
        * smoothstep(-0.4 - angle_width, -0.4, -instance.slice_angle)
        + clamp(1.0 - instance.slice_angle + half_segment_width, 0.3, 0.5)
        * smoothstep(0.6 - angle_width, 0.6, instance.slice_angle);

    let from1 = smoothstep(0.3 - angle_width, 0.3, -out.start1);
    let to1   = smoothstep(0.5 - angle_width, 0.5, target_action);
    let from2 = smoothstep(0.5 - angle_width, 0.5, out.start1);
    let to2   = smoothstep(0.3 - angle_width, 0.3, -target_action);

    out.end1 = target_action + from1 * to1 * -1.0 + from2 * to2;
    out.start2 = out.start1 + from1 * to1 * (1.1) + from2 * to2 * -(1.1);
    out.end2 = target_action;

    return out;
}

// QUESTION: Can we just pass the instance struct to the FS?
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let radius = in.radius; // in px
    let sp = in.screen_position; // top left coords in px
    let gap = 0.000001;

    // Create a disturbance while transitioning to/from the "absent" state,
    // but only when we are nearly absent.
    // Drop the disturbance to zero when we are entirely gone.
    let absence = 1.0 - in.presence;
    let waggle_x = absence * sin((sp.y) / (2.0 + absence / 3.0)) * 15.0;
    let waggle_y = absence * sin((sp.x) / (2.0 + absence / 3.0)) * 15.0;

    var distance = length(in.center - sp);
    distance += (waggle_x + waggle_y) * smoothstep(0.9, 0.8, absence);

    var edge_width = blurriness * fwidth(distance);

    // CIRCLE
    // All the frag coords within this circle has opacity of `1.0`; otherwise, `0.0`.
    let opacity = smoothstep(radius + edge_width, radius, distance);
    // Color the circle, passing `vec3(opacity)` means its color is white. 
    let circle_color = vec3(opacity);

    // PIE SLICES
    // 1. Let's create a whole circle, that's basically identical to the main circle.
    var circle = smoothstep(radius + edge_width, radius, distance);
    // 2. Create another circle, that's smaller than the main circle.
    //    This will be used to hollow out the center of the main circle to make it look like a donut.
    let inner_circle = smoothstep(inner_ring_radius - gap + edge_width, max_radius, radius) * inner_ring_radius;
    circle -= smoothstep(inner_ring_radius - gap + edge_width, inner_circle, distance);

    let offset_angle1 = in.start1 + (in.end1 - in.start1) * in.slice_transition;
    let offset_angle2 = in.start2 + (in.end2 - in.start2) * in.slice_transition;

    let uv = in.center - sp;
    let frag_angle = atan2(uv.x, uv.y) * k_inv_pi * -0.5;
    let frag_angle1 = frag_angle + offset_angle1;
    let frag_angle2 = frag_angle + offset_angle2;

    let segment1 = smoothstep(in.slice_len + angle_width, in.slice_len, frag_angle1)
        * smoothstep(0.0, angle_width, frag_angle1);
    let segment2 = smoothstep(in.slice_len + angle_width, in.slice_len, frag_angle2)
        * smoothstep(0.0, angle_width, frag_angle2);

    // COLORING...
    let tl = in.topleft;
    let pie_slice = circle * (segment1 + segment2); // basically opacity
    let ss = smoothstep(
        dot(tl, tl),
        dot(tl + max_radius * 2.0, tl + max_radius * 2.0),
        dot(tl + uv, tl + max_radius * 2.0)
    );
    let rgb = smoothstep(opacity, 0.0, pie_slice)
        - smoothstep(min_radius, max_radius, radius) * (1.0 - vec3(
            segment_color1.r + (segment_color0.r - segment_color1.r) * ss,
            segment_color1.g + (segment_color0.g - segment_color1.g) * ss,
            segment_color1.b + (segment_color0.b - segment_color1.b) * ss
        ));
    let pieslice_color = vec4(rgb, 1.0);

    // INNER RING
    let circle2 = smoothstep(inner_ring_radius - gap + edge_width, inner_ring_radius - gap - edge_width, distance);
    let inner_circle2 = smoothstep(
        inner_ring_radius - gap - inner_ring_width + edge_width,
        inner_ring_radius - gap - inner_ring_width - edge_width,
        distance
    );
    let opacity2 = circle2 - smoothstep(0.0, 1.0, inner_circle2);
    let inner_ring_color = smoothstep(0.0, 1.0, opacity2) * (1.0 - ring_color);

    // ARC
    let circle5 = smoothstep(
        inner_ring_radius + 5.0 - gap + edge_width,
        inner_ring_radius + 5.0 - gap - edge_width,
        distance
    );
    let inner_circle5 = smoothstep(
        inner_ring_radius + 4.0 - gap + edge_width,
        inner_ring_radius + 4.0 - gap - edge_width,
        distance
    );

    let slice_len = 0.2 / 2.0;
    let offset_angle3 = in.end2 - 0.05;
    let frag_angle3 = frag_angle + offset_angle3;
    let segment3 = smoothstep(slice_len + angle_width, slice_len - angle_width, frag_angle3)
        * smoothstep(0.0, angle_width, frag_angle3);

    let arc = circle5 * segment3 - smoothstep(0.0, 1.0, inner_circle5);
    let arc_color = smoothstep(0.0, 1.0, arc) * vec3(1.0);

    // OUTER RING SHADOW
    edge_width = blurriness * fwidth(distance) * 2.0;
    let circle3 = smoothstep(radius + 10.0, radius, distance);
    let inner_ring3 = smoothstep(radius, radius - edge_width, distance);
    let opacity3 = circle3 - smoothstep(0.0, 1.0, inner_ring3);
    let dist_shadow = clamp(
        sigmoid(sd_round_rect(uv, in.radius + blur_radius) / blur_radius),
        0.0,
        1.0
    );
    let dist_rect = clamp(sd_round_rect(uv, in.radius), 0.0, 1.0);
    var col = vec3(dist_shadow);
    col = mix(vec3(1.0), col, dist_rect);
    let blend_color = normal_blend(vec4(vec3(1.0), 0.0), vec4(col, 1.0));
    let outer_ring_color = smoothstep(0.0, 1.0, (1.0 - blend_color.a) * boxshadow_opacity);

    return vec4(circle_color - inner_ring_color, opacity)
        + smoothstep(0.0, 1.0, pie_slice) * pieslice_color * (1.0 - smoothstep(0.0, 1.0, in.fadein) * (1.0 - in.slice_transition))
        + smoothstep(0.0, 1.0, pie_slice) * vec4(arc_color, 1.0) * (1.0 - smoothstep(0.0, 1.0, in.fadein) * (1.0 - in.slice_transition))
        + vec4(blend_color.rgb * boxshadow_color, outer_ring_color) * opacity3;
}
