use edvo_viewmodel::fdg::Graph;

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use rand::{thread_rng, Rng};

// Prepares a graph with `n` members with a random number of relations.
fn prepare_graph(n: usize) -> Graph {
    let mut graph = Graph::default();
    for _ in 0..n {
        graph.new_member(None, None, false, None, None);
    }
    make_random_number_of_relations(&graph, n);
    graph
}

fn make_random_number_of_relations(g: &Graph, n: usize) {
    let mut rng = thread_rng();
    let n = rng.gen_range(0..n);
    let members = g.members();
    for i in 0..n {
        let m1 = &members[i];
        let m2 = &members[i + 1];
        g.relate(m1, m2);
    }
}

fn fdg(g: &Graph) {
    g.force_direct();
}

fn criterion_benchmark(c: &mut Criterion) {
    let g1 = prepare_graph(100);
    let g2 = prepare_graph(200);
    let g3 = prepare_graph(300);
    let g4 = prepare_graph(1000);

    c.bench_function("fdg 100", |b| b.iter(|| fdg(black_box(&g1))));
    c.bench_function("fdg 200", |b| b.iter(|| fdg(black_box(&g2))));
    c.bench_function("fdg 300", |b| b.iter(|| fdg(black_box(&g3))));
    c.bench_function("fdg 1000", |b| b.iter(|| fdg(black_box(&g4))));
}

criterion_group! {
    name = benches;
    config = Criterion::default().sample_size(20);
    targets = criterion_benchmark
}
criterion_main!(benches);
