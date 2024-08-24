# JSListener

## Usage

1. Add a listener field whose type is `JsEventListener` to your state.
2. Create your closure.
3. Prepare an element that implements `AsRef<ElementTarget>`.
4. Add an event listner to your event target.

That's it!

### Example

```rust
use js_listener::JsEventListener;

struct State {
    window_click_listener: JsEventListener,
}

let window_click_callback = Closure::<dyn FnMut()>::new(move || {
    log::info!("Clicked!");
});

let window = web_sys::window().unwrap();
let window_click_listener = JsEventListener::new(window, "click", window_click_callback);

State {
    window_click_listener,
}
```

Sponsored by Edvo.com - Breaking you out of tab hell, and connecting you to all your stuff
