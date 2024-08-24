use edvo_viewmodel::fdg::{Graph, MemberMeta};

#[test]
fn test_three_cards_overlap_horizontally_no_relations() {
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
        y: Some(0.0),
        _left_align: false,
    });
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(100.0),
        y: Some(0.0),
        _left_align: false,
    });

    graph.force_direct();

    assert_eq!(m1.position(), (-50.0, 0.0));
    assert_eq!(m2.position(), (50.0, 0.0));
    assert_eq!(m3.position(), (150.0, 0.0));
}

#[test]
fn test_three_cards_overlap_vertically_no_relations() {
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
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(0.0),
        y: Some(100.0),
        _left_align: false,
    });

    graph.force_direct();

    assert_eq!(m1.position(), (0.0, -50.0));
    assert_eq!(m2.position(), (0.0, 50.0));
    assert_eq!(m3.position(), (0.0, 150.0));
}

#[test]
fn test_three_cards_overlap_diagonally_no_relations() {
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
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: Some(100.0),
        y: Some(100.0),
        _left_align: false,
    });

    graph.force_direct();

    assert_eq!(m1.position(), (-50.0, -50.0));
    assert_eq!(m2.position(), (50.0, 50.0));
    assert_eq!(m3.position(), (150.0, 150.0));
}

// start:
// m1    m2    m3
// end:
//     m1m2m3
#[test]
fn test_three_cards() {
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

    graph.relate(&m1, &m2);
    graph.relate(&m2, &m3);
    graph.force_direct();

    assert_eq!(m1.position(), (900.0, 0.0));
    assert_eq!(m2.position(), (1000.0, 0.0));
    assert_eq!(m3.position(), (1100.0, 0.0));
}

// start:
// m1(fixed)    m2    m3
// end:
// m1m2m3
#[test]
fn test_three_cards_first_fixed() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
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
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: None,
        y: None,
        _left_align: false,
    });

    graph.relate(&m1, &m2);
    graph.relate(&m2, &m3);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (100.0, 0.0));
    assert_eq!(m3.position(), (200.0, 0.0));
}

// start:
// m1    m2    m3(fixed)
// end:
//         m1m2m3
#[test]
fn test_three_cards_third_fixed() {
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
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: None,
        y: None,
        _left_align: false,
    });

    graph.relate(&m1, &m2);
    graph.relate(&m2, &m3);
    graph.force_direct();

    assert_eq!(m1.position(), (1800.0, 0.0));
    assert_eq!(m2.position(), (1900.0, 0.0));
    assert_eq!(m3.position(), (2000.0, 0.0));
}

// start:
// m1(fixed)    m2    m3(fixed)
// end:
// m1           m2    m3
#[test]
fn test_three_cards_first_and_third_fixed() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
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
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: true,
        x: None,
        y: None,
        _left_align: false,
    });

    graph.relate(&m1, &m2);
    graph.relate(&m2, &m3);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (1000.0, 0.0));
    assert_eq!(m3.position(), (2000.0, 0.0));
}

// stat:
// m1    m2(fixed)    m3
// end:
//     m1m2m3
#[test]
fn test_three_cards_second_fixed() {
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
        autoposition: true,
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

    graph.relate(&m1, &m2);
    graph.relate(&m2, &m3);
    graph.force_direct();

    assert_eq!(m1.position(), (900.0, 0.0));
    assert_eq!(m2.position(), (1000.0, 0.0));
    assert_eq!(m3.position(), (1100.0, 0.0));
}

// start:
// m1(unrelated)    m2    m3
// end:
// m1                 m2m3
#[test]
fn test_three_cards_first_unrelated() {
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

    graph.relate(&m2, &m3);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (1450.0, 0.0));
    assert_eq!(m3.position(), (1550.0, 0.0));
}

// start:
// m1    m2(unrelated)    m3
// end:
//       m1m3
//       m2
#[test]
fn test_three_cards_second_unrelated() {
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
        x: Some(1200.0),
        y: None,
        _left_align: false,
    }); // (1200, 0)

    graph.relate(&m1, &m3);
    graph.force_direct();

    assert_eq!(m1.position(), (550.0, 0.0));
    assert_eq!(m2.position(), (1000.0, 0.0));
    assert_eq!(m3.position(), (650.0, 0.0));
}

// start:
// m1    m2    m3(unrelated)
// end:
//   m1m2      m3
#[test]
fn test_three_cards_third_unrelated() {
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
        height: (100.0),
        autoposition: false,
        x: None,
        y: None,
        _left_align: false,
    }); // (2000, 0)

    graph.relate(&m1, &m2);
    graph.force_direct();

    assert_eq!(m1.position(), (450.0, 0.0));
    assert_eq!(m2.position(), (550.0, 0.0));
    assert_eq!(m3.position(), (2000.0, 0.0));
}

// start:
// A    B    C
//
// A is related to C and B is related to C
//
// end:
//     ACB
#[test]
fn test_three_cards_relations_ac_and_bc() {
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
    let m3 = graph.new_member(MemberMeta {
        width: Some(100.0),
        height: Some(100.0),
        autoposition: false,
        x: None,
        y: None,
        _left_align: false,
    });

    graph.relate(&m1, &m3);
    graph.relate(&m3, &m2);
    graph.force_direct();

    assert_eq!(m1.position(), (200.0, 0.0));
    assert_eq!(m2.position(), (400.0, 0.0));
    assert_eq!(m3.position(), (300.0, 0.0));
}

#[test]
fn test_3() {
    let mut graph = Graph::default();
    let m1 = graph.new_member(MemberMeta {
        width: Some(10.0),
        height: Some(10.0),
        autoposition: false,
        x: Some(0.0),
        y: Some(0.0),
        _left_align: false,
    });
    let m2 = graph.new_member(MemberMeta {
        width: Some(10.0),
        height: Some(10.0),
        autoposition: true,
        x: Some(25.0),
        y: Some(1.0),
        _left_align: false,
    });
    let m3 = graph.new_member(MemberMeta {
        width: Some(10.0),
        height: Some(10.0),
        autoposition: true,
        x: Some(45.0),
        y: Some(1.0),
        _left_align: false,
    });

    graph.relate(&m1, &m2);
    graph.relate(&m2, &m3);
    graph.force_direct();

    assert_eq!(m1.position(), (0.0, 0.0));
    assert_eq!(m2.position(), (50.0, 0.0));
    assert_eq!(m3.position(), (100.0, 0.0));
}
