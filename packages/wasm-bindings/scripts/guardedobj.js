/**
 * Represents an error specific to the Edvo application.
 * @extends Error
 */
export class EdvoError extends Error {
  /**
   * Creates an instance of EdvoError.
   * @param {string} message The error message.
   * @param {*} [extra] Additional information related to the error.
   */
  constructor(message, extra) {
    super(message);
    this.extra = extra;
  }
}

export class GuardedObj {
  static pretty_stack;
  static #pretty_stack(error, frames, skip) {
    if (!GuardedObj.pretty_stack) throw new Error('GuardedObj.pretty_stack must be assigned');
    GuardedObj.pretty_stack(error, frames, skip);
  }

  static detailed_validate_error;
  static #detailed_validate_error(obj, e) {
    if (!GuardedObj.detailed_validate_error) throw new Error('GuardedObj.detailed_validate_error must be assigned');
    GuardedObj.detailed_validate_error(obj, e);
  }

  _key;
  get key() {
    if (this._key) return this._key;
    this._key = Math.random().toString(36).substring(8);
    return this._key;
  }

  _destroyed;
  get alive() {
    return !this._destroyed;
  }
  get destroyed() {
    return !!this._destroyed;
  }

  destroystack;

  validate() {
    if (this._destroyed) {
      debugger;
      const e = new Error();

      // Does the test suite wait for this? because it's super helpful in debugging
      GuardedObj.#detailed_validate_error(this, e);

      // We want to print a detailed validation error - but unfortunately this has to be async
      // so we'll throw an "initial" error message until such time as we have a way to update the initial toast
      let caller = GuardedObj.#pretty_stack(new Error(), 10, 1);
      let destroyedAt = this.destroystack ? GuardedObj.#pretty_stack(this.destroystack, 10, 0) : 'unknown';

      throw new EdvoError(
        `Used destroyed ${this.constructor.name}(${this.key}) at:\n${caller}\n\ndestroyed:\n${destroyedAt}`,
      );
    }
  }

  // Super weird that we have to track inbound references,
  // but that's what you get when you don't have an ownership metaphor ¯\_(ツ)_/¯
  _inboundRefs = [];
  // Use this to attach to any kind of object
  registerReferent(referent, referenceName) {
    this.validate();
    if (!referent) {
      debugger;
      console.warn('Attempt to register null referent');
      return;
    }

    // In wasm-bindgen, the constructor is not used, then super() is not called.
    this._inboundRefs ??= [];
    // On occasions where we are detached before the referent object is destroyed, we need to excuse ourselves from the onCleanups
    this._inboundRefs.push([referent, referenceName]);
    return this;
  }
  deregisterReferent(obj, referenceName, debugStack) {
    // In wasm-bindgen, the constructor is not used, then super() is not called.
    this._inboundRefs ??= [];
    this._inboundRefs = removeOneItem(this._inboundRefs, (o) => !(obj !== o[0] || referenceName !== o[1]));

    if (this._inboundRefs.length === 0 && !this.destroyed) {
      this.cleanup();
      this._destroyed = true;
      this.destroystack = debugStack ?? new Error();
    }
  }

  /**
   * Iterate over all properties and attempt to destroy them
   */
  cleanup() {}

  /** Return this object if it's still alive. Useful for some cases where we are caching objects that may or may not be alive */
  upgrade() {
    return this.destroyed ? null : this;
  }
  leaked;
  /** Intentionally leak this object by being our own referent */
  leak() {
    this.registerReferent(this, '~~leak~~');
    this.leaked = true;
    return this;
  }
}

export class EdvoObjRS extends GuardedObj {
  cleanup() {
    this.free();
    super.cleanup();
  }
}

// Remove efficiently one item that satisfies `condition` in an array
// where order doesn't matter
// function removeOneItem<T>(
//  list: T[],
//  condition: (val: T) => boolean,
//): T | undefined
function removeOneItem(list, condition) {
  let index = list.findIndex(condition);
  if (index === -1) return list;

  // swap with the last item and pop the target item
  const lastIdx = list.length - 1;
  if (index !== lastIdx) list[index] = list[lastIdx];
  list.pop();
  return list;
}
