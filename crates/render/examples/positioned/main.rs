// TODO: To be fixed.
#[cfg(not(target_arch = "wasm32"))]
async fn run() {
    use render::model::{Position, PositionColor};
    use render::modules::{PositionedRenderModule, Update};
    use render::{get_global_renderer, load_global_renderer};

    // Load renderer.
    let _ = load_global_renderer().await;

    // Create three vertices that make up a triangle.
    let pos_mod_test = PositionedRenderModule::<PositionColor, Position>::new(
        &get_global_renderer(),
        None,
        None,
        "positioned",
    );
    let color = [
        0.9490196078431372,
        0.5176470588235295,
        0.5098039215686274,
        1.0,
    ];
    let vertices = &[
        PositionColor {
            position: [100.0, 100.0],
            color,
        },
        PositionColor {
            position: [300.0, 150.0],
            color,
        },
        PositionColor {
            position: [175.0, 175.0],
            color,
        },
    ];
    pos_mod_test.update(Update {
        vertices,
        indices: &[0, 1, 2],
    });
    pos_mod_test.update_instances(Position::default());

    let renderer = get_global_renderer();
    renderer.run();
}

fn main() {
    #[cfg(not(target_arch = "wasm32"))]
    pollster::block_on(run());
}
