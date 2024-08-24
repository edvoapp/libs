import { EdvoObj } from '@edvoapp/util';

type DiagRect = {
  x: number;
  y: number;
  height: number;
  width: number;
  label?: string;
};
export class DiagBox extends EdvoObj {
  el: HTMLDivElement;
  constructor(rect: DiagRect | null) {
    super();
    this.el = document.createElement('div');

    this.el.style.display = rect ? 'block' : 'none';
    this.el.style.position = 'fixed';
    this.el.style.pointerEvents = 'none';
    this.el.style.zIndex = '2147483647';
    this.el.style.backgroundColor = 'rgba(0,0,255,0.2)';
    if (rect) this.update(rect);

    document.body.appendChild(this.el);
  }
  update({ x, y, height, width, label }: DiagRect) {
    this.el.style.height = `${height}px`;
    this.el.style.width = `${width}px`;
    this.el.style.top = `${y}px`;
    this.el.style.left = `${x}px`;
    this.el.innerText = label ?? '';
  }
  ping(rect: DiagRect, warn = false) {
    this.update(rect);
    this.el.style.display = 'block';
    this.el.style.transition = 'none';
    this.el.style.opacity = '1';
    this.el.style.backgroundColor = warn ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,255,0.2)';

    setTimeout(() => {
      this.el.style.transition = 'opacity 1s linear 1s';
      this.el.style.opacity = '0';
    }, 0);
  }
  show() {
    this.el.style.display = 'block';
  }
  hide() {
    this.el.style.display = 'none';
  }
  protected cleanup() {
    super.cleanup();
    this.el.remove();
  }
  static momentary(args: DiagRect) {
    const box = new DiagBox(args);
    const ref = {};
    box.registerReferent(ref, '~box');
    setTimeout(() => {
      box.deregisterReferent(ref, '~box');
    }, 2000);
  }
}
