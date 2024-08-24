// use std::collections::HashMap;

// pub mod native {
//     pub use firestore::FireStoreDb;

//     thread_local! {
//         pub static FIRESTORE_HANDLE: RefCell<Option<Rc<FirestoreDb>>> = RefCell::new(None);
//     }

//     /// This needs to be called once at startup before creating any transactions
//     pub fn init_firestore() {
//         let google_project_id = config_env_var("GOOGLE_PROJECT_ID");
//         let firebase_auth_api_key = config_env_var("FIREBASE_AUTH_API_KEY");
//         //let firebase_key_json_path = config_env_var("FIREBASE_KEY_JSON_PATH");
//         let sendgrid_api_key = config_env_var("SENDGRID_API_KEY");
//         let port: u16 = config_env_var("PORT")
//             .parse()
//             .expect("PORT environment variable is not valid");
//         println!("Trying to connect to FirestoreDb");
//         let db = FirestoreDb::with_options_token_source(
//             FirestoreDbOptions {
//                 google_project_id,
//                 max_retries: 3,
//                 firebase_api_url: std::env::var("FIRESTORE_API_URL").ok(),
//             },
//             gcloud_sdk::GCP_DEFAULT_SCOPES.clone(),
//             gcloud_sdk::TokenSourceType::Default,
//         );
//         FIRESTORE_HANDLE.with(move |c| *c.borrow_mut() = Some(Rc::new(db)));
//     }
//     pub fn get_firestore() -> Rc<FireStoreDb> {
//         FIRESTORE_HANDLE.with(|c| {
//             c.borrow()
//                 .as_ref()
//                 .expect("firestore must be initialized before calling `get_firestore()`")
//                 .clone()
//         })
//     }
// }

// pub struct Transaction {
//     client: Rc<native::FirestoreDb>,
// }

// impl Transaction {
//     pub fn new() -> Self {
//         Transaction {
//             client: get_firestore,
//         }
//     }
//     fn insert(&self, docref: String, data: HashMap<&Sting, String>) {
//         self.client.fluent().insert().into(collection);
//     }
//     fn set(&self, docref: String, data: HashMap<&'static str, String>) {}
//     fn update(&self, docref: String, data: HashMap<&'static str, String>) {}
//     fn push_to_array() {}
//     fn delete(&self) {}
//     fn set_for_ref(&self) {}
// }
