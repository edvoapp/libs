// TODO: To be fixed.
#[cfg(not(target_arch = "wasm32"))]
async fn run() {
    use render::viewmodel::radial_nav::radial_nav::{Appearance, RadialNav};
    use render::{get_global_renderer, load_global_renderer};

    // Load our renderer.
    let _ = load_global_renderer().await;

    // NOTE: Should not see anything at all on canvas as winit probably doesn't handle
    // async/await in event loop.
    let rnav = RadialNav::new();
    rnav.animate_foo(Appearance::Expanded, [250.0, 250.0], None);
    rnav.set_hovered_pie_slice_angle(Some(72.0), 5);

    let renderer = get_global_renderer();
    renderer.run();
}

fn main() {
    #[cfg(not(target_arch = "wasm32"))]
    pollster::block_on(run());
}
