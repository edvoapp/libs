import { Unsubscriber } from './observable';

export interface Subscribable {
  subscribe(
    // TODO: Make more specific than any
    fn: () => any, //ObsListener<any> | ChangeListener<any>,
    notifyInitialValue?: boolean,
  ): Unsubscriber;
}
/**
 * Ticker is a class which is used for tests
 * It allows the behavior of Observable objects to be precisely measured such that
 * we can determine if and Observable object (or a chain of observable objects) is behaving according to our expectations
 *
 * If we have too many, or too few ticks for a given exercise, then something has likely gone wrong
 */
export class Ticker {
  private queuedTicks: { resolve: () => void; debug: boolean }[] = [];
  private _uncapturedTicks = 0;
  private unsub: () => void;
  constructor(obs: Subscribable) {
    this.unsub = obs.subscribe(() => {
      const next = this.queuedTicks.shift();
      if (next) {
        // eslint-disable-next-line no-debugger
        if (next.debug) debugger;
        next.resolve();
      } else {
        this._uncapturedTicks += 1;
      }
    });
  }
  async tick(): Promise<void> {
    if (this._uncapturedTicks > 0) {
      this._uncapturedTicks -= 1;
      return;
    }

    return new Promise((resolve) => {
      this.queuedTicks.push({ resolve: resolve as () => void, debug: false });
    });
  }

  /**
   * Return the present number of uncaptured ticks
   * and decrement by up to the specified number
   */
  uncapturedTicks(decrementTicks = 0): number {
    let t = this._uncapturedTicks;

    this._uncapturedTicks -= Math.min(Math.abs(decrementTicks), this._uncapturedTicks);

    return t;
  }

  async tickDebug() {
    if (this._uncapturedTicks > 0) {
      throw 'cannot debug uncaptured tick';
    }

    return new Promise((resolve) => {
      this.queuedTicks.push({ resolve: resolve as () => void, debug: true });
    });
  }
}
