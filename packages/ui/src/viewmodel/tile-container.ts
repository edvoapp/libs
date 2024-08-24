import { BoundingBox, Node, NodeCA, OverrideBoundingBox } from './base';
import { EdvoObj, MemoizeOwned, Observable, ObservableList, OwnedProperty, WeakProperty } from '@edvoapp/util';
import { AppDesktop } from './app-desktop';
import { FullScreenable } from '../behaviors';

export class TileItem extends EdvoObj {
  @WeakProperty
  node: FullScreenable | null;

  constructor(
    /** The node we are tiling */
    node: FullScreenable,
    /** the BoundingBox it came from before tiling. We are passing it in by value so that we can keep the original state
     * (because node.clientRectObs will change as it is tiled) */
    public originBox: BoundingBox,
    public featured = false,
    /** The BoundingBox we want it to be during tiling */
    public box?: OverrideBoundingBox,
  ) {
    super();
    this.node = node;
  }
}

export class TileContainer extends Node<AppDesktop> {
  overflow = true;
  transparent = true;

  static new(args: NodeCA<AppDesktop>) {
    const me = new TileContainer(args);
    me.init();
    return me;
  }

  // We're really the uncle not the parent, but we don't need to tell everybody that
  get children(): Node[] {
    const c: Node[] = [];
    for (const i of this.tiledItems.value) {
      if (i.node && i.node.alive) c.push(i.node);
    }
    return c;
  }

  get clientRect(): BoundingBox | null {
    return this.parentNode.clientRect;
  }

  @MemoizeOwned()
  get visible() {
    const value = () => this.tiledItems.length > 0;

    const obs = new Observable<boolean>(value());
    const calc = () => obs.set(value());

    obs.managedSubscription(this.tiledItems, calc);
    return obs;
  }

  @OwnedProperty
  tiledItems = new ObservableList<TileItem>([]);
  // get items(): IObservable<FullScreenable[]> & Destroy {
  //   return this._items;
  // }

  @MemoizeOwned()
  get surroundViewEnabled() {
    return this.context.authService.currentUserVertexObs.mapObs<boolean>(
      (user) => user?.getFlagPropertyObs('tile-mode-surround-enabled').mapObs((v) => !!v) ?? false,
    );
  }

  remove(node: FullScreenable, animationDuration = 200) {
    const item = this.tiledItems.value.find((i) => i.node === node);
    if (!item) return;
    this.tiledItems.remove(item);
    this._didLayout = false;
    return this.animate(animationDuration);
  }

  clear(animationDuration: number = 200): void {
    this.cancelAnimation(); // Cancel any ongoing animation

    const animateBack = (
      node: FullScreenable,
      startBox: BoundingBox | OverrideBoundingBox,
      endBox: BoundingBox,
      duration: number,
      onComplete: () => void, // Callback function when animation is complete
    ) => {
      let startTime: number | null = null;

      const interpolate = (start: number, end: number, progress: number): number => {
        return start + (end - start) * progress;
      };

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsedTime = timestamp - startTime;
        const progress = Math.min(elapsedTime / duration, 1);

        const interpolatedBox = new OverrideBoundingBox({
          x: interpolate(startBox.x || 0, endBox.x, progress),
          y: interpolate(startBox.y || 0, endBox.y, progress),
          width: interpolate(startBox.width || 0, endBox.width, progress),
          height: interpolate(startBox.height || 0, endBox.height, progress),
          innerScale: 1,
          totalScale: 1, // Assuming totalScale should also interpolate if needed
        });

        node.setFullScreen(interpolatedBox);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          onComplete(); // Call the onComplete callback once the animation is finished
        }
      };

