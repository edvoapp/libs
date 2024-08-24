use edvo_viewmodel::fdg::{Graph, MemberMeta};

// start:
// m1    m2(unrelated)    m3    m4
// end:
//      m1m3m4    m2
#[test]
fn test_four_cards_second_unrelated() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: None,
        y: None,
        _left_align: false,
    }); // (0, 0)
    let m2 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: None,
        y: None,
        _left_align: false,
    }); // (1000, 0)
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: None,
        y: None,
        _left_align: false,
    }); // (2000, 0)
    let m4 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(4000.0),
        y: None,
        _left_align: false,
    }); // (3000, 0)

    graph.relate(&m1, &m3);
    graph.relate(&m3, &m4);
    graph.force_direct();

    assert_eq!(m1.position(), (1900.0, 0.0));
    assert_eq!(m2.position(), (1000.0, 0.0));
    assert_eq!(m3.position(), (2000.0, 0.0));
    assert_eq!(m4.position(), (2100.0, 0.0));
}

// start:
// m1    m2    m3(unrelated)    m4
// end:
//      m1m3m4    m2
#[ignore = "haven't calculated the actual values"]
#[test]
fn test_four_cards_third_unrelated() {
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
        x: Some(300.0),
        y: None,
        _left_align: false,
    });
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(600.0),
        y: None,
        _left_align: false,
    });
    let m4 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(750.0),
        y: None,
        _left_align: false,
    });
    let m5 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(900.0),
        y: None,
        _left_align: false,
    });

    graph.relate(&m1, &m2);
    graph.relate(&m2, &m4);
    graph.relate(&m4, &m5);
    graph.force_direct();

    assert_eq!(m1.position(), (1500.0, 0.0));
    assert_eq!(m2.position(), (1000.0, 0.0));
    assert_eq!(m3.position(), (1600.0, 0.0));
    assert_eq!(m4.position(), (1700.0, 0.0));
    assert_eq!(m5.position(), (1700.0, 0.0));
}

// start: a(fixed) b c d
// end:   a-b-c-d
#[test]
fn test_4() {
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
        x: Some(300.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: Some(600.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m4 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: Some(900.0),
        y: Some(0.0),
        _left_align: false,
    });

    graph.relate(&m1, &m2);
    graph.relate(&m2, &m3);
    graph.relate(&m3, &m4);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (140.0, 0.0));
    assert_eq!(m3.position(), (280.0, 0.0));
    assert_eq!(m4.position(), (420.0, 0.0));
}
