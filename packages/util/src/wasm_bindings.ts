import * as Bindings from '@edvoapp/wasm-bindings';
export type WasmBindings = {
  [Key in keyof typeof Bindings]: typeof Bindings[Key];
};

let wasmBindings: WasmBindings | null = null;

let wasmDone: (wasm: WasmBindings) => void;
const wasmProm = new Promise<WasmBindings>((resolve) => {
  wasmDone = resolve;
});
export const waitForWasm = () => wasmProm;

export const setWasmBindings = (wasm: WasmBindings) => {
  wasmBindings = wasm;
  wasmDone?.(wasm);
};

export const getWasmBindings = (): WasmBindings => {
  if (!wasmBindings) throw 'wasm is uninitialized';
  return wasmBindings;
};

let sessionManager: Bindings.SessionManager | undefined;
export const useSessionManager = (): Bindings.SessionManager => {
  sessionManager ??= getWasmBindings().use_session_manager();
  return sessionManager;
};

let undoManager: Bindings.UndoManager | undefined;
export const useUndoManager = (): Bindings.UndoManager => {
  undoManager ??= getWasmBindings().UndoManager.new();
  return undoManager;
};

export const initAppController = () => {
  void waitForWasm().then((wasm) => {
    void wasm.load_app_controller().then((controller) => {
      try {
        controller.run();
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Using exceptions for control flow, don't mind me.")) {
          // Yeah well, you know, that's just like, your opinion man
        } else {
          // Forget it Donny, you're out of your element!
          throw e;
        }
      }
    });
  });
};
