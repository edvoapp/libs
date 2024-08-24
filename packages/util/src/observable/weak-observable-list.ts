import { EdvoObj } from './object';
import { ChangeContext, ItemEventOrigin } from './observable';
import { ObservableList } from './observable-list';

export class WeakObservableList<Obj extends EdvoObj> extends ObservableList<Obj> {
  protected cleanup() {
    this._listeners.ITEM_LISTENER = [];
    this._listeners.MODIFY_LISTENER = [];
    this._listeners.CHANGE = [];
    super.cleanup();
  }

  insert(obj: Obj, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}, dedupe?: boolean) {
    this.rawInsert(obj, origin, ctx, dedupe);
    this.fireChangeListeners(origin, ctx);
    obj.onCleanup(() => this.remove(obj, origin, ctx));
  }

  remove(val: Obj, origin: ItemEventOrigin = 'UNKNOWN', ctx: ChangeContext = {}) {
    this.rawRemove(val, origin, ctx);
    this.fireChangeListeners(origin, ctx);
  }
}
