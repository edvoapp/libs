import { DiagBox } from '../../utils';
import { height, width } from 'dom-helpers';
import { warn } from 'logrocket';

export interface Position {
  x: number;
  y: number;
}

export type BoxArgs = {
  x: number;
  y: number;
  height: number;
  width: number;
  // MY scale within my coordinate space
  innerScale?: number;
  // The composite scale within all coordinate spaces
  totalScale?: number;
};

// nitpick: technically nw is not cardinal
type CardinalDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
export class BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly width: number;
  readonly innerScale: number;
  readonly totalScale: number;

  static fromDomRect(rect: DOMRect): BoundingBox {
    return new BoundingBox({
      x: rect.x,
      y: rect.y,
      height: rect.height,
      width: rect.width,
    });
  }

  static ZERO = new BoundingBox({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
  });
  constructor({ x, y, height, width, innerScale, totalScale }: BoxArgs) {
    this.x = x;
    this.y = y;
    this.height = height;
    this.width = width;
    this.innerScale = innerScale ?? totalScale ?? 1;
    this.totalScale = totalScale ?? innerScale ?? 1;
  }

  el?: HTMLDivElement;

  draw() {
    this.el ??= document.createElement('div');
    this.el.style.display = 'block';
    this.el.style.position = 'fixed';
    this.el.style.pointerEvents = 'none';
    this.el.style.zIndex = '2147483647';
    this.el.style.backgroundColor = 'rgba(0,0,255,0.2)';
    this.el.style.height = `${this.height}px`;
    this.el.style.width = `${this.width}px`;
    this.el.style.top = `${this.y}px`;
    this.el.style.left = `${this.x}px`;
    document.body.appendChild(this.el);
  }

  undraw() {
    this.el?.remove();
    delete this.el;
  }

  ping() {
    this.draw();
    if (!this.el) return;
    this.el.style.display = 'block';
    this.el.style.transition = 'none';
    this.el.style.opacity = '1';
    this.el.style.backgroundColor = 'rgba(0,0,255,0.2)';

    setTimeout(() => {
      if (!this.el) return;
      this.el.style.transition = 'opacity 1s linear 1s';
      this.el.style.opacity = '0';
    }, 0);
  }
  get top() {
    return this.y;
  }

  get left() {
    return this.x;
  }

  get right() {
    return this.x + this.width;
  }

  get bottom() {
    return this.y + this.height;
  }

  get innerWidth() {
    return this.width / this.innerScale;
  }
  get innerHeight() {
    return this.height / this.innerScale;
  }

  get xyhw_rounded() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      height: Math.round(this.height),
      width: Math.round(this.width),
    };
  }

  reveal() {
    DiagBox.momentary(this);
  }

  debug() {
    return `${this.x.toFixed(0)}, ${this.y.toFixed(0)} ${this.width.toFixed(0)}x${this.height.toFixed(
      0,
    )} @ ${this.totalScale.toFixed(4)}`;
  }
  /**
   * returns true if this box fully contains the other box
   * @param other
   */
  fullyContains(other: BoundingBox): boolean {
    return other.top >= this.top && other.bottom <= this.bottom && other.right <= this.right && other.left >= this.left;
  }

  intersects(other?: BoundingBox): boolean {
    if (!other) return false;

    return other.top < this.bottom && other.bottom > this.top && other.right > this.left && other.left < this.right;
  }

  intersectWithMargin(other: BoundingBox, { l, t, r, b }: { l?: number; t?: number; r?: number; b?: number }): boolean {
    return (
      other.top < this.bottom + (b ?? 0) &&
      other.bottom > this.top - (t ?? 0) &&
      other.right > this.left - (l ?? 0) &&
      other.left < this.right + (r ?? 0)
    );
  }

  directionallyIntersects(other: BoundingBox, margin?: number): CardinalDirection | false {
    const n = other.bottom > this.top ? 'n' : '';
    const s = other.top < this.bottom ? 's' : '';
    const w = other.right > this.left ? 'w' : '';
    const e = other.left < this.right ? 'e' : '';
    if (!(n || s || w || e)) return false;
    return `${n}${s}${w}${e}` as CardinalDirection;
  }

  scale(scale: number): BoundingBox {
    return new BoundingBox({
      x: this.x * scale,
      y: this.y * scale,
      height: this.height * scale,
      width: this.width * scale,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  unscale(scale: number): BoundingBox {
    return new BoundingBox({
      x: this.x / scale,
      y: this.y / scale,
      height: this.height / scale,
      width: this.width / scale,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  shrink_centered(n: number): BoundingBox {
    return new BoundingBox({
      x: this.x + n / 2,
      y: this.y + n / 2,
      height: this.height - n,
      width: this.width - n,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }
  shrink_xy(x: number, y: number): BoundingBox {
    return new BoundingBox({
      x: this.x + x / 2,
      y: this.y + y / 2,
      height: this.height - y,
      width: this.width - x,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }
  shrink_sides(left: number, top: number, right: number, bottom: number): BoundingBox {
    return new BoundingBox({
      x: this.x + left,
      y: this.y + top,
      width: this.width - (left + right),
      height: this.height - (top + bottom),
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  get center(): Position {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    };
  }

  // foo(other: BoundingBox): BoundingBox {
  //   let left = other.left - this.left;
  //   let top = other.top - this.top;

  //   // diff the right nad
  //   let width = this.width + Math.min(0, other.right - this.right);
  //   let height = this.height + Math.min(0, other.bottom - this.bottom);

  //   return new BoundingBox(left, top, height, width);
  // }
  intersect(other: BoundingBox): BoundingBox | false {
    let x = Math.max(other.x, this.x);
    let y = Math.max(other.y, this.y);

    let right = Math.min(other.right, this.right);
    let bottom = Math.min(other.bottom, this.bottom);

    // inversion (or equality) of the start/end means nonintersection
    if (x >= right || y >= bottom) {
      return false;
    }

    return new BoundingBox({
      x,
      y,
      height: bottom - y,
      width: right - x,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  clone() {
    return new BoundingBox({
      x: this.x,
      y: this.y,
      height: this.height,
      width: this.width,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  union(other: BoundingBox): BoundingBox {
    let x = Math.min(other.x, this.x);
    let y = Math.min(other.top, this.top);
    let right = Math.max(other.right, this.right);
    let bottom = Math.max(other.bottom, this.bottom);

    return new BoundingBox({
      x,
      y,
      height: bottom - y,
      width: right - x,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  intersection(other: BoundingBox): BoundingBox {
    let x = Math.max(other.x, this.x);
    let y = Math.max(other.top, this.top);
    let right = Math.min(other.right, this.right);
    let bottom = Math.min(other.bottom, this.bottom);

    return new BoundingBox({
      x,
      y,
      height: bottom - y,
      width: right - x,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  map_origin(origin: BoundingBox): BoundingBox {
    return new BoundingBox({
      x: this.x - origin.x,
      y: this.y - origin.y,
      height: this.height,
      width: this.width,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  shift({ x, y }: { x: number; y: number }): BoundingBox {
    return new BoundingBox({
      x: this.x + x,
      y: this.y + y,
      height: this.height,
      width: this.width,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }

  compose(thing: Position | OverrideBoundingBox | null) {
    if (thing === null) return this;
    let x: number | undefined = undefined,
      y: number | undefined = undefined,
      width: number | undefined = undefined,
      height: number | undefined = undefined,
      innerScale: number | undefined = undefined,
      totalScale: number | undefined = undefined,
      blend = 1;

    if (thing instanceof OverrideBoundingBox) {
      ({ x, y, width, height, innerScale, totalScale, blend } = thing);
    } else {
      ({ x, y } = thing);
    }
    return new BoundingBox({
      x: lerp(this.x, x ?? this.x, blend),
      y: lerp(this.y, y ?? this.y, blend),
      height: lerp(this.height, height ?? this.height, blend),
      width: lerp(this.width, width ?? this.width, blend),
      innerScale: lerp(this.innerScale, innerScale ?? this.innerScale, blend),
      totalScale: lerp(this.totalScale, totalScale ?? this.totalScale, blend),
    });
  }

  exactlyEquals(other: BoundingBox): boolean {
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.width === other.width &&
      this.height === other.height &&
      this.innerScale === other.innerScale &&
      this.totalScale === other.totalScale
    );
  }

  // Compares `this` bounding box to the `other` bounding box and
  // returns `true` if every value is within `epsilon` of the other.
  compare(other: BoundingBox, epsilon = 0.0001): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon &&
      Math.abs(this.width - other.width) < epsilon &&
      Math.abs(this.height - other.height) < epsilon &&
      Math.abs(this.innerScale - other.innerScale) < epsilon &&
      Math.abs(this.totalScale - other.totalScale) < epsilon
    );
  }

  transform(x: number, y: number, width: number, height: number): BoundingBox {
    return new BoundingBox({
      x,
      y,
      width,
      height,
      innerScale: this.innerScale,
      totalScale: this.totalScale,
    });
  }
}

interface OverrideBoundingBoxArgs {
  x?: number;
  y?: number;
  height?: number;
  width?: number;
  innerScale?: number;
  totalScale?: number;
  blend?: number;
}

export class OverrideBoundingBox {
  readonly x?: number;
  readonly y?: number;
  readonly height?: number;
  readonly width?: number;
  readonly innerScale: number;
  readonly totalScale: number;
  readonly blend: number;

  constructor({ x, y, height, width, blend = 1, innerScale = 1, totalScale = 1 }: OverrideBoundingBoxArgs) {
    this.x = x;
    this.y = y;
    this.height = height;
    this.width = width;
    this.innerScale = innerScale;
    this.totalScale = totalScale;
    this.blend = blend;
  }

  get top() {
    return this.y;
  }

  get left() {
    return this.x;
  }

  get right() {
    if (this.x === undefined || this.width === undefined) return undefined;
    return this.x + this.width;
  }

  get bottom() {
    if (this.y === undefined || this.height === undefined) return undefined;
    return this.y + this.height;
  }

  clone() {
    return new OverrideBoundingBox({
      x: this.x,
      y: this.y,
      height: this.height,
      width: this.width,
      blend: this.blend,
    });
  }

  isContainedBy(other: BoundingBox) {
    const { top, bottom, right, left } = this;
    if (top === undefined || bottom === undefined || right === undefined || left === undefined) {
      return false;
    }
    return other.top < top && other.bottom > bottom && other.right > right && other.left < left;
  }

  directionallyIntersects(other: OverrideBoundingBox): CardinalDirection | false {
    const { top, bottom, right, left } = this;
    const { top: oTop, bottom: oBottom, right: oRight, left: oLeft } = other;
    if (
      top === undefined ||
      bottom === undefined ||
      right === undefined ||
      left === undefined ||
      oTop === undefined ||
      oBottom === undefined ||
      oRight === undefined ||
      oLeft === undefined
    ) {
      return false;
    }

    const n = oBottom > top ? 'n' : '';
    const s = oTop < bottom ? 's' : '';
    const w = oRight > left ? 'w' : '';
    const e = oLeft < right ? 'e' : '';
    if (!(n || s || w || e)) return false;
    return `${n}${s}${w}${e}` as CardinalDirection;
  }
}

const lerp = (a: number, b: number, ratio: number) => a * (1 - ratio) + b * ratio;
