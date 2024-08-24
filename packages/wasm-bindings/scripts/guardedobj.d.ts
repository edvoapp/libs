export class EdvoError extends Error {
  readonly extra?: any;
  constructor(message: string, extra?: any);
}

export class GuardedObj {
  static pretty_stack?: (error: Error, frames: number, skip: number) => void;
  // static #pretty_stack(error: Error, frames: number, skip: number): void;

  static detailed_validate_error?: (obj: GuardedObj, e: Error) => void;
  // static #detailed_validate_error(obj: GuardedObj, e: Error): void;

  _key?: string;
  get key(): string;

  // #destroyed?: true;
  get alive(): boolean;
  get destroyed(): boolean;

  destroystack?: Error;

  validate();

  // Super weird that we have to track inbound references,
  // but that's what you get when you don't have an ownership metaphor ¯\_(ツ)_/¯
  protected _inboundRefs: [Object, string | Symbol][];
  // Use this to attach to any kind of object
  registerReferent(referent: Object, referenceName: string | Symbol);
  deregisterReferent(obj: Object, referenceName: string | Symbol, debugStack?: Error);

  /**
   * Iterate over all properties and attempt to destroy them
   */
  protected cleanup();

  /** Return this object if it's still alive. Useful for some cases where we are caching objects that may or may not be alive */
  upgrade(): this | null;
  protected leaked?: boolean;
  /** Intentionally leak this object by being our own referent */
  leak(): this;
}

export class EdvoObjRS extends GuardedObj {
  protected free(): void;
}