      requestAnimationFrame(step);
    };

    // Track completion of all animations
    let animationsCompleted = 0;
    const checkAllAnimationsCompleted = () => {
      animationsCompleted++;
      if (animationsCompleted === this.tiledItems.value.length) {
        // All animations are complete, now clear tiling
        this.tiledItems.value.forEach((item) => item.node?.setFullScreen(null));
        this.tiledItems.clear();
        this._didLayout = false;
      }
    };

    // Animate each item back to its original bounding box
    for (const item of this.tiledItems.value) {
      const startBox: BoundingBox | OverrideBoundingBox = item.box || item.originBox; // Use current override or original
      const endBox: BoundingBox = item.originBox; // Target is the original bounding box

      if (item.node) animateBack(item.node, startBox, endBox, animationDuration, checkAllAnimationsCompleted);
    }

    if (this.tiledItems.value.length === 0) {
      // Immediately clear if there are no items
      this.tiledItems.clear();
      this._didLayout = false;
    }
  }
  add(node: FullScreenable, animationDuration = 200) {
    const tileItem = new TileItem(node, node.clientRectObs.value, true);
    this.tiledItems.insert(tileItem);
    node.onCleanup(() => this.upgrade()?.tiledItems.remove(tileItem));
    return this.animate(animationDuration);
  }
  private _animationRequest?: ReturnType<typeof requestAnimationFrame>;
  cancelAnimation() {
    if (this._animationRequest) {
      cancelAnimationFrame(this._animationRequest);
      this._animationRequest = undefined;
      delete this._animationRequest;
    }
  }
  animate(animationDuration = 200): Promise<void> {
    // LATER TODO: can we use a generic animate function so we don't have to bring our own batteries here
    return new Promise<void>((resolve, reject) => {
      if (this._animationRequest) {
        return;
      }

      let startTime: number | null = null;
      const animateStep = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsedTime = timestamp - startTime;

        // I don't actually remember why it's calling layout multiple times, but each time it does,
        // it's calculating the final state
        this.layout();

        const blend = Math.min(elapsedTime / animationDuration, 1);
        for (const { node, box } of this.tiledItems.value) {
          if (box) {
            // otherwise we're not laid out
            let newBox = new OverrideBoundingBox({ ...box, blend });
            node?.setFullScreen(newBox);
          }
        }

        if (blend === 1) {
          this.cancelAnimation();
          resolve();
          return;
        }

        this._animationRequest = requestAnimationFrame(animateStep);
      };
      this._animationRequest = requestAnimationFrame(animateStep);
    });
  }

  async set(nodes: FullScreenable[], animate = true, animationDuration = 200): Promise<void> {
    this.clear();
    const tileItems: TileItem[] = [];

    for (const node of nodes) {
      const tileItem = new TileItem(node, node.clientRectObs.value, true);
      tileItems.push(tileItem);
      node.onCleanup(() => this.tiledItems.remove(tileItem));
    }

    // If surround view is enabled, then
    if (this.surroundViewEnabled.value) {
      const nonFeaturedMembers = this.parentNode.topicSpace.value?.topicSpace.members.value ?? [];
      for (const node of nonFeaturedMembers) {
        if (!nodes.includes(node) && node.visible.value) {
          const tileItem = new TileItem(node, node.clientRectObs.value);
          tileItems.push(tileItem);
          node.onCleanup(() => this.tiledItems.remove(tileItem));
        }
      }
    }

    this.tiledItems.replaceAll(tileItems);
    if (animate) return this.animate(animationDuration);
  }

  private _didLayout = false;
  layout() {
    if (this._didLayout) return;
    this._didLayout = true;
    this.layoutMulti();
  }
  layoutMulti() {
    let clientRect = this.clientRect;
    const headerHeight = this.parentNode.header.heightObs.value - 1; // -1 to prevent overlap with header border
    if (!clientRect) return;

    // TODO: shrink by different amounts x/y
    clientRect = clientRect.shrink_sides(0, 45, 0, this.surroundViewEnabled.value ? 50 : 0);

    const center = clientRect.center;
    const gap = 10;

    for (const myItem of this.tiledItems.value) {
      if (myItem.featured) continue;

      const myCenter = myItem.originBox.center;

      const aspectRatio = myItem.originBox.width / myItem.originBox.height;
      let height = 80,
        width = 80;
      if (aspectRatio > 1) {
        height = height / aspectRatio;
      } else {
        width = width * aspectRatio;
      }

      let newX, newY;

      // Adjust for gap and check if myItem is below clientRect.bottom
      if (myCenter.y + height / 2 + gap > clientRect.bottom) {
        newX = myCenter.x - width / 2;
        newY = clientRect.bottom - height / 2; // Align with bottom edge with gap
      } else {
        if (myCenter.x < center.x) {
          newX = clientRect.left + gap;
        } else {
          newX = clientRect.right - width - gap;
        }
        newY = myCenter.y - height / 2;
      }

      // Check to prevent newX from going outside clientRect due to gap adjustments
      newX = Math.max(clientRect.left, Math.min(newX, clientRect.right - width));

      // Ensure newY does not go above clientRect top
      newY = Math.max(clientRect.top, newY);

      myItem.box = new OverrideBoundingBox({
        x: newX,
        y: newY,
        width,
        height,
        innerScale: 1,
        totalScale: 1 / 4,
      });
    }

    let limit = 10000;
    let go = true;
    while (limit-- > 0 && go) {
      go = false;
      // less-shitty algorithm
      for (const myItem of this.tiledItems.value) {
        if (!myItem.featured) continue;

        const { box, originBox: myOriginBox } = myItem;
        const myBox = box ? myOriginBox.compose(box) : myOriginBox.clone();
        const { left, right, bottom, height, width } = myBox;

        const top = clientRect.top + headerHeight;

        // Figure out how much room we have until we hit the sides
        let maxRoomL = Math.max(0, left - clientRect.left);
        let maxRoomT = Math.max(0, top - (clientRect.top + headerHeight));
        let maxRoomR = Math.max(0, clientRect.right - right);
        let maxRoomB = Math.max(0, clientRect.bottom - bottom);

        let roomL = maxRoomL;
        let roomT = maxRoomT;
        let roomR = maxRoomR;
        let roomB = maxRoomB;

        for (const otherItem of this.tiledItems.value) {
          const { box: otherBox, originBox: otherOriginBox } = otherItem;
          if (myOriginBox === otherOriginBox) continue;

          const otherCBox = otherBox ? otherOriginBox.compose(otherBox) : otherOriginBox;

          roomT = Math.min(roomT, myBox.intersectWithMargin(otherCBox, { t: 2 }) ? 0 : 1);
          roomL = Math.min(roomL, myBox.intersectWithMargin(otherCBox, { l: 2 }) ? 0 : 1);
          roomR = Math.min(roomR, myBox.intersectWithMargin(otherCBox, { r: 2 }) ? 0 : 1);
          roomB = Math.min(roomB, myBox.intersectWithMargin(otherCBox, { b: 2 }) ? 0 : 1);
        }

        if (roomL > 0 || roomT > 0 || roomR > 0 || roomB > 0) {
          go = true; // keep goingggg

          const changeX = roomL ? -1 : 0;
          const changeY = roomT ? -1 : 0;
          const changeW = (roomR ? 1 : 0) - changeX;
          const changeH = (roomB ? 1 : 0) - changeY;

          myItem.box = new OverrideBoundingBox({
            x: left + changeX,
            y: top + changeY,
            width: width + changeW,
            height: height + changeH,
            innerScale: 1,
            totalScale: 1,
          });
        }
      }
    }
  }
}
