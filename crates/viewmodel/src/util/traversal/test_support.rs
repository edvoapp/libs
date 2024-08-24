use super::WalkableNode;

use std::{
    cell::RefCell,
    rc::{Rc, Weak},
};

#[derive(Debug, Clone)]
pub enum NodeType {
    Text { len: usize },
    Lozenge,
}

#[derive(Clone, Debug)]
pub struct TestNode(Rc<RefCell<Inner>>);

#[derive(Debug, Clone)]
pub struct WeakTestNode(Weak<RefCell<Inner>>);

impl WeakTestNode {
    pub fn first_child(&self) -> Option<TestNode> {
        let inner = self.0.upgrade()?;
        let inner = inner.borrow();
        inner.children.first().cloned()
    }
}

#[derive(Debug)]
struct Inner {
    parent: Option<WeakTestNode>,
    children: Vec<TestNode>,
    kind: NodeType,
}

impl PartialEq for TestNode {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}

impl TestNode {
    pub fn parent() -> Self {
        TestNode(Rc::new(RefCell::new(Inner {
            parent: None,
            children: Vec::new(),
            kind: NodeType::Lozenge,
        })))
    }

    pub fn attach_parent(&self, parent: &Self) {
        let mut inner = self.0.borrow_mut();
        inner.parent = Some(parent.weak());
    }

    pub fn get_parent(&self) -> Option<WeakTestNode> {
        let inner = self.0.borrow();
        inner.parent.as_ref().cloned()
    }

    pub fn lozenge() -> Self {
        TestNode(Rc::new(RefCell::new(Inner {
            parent: None,
            children: Vec::new(),
            kind: NodeType::Lozenge,
        })))
    }

    pub fn text(len: usize) -> Self {
        TestNode(Rc::new(RefCell::new(Inner {
            parent: None,
            children: Vec::new(),
            kind: NodeType::Text { len },
        })))
    }

    pub fn append_child(&self, node: Self) {
        let mut inner = self.0.borrow_mut();
        node.attach_parent(self);
        inner.children.push(node);
    }

    fn weak(&self) -> WeakTestNode {
        WeakTestNode(Rc::downgrade(&self.0))
    }

    pub fn first_child(&self) -> Option<TestNode> {
        let inner = self.0.borrow();
        inner.children.first().cloned()
    }

    pub fn get_child(&self, index: usize) -> Option<TestNode> {
        let inner = self.0.borrow();
        inner.children.get(index).cloned()
    }

    fn get_sibling(&self, child: &Self, offset: isize) -> Option<TestNode> {
        let inner = self.0.borrow();

        if let Some(origin) = inner
            .children
            .iter()
            .position(|e| Rc::ptr_eq(&e.0, &child.0))
        {
            let position = origin as isize + offset;
            if position < 0 || position >= inner.children.len() as isize {
                None
            } else {
                Some(inner.children[position as usize].clone())
            }
        } else {
            None
        }
    }

    pub fn kind(&self) -> NodeType {
        let inner = self.0.borrow();
        inner.kind.clone()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.length() == 0
    }

    pub fn first_sibling(&self) -> TestNode {
        match self.get_parent() {
            Some(parent) => parent.first_child().unwrap(),
            None => self.clone(),
        }
    }
}

impl WeakTestNode {
    fn upgrade(&self) -> Option<TestNode> {
        self.0.upgrade().map(TestNode)
    }
}

impl WalkableNode for TestNode {
    fn previous_sibling(&self) -> Option<Self> {
        let inner = self.0.borrow();

        if let Some(parent) = &inner.parent {
            if let Some(parent) = parent.upgrade() {
                return parent.get_sibling(self, -1);
            }
        }
        None
    }

    fn next_sibling(&self) -> Option<Self> {
        let inner = self.0.borrow();

        if let Some(parent) = &inner.parent {
            if let Some(parent) = parent.upgrade() {
                return parent.get_sibling(self, 1);
            }
        }
        None
    }

    fn length(&self) -> usize {
        let inner = self.0.borrow();
        match inner.kind {
            NodeType::Text { len } => len,
            NodeType::Lozenge => 1,
        }
    }
}
