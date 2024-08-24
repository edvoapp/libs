use yrs::updates::decoder::Decode;
use yrs::{GetString, ReadTxn, Transact, Update};

#[test]
fn basics() {
    let mut alice = Text::default();
    let mut bob = Text::default();

    alice.insert(0, "hello");
    assert_eq!(&alice.string(), "hello");

    alice.insert(5, " world");
    assert_eq!(alice.string(), "hello world");

    assert_eq!(bob.string(), "");

    let alice_to_bob = alice.save();

    bob.apply_update(alice_to_bob);
    assert_eq!(bob.string(), "hello world");

    // Nothing to save (not sure why this returns a vec of two 0u8's though)
    assert_eq!(alice.save(), &[0, 0]);
    assert_eq!(bob.save(), &[0, 0]);
}

#[derive(Default)]
struct Text {
    doc: yrs::Doc,
    presumed_server_state: yrs::StateVector,
}

impl Text {
    fn insert(&self, index: u32, chunk: &str) {
        let text_ref = self.doc.get_or_insert_text("");
        let mut txn = self.doc.transact_mut();
        yrs::Text::insert(&text_ref, &mut txn, index, chunk);
    }
    fn save(&mut self) -> Vec<u8> {
        // diff my total state versus the presumed server state
        let trx = self.doc.transact();

        let update_to_send = trx.encode_diff_v1(&self.presumed_server_state);

        // Assume it was received
        self.presumed_server_state = trx.state_vector();

        // NOTE: When we are running our own server we can consolidate updates there and send updates more freely.
        // The only reason we have to do this debouncing silliness today is because we're using FireStore arrayUnion

        update_to_send
    }
    fn apply_update(&mut self, update: Vec<u8>) {
        let delta_from_server = Update::decode_v1(&update).unwrap();
        let mut trx = self.doc.transact_mut();
        trx.apply_update(delta_from_server);
        self.presumed_server_state = trx.state_vector();
    }
    fn string(&self) -> String {
        let text_ref = self.doc.get_or_insert_text("");
        text_ref.get_string(&self.doc.transact())
    }
}
