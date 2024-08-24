// use std::rc::Rc;

// use wasm_bindgen::prelude::wasm_bindgen;

// use crate::transaction::Transaction;
// // Data model migration phases:
// // 1. Vertex API parity
// //    - ship
// // 2. Property (plus some abstraction between Property/Vertex)
// //    - ship
// // 3. Edge/Backref (plus the whole Arena vs Rc question, and probably more abstraction/traits)
// //    - ship

// #[wasm_bindgen]
// #[derive(Clone)]
// pub struct Vertex(Rc<Inner>);
// struct Inner {
//     // properties: Option<QueryObservable<Property>>,
//     // private _backrefs?: QueryObservable<Backref>;
//     //  private _edges?: QueryObservable<Edge>;
//     //   private _events?: QueryObservable<TimelineEvent>;
//     //   private _shares?: ObservableList<Share>;
//     //   private _userID?: Observable<string | undefined>;
//     //   hydratedKeywords?: string[]; // hack
// }
// pub struct RSDBclient {
//     inner: Rc<DBClientInner>,
// }

// enum VertexKind {
//     Vertex,
//     Resource,
//     Text,
//     Highlight,
//     User,
//     Media,
//     Dock,
//     Backpack,
//     UserProfile,
// }

// #[wasm_bindgen]
// pub struct CreateArgs {
//     trx: Transaction, // We're already importing transaction from JS
//                       // meta: Option<BaseMeta>, // Describe BaseMeta
//                       // origin: Option<ItemEventOrigin>,
//                       // name: Option<String>,
//                       // kind: Option<VertexKind>,
//                       // parent: Option<Vertex>,
//                       // attributes: Option<VertexAttributes>,
//                       // id: Option<String>,
//                       // privs: Option<PrivState>,
//                       // email: Option<String>,
//                       // invite_code: Option<String>,
// }

// impl Vertex {
//     /// # Create a Vertex data model
//     ///
//     /// ```
//     ///  # edvo_model::transaction::native::init_firestore();
//     ///  let trx = Transaction::new();
//     ///  let vertex = Vertex::create(CreateArgs:{
//     ///     trx: &trx,
//     ///    ...Default::default(),
//     ///    whatever goes here
//     /// });
//     /// trx.apply_sync();
//     /// ```
//     fn create(args: CreateArgs) {
//         // port create guts into here
//     }
//     // fn hydrate (args: HydrateArgs){

//     // }

//     // Yeah this needs to be abstracted, but for now there's exactly one Entity: Vertex. so we will deal with this later
//     pub fn apply_snapshot() {}
// }
