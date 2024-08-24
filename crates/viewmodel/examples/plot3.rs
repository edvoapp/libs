use std::{cell::Cell, rc::Rc};

use edvo_viewmodel::{
    fdg::{CoordForce, FdgPhase, ForceVector, Graph},
    geometry::Vector2D,
};

use plotters::prelude::*;

struct SampleData {
    iter: usize,
    coord: f32,
    slope: f32,
}

fn main() {
    let root = SVGBackend::new("plot3.svg", (1200, 675)).into_drawing_area();
    root.fill(&WHITE).unwrap();
    let root = root.margin(10, 10, 10, 10);

    let mut chart = ChartBuilder::on(&root)
        .caption(
            "m1 and m3 are related, m2 not -- m1: red, m3: green",
            ("sans-serif", 32).into_font(),
        )
        .x_label_area_size(60)
        .y_label_area_size(60)
        .build_cartesian_2d(0f32..400f32, -200f32..200f32)
        .unwrap();

    chart
        .configure_mesh()
        .x_labels(5)
        .x_desc("coord")
        .y_labels(5)
        .y_desc("force")
        .y_label_formatter(&|x| format!("{:.3}", x))
        .draw()
        .unwrap();

    let mut graph = Graph::default();
    let m1 = graph.new_member(
        Some(100.0),
        Some(100.0),
        false,
        Some(50.0),
        Some(0.0),
        false,
    );
    let m3 = graph.new_member(
        Some(100.0),
        Some(100.0),
        false,
        Some(350.0),
        Some(0.0),
        false,
    );

    graph.relate(&m1, &m3);

    let mut data1 = Vec::<CoordForce>::new();
    let mut data3 = Vec::<CoordForce>::new();
    let iters = 100;
    let step = 2.0;

    let all_members = &graph.members();
    let phase = Rc::new(Cell::new(FdgPhase::AttractRepel));

    for _ in 0..iters {
        m1.translate(Vector2D { x: step, y: 0.0 });
        m3.translate(Vector2D { x: -step, y: 0.0 });

        if let Some(ForceVector { attractive, .. }) = m1.force_vector(&all_members, phase.clone()) {
            data1.push(CoordForce {
                coord: m1.position().0,
                force: attractive.x.clamp(-200.0, 200.0),
            });
        }
        if let Some(ForceVector { attractive, .. }) = m3.force_vector(&all_members, phase.clone()) {
            data3.push(CoordForce {
                coord: m3.position().0,
                force: attractive.x.clamp(-200.0, 200.0),
            });
        }
    }

    // let d1 = data1
    //     .iter()
    //     .map(|d| (d.coord, d.force.min(10000.0)))
    //     .collect::<Vec<(f32, f32)>>();

    // let d3 = data3
    //     .iter()
    //     .map(|d| (d.coord, d.force.min(10000.0)))
    //     .collect::<Vec<(f32, f32)>>();

    // chart
    //     .draw_series(LineSeries::new(d1, RED.stroke_width(1)))
    //     .unwrap();

    // THEN... reset member B and call the internals of force_direct in a loop (but do NOT actually call force_direct
    // And plot the steps
    // Blue DOTS, each labeled with the iteration number (x = x coord of the sample, y = slope at the sample OR the force on the B member)
    // The hard part will be figuring out exactly how to manage the stepping process so that we converge on the minima

    // Reset the position of member B
    m1.translate(Vector2D {
        x: -step * iters as f32,
        y: 0.0,
    });
    m3.translate(Vector2D {
        x: step * iters as f32,
        y: 0.0,
    });

    let mut sample_data = Vec::<SampleData>::new();
    let members = graph.members();
    let max_step = 400.0;
    let iters = 200;

    'outer: for i in 0..iters {
        let percentage = (iters as f32 - i as f32) / iters as f32;
        let ms = max_step * percentage;

        // Calculate steps based on forces before any movement.
        let steps = members
            .iter()
            .map(|m| (m.get_step(&members, ms, phase.clone()), m))
            .collect::<Vec<_>>();

        let mut acted = false;

        // Apply movement.
        for (step, member) in steps {
            if let Some(s) = step {
                let slope = s.y / s.x;
                member.translate(s);
                acted = true;
                member.plot_x("*");
                sample_data.push(SampleData {
                    iter: i,
                    coord: m1.position().0,
                    slope,
                })
            } else {
                member.plot_x("");
            }
        }

        // If none of the steps results in a meaningful change, then we're done.
        if !acted {
            break 'outer;
        }
    }

    chart
        .draw_series(PointSeries::of_element(
            sample_data,
            2,
            &BLUE,
            &|c, s, st| {
                return EmptyElement::at((c.coord, c.slope))
                    + Circle::new((0, 0), s, st.filled())
                    + Text::new(
                        format!("{}", c.iter),
                        (3, 5),
                        ("sans-serif", 6)
                            .into_font()
                            .transform(FontTransform::Rotate90),
                    );
            },
        ))
        .unwrap();

    root.present().unwrap();
}
