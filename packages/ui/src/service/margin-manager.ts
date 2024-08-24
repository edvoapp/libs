import { EdvoObj, Observable, OwnedProperty } from '@edvoapp/util';

export class MarginManager extends EdvoObj {
  left = 0;
  right = 0;
  initialMarginRight: string;
  initialTransform: string;
  initialTransformOrigin: string;
  @OwnedProperty
  readonly edvoContainer: Observable<HTMLElement | null>;
  constructor(args: { edvoContainer: Observable<HTMLElement | null> }) {
    super();
    this.edvoContainer = args.edvoContainer;
    this.initialTransform = document.body.style.transform;
    this.initialTransformOrigin = document.body.style.transformOrigin;
    this.initialMarginRight = document.body.style.marginRight;
    window.addEventListener('resize', this.squish);
  }
  setLeft(left: number) {
    this.left = left;
    this.squish();
  }
  setRight(right: number) {
    this.right = right;
    this.squish();
  }
  squish = () => {
    const leftWidth = this.left;
    const rightWidth = this.right;
    const totalBorrowedWidth = leftWidth + rightWidth;
    const viewportWidth = window.innerWidth;

    // A lot of websites react badly when the browser is narrow and you borrow space from them.

    // There are two factors that matter:
    // 1. Are we stealing a large fraction of the window width?
    // 2. Are we below a critical threshold where website formatting is more likely to get whacky?
    let scaleFactor: number;
    const newContentWidth = viewportWidth - totalBorrowedWidth;
    const percentBorrowed = totalBorrowedWidth / viewportWidth;

    if (newContentWidth < 700) {
      // We're below a critical threshold where margin pressure is totally inappropriate.
      // ONLY Scale
      scaleFactor = 1;
    } else if (newContentWidth < 1000) {
      // Split scale and margin pressure
      scaleFactor = 0.5 * percentBorrowed;
    } else {
      scaleFactor = 0;
    }

    const scaleX = 1 - (totalBorrowedWidth * scaleFactor) / viewportWidth;

    // A little Y-distortion helps with readability initially, but this effect
    // reverses as the distortion gets more severe.
    // Use scaleFactor to determine the level of Y-distortion
    // The more we use scaling, the less we can get away with Y-distortion
    // TODO - validate this logic
    const scaleY = (scaleFactor + scaleX) / (1 + scaleFactor);

    const descaleX = 1 / scaleX;
    const unsquishedX = totalBorrowedWidth - (1 - scaleX) * viewportWidth;

    const container = this.edvoContainer.value;
    if (container) {
      Object.assign(container.style, {
        marginLeft: leftWidth,
        marginRight: rightWidth,
      });
    }

    Object.assign(document.body.style, {
      transformOrigin: 'left top',
      transform: `scale(${scaleX}, ${scaleY}) translateX(${leftWidth * descaleX}px)`,
      marginRight: `${Math.round(unsquishedX * descaleX)}px`,
    });
  };
  protected cleanup() {
    const container = this.edvoContainer.value;
    if (container) {
      Object.assign(container.style, { marginLeft: 0, marginRight: 0 });
    }
    Object.assign(document.body.style, {
      transform: this.initialTransform,
      marginRight: this.initialMarginRight,
      transformOrigin: this.initialTransformOrigin,
    });
    window.removeEventListener('resize', this.squish);
    super.cleanup();
  }
}
