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
    @location(3) z: f32,
    @location(4) hovered: f32,
    @location(5) scaling_vec: vec2<f32>, // basically a scaling matrix
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(
    model: VertexInput,
    instance: InstanceInput,
) -> VertexOutput {
    var out: VertexOutput;

    let normalized = (instance.scaling_vec * model.vpos  + instance.ipos) / viewport.factor
        * vec2(2.0, -2.0) + vec2(-1.0, 1.0);

    out.clip_position = vec4<f32>(normalized, instance.z, 1.0);
    out.color = vec4(model.color.rgb + smoothstep(0.0, 1.0, instance.hovered), model.color.a);

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(in.color);
}
