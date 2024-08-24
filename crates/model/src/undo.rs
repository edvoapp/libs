use undo_2::{Action, Commands};
use wasm_bindgen::prelude::*;

enum Command {
    JsFn {
        dofn: js_sys::Function,
        undofn: js_sys::Function,
    },
    Batch(Vec<Command>),
}

impl Command {
    fn apply(&self) {
        match self {
            Command::JsFn { dofn, .. } => {
                dofn.call0(&JsValue::UNDEFINED).unwrap();
            }
            Command::Batch(pending) => {
                for cmd in pending {
                    cmd.apply()
                }
            }
        }
    }
    fn unapply(&self) {
        match self {
            Command::JsFn { undofn, .. } => {
                undofn.call0(&JsValue::UNDEFINED).unwrap();
            }
            Command::Batch(pending) => {
                for cmd in pending.iter().rev() {
                    cmd.unapply()
                }
            }
        }
    }
}

#[wasm_bindgen]
pub struct UndoManager {
    commands: Commands<Command>,
    pending: Option<Vec<Command>>,
}

#[wasm_bindgen]
impl UndoManager {
    pub fn new() -> Self {
        UndoManager {
            commands: Commands::new(),
            pending: None,
        }
    }
    pub fn undo(&mut self) {
        log::info!("UNDO");
        for action in self.commands.undo() {
            interpret_action(action);
        }
    }
    pub fn redo(&mut self) {
        log::info!("REDO");
        for action in self.commands.redo() {
            interpret_action(action);
        }
    }
    /// Add a DO/UNDO pair, and immediately call the DO handler
    pub fn add_action(&mut self, dofn: js_sys::Function, undofn: js_sys::Function) {
        dofn.call0(&JsValue::UNDEFINED).unwrap();

        let cmd = Command::JsFn { dofn, undofn };

        match self.pending {
            Some(ref mut pending) => {
                pending.push(cmd);
            }
            None => {
                self.commands.push(cmd);
            }
        }
    }

    pub fn begin(&mut self) {
        self.pending = Some(Vec::new());
    }

    pub fn commit(&mut self) {
        let pending = self.pending.take().expect("Cannot commit without begin");
        let batch = Command::Batch(pending);
        self.commands.push(batch);
    }

    // TODO - consider Using Rc<RefCell<Inner> to make this work
    // pub fn transact(&mut self, jsFn: js_sys::Function) {
    //     self.begin();
    //     jsFn.call0(&JsValue::UNDEFINED).unwrap(); // What's getting called inside this closure?
    //     self.commit();
    // }
}

impl Default for UndoManager {
    fn default() -> Self {
        Self::new()
    }
}

fn interpret_action(action: Action<&Command>) {
    match action {
        Action::Do(cmd) => cmd.apply(),
        Action::Undo(cmd) => cmd.unapply(),
    }
}
