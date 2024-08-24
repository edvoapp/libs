use edvo_viewmodel::fdg::{Graph, MemberMeta, MARGIN};

// start: a(fixed) b
// end:   a-b
#[test]
fn test_2() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(0.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: Some(50.0),
        y: Some(2.0),
        _left_align: false,
    });

    graph.relate(&m1, &m2);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (140.0, 0.0));
}

#[test]
fn test_overlap_horizontally_no_relations() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: Some(0.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: Some(50.0),
        y: Some(0.0),
        _left_align: false,
    });

    graph.force_direct();

    assert_eq!(m1.position(), (-25.0, 0.0));
    assert_eq!(m2.position(), (75.0, 0.0));
}

#[test]
fn test_two_cards_overlap_vertically_no_relations() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(0.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(0.0),
        y: Some(50.0),
        _left_align: false,
    });

    graph.force_direct();

    assert_eq!(m1.position(), (0.0, -25.0));
    assert_eq!(m2.position(), (0.0, 75.0));
}

#[test]
fn test_two_cards_overlap_diagonally_no_relations() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(0.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(50.0),
        y: Some(50.0),
        _left_align: false,
    });

    graph.force_direct();

    assert_eq!(m1.position(), (-25.0, -25.0));
    assert_eq!(m2.position(), (75.0, 75.0));
}

#[test]
fn test_two_cards_same_y_coord() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(50.0),
        y: Some(0.0),
        _left_align: false,
    }); // (50, 0)
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(200.0),
        y: Some(0.0),
        _left_align: false,
    }); // (200, 0)

    graph.relate(&m1, &m2);

    graph.force_direct();

    assert_eq!(m1.position(), (75.0, 0.0));
    assert_eq!(m2.position(), (175.0, 0.0));
}

// start:
// m1(fixed)    m2    m3(fixed)
// end:
// m1    m2    m3 (no moving)
#[test]
fn test_two_cards() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: None,
        y: None,
        _left_align: false,
    });
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: None,
        y: None,
        _left_align: false,
    });

    graph.relate(&m1, &m2);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (100.0, 0.0));
}

#[test]
fn test_overlap_perf() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(0.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: Some(0.0),
        y: Some(0.0),
        _left_align: false,
    });
    let margin = 2.0 * MARGIN;

    graph.relate(&m1, &m2);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (100.0 + margin, 0.0));
}

#[test]
fn test_overlap_almost_perf() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(0.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: Some(0.0),
        y: Some(1.0),
        _left_align: false,
    });
    let margin = 2.0 * MARGIN;

    graph.relate(&m1, &m2);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (0.0, 100.0 + margin));
}
