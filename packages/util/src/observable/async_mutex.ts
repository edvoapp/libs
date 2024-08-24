import { EdvoObj } from './object';

export class AsyncMutex extends EdvoObj {
  private _locked: Promise<void> | null = null;
  async run_locked<Out>(fn: () => Out): Promise<Out> {
    while (this._locked) await this._locked;
    let done: () => void;

    this._locked = new Promise((r) => {
      done = r;
    });

    const out = fn();

    this._locked = null;
    done!();

    return out;
  }
  async run_locked_async<Out>(fn: () => Promise<Out>): Promise<Out> {
    while (this._locked) await this._locked;
    let done: () => void;

    this._locked = new Promise((r) => {
      done = r;
    });

    const out = await fn();

    this._locked = null;
    done!();
    return out;
  }
  async waitUntilFree(): Promise<void> {
    if (!this._locked) return;
    await this._locked;
  }
}
