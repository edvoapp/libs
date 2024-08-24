export class NodeIterator {
  root: Node | null;
  private _next: Node | ChildNode | null;
  private _current: Node | null;

  constructor(root: Node) {
    this.root = root;
    this._next = root;
    this._current = null;
  }

  hasNext() {
    return !!this._next;
  }

  next() {
    let n = (this._current = this._next);
    if (n) {
      const child = n.firstChild;
      if (child) {
        this._next = child;
      } else {
        let next = null;
        while (n !== this.root && !(next = n?.nextSibling)) {
          n = n?.parentNode || null;
        }
        this._next = next || null;
      }
    }
    return this._current;
  }

  detach() {
    this._current = this._next = this.root = null;
  }
}
