import { MarginManager } from './margin-manager';
import { EdvoObj, Observable, OwnedProperty } from '@edvoapp/util';

export class WhitespaceRegion extends EdvoObj {
  @OwnedProperty
  active = new Observable(false);
  constructor(readonly rect: DOMRectReadOnly) {
    super();
  }
}

// ref: https://stackoverflow.com/questions/1145850/how-to-get-height-of-entire-document-with-javascript
function getDocumentHeight() {
  const body = document.body;
  const html = document.documentElement;

  return Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
}

function getDocumentWidth() {
  const body = document.body;
  const html = document.documentElement;

  return Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
}

export class WhitespaceReservation extends EdvoObj {
  constructor(readonly rect: DOMRect, readonly region: WhitespaceRegion) {
    super();
  }
  protected cleanup() {
    // TODO - implement de-reservation
    super.cleanup();
  }
}

export class WhitespaceManager {
  regions: WhitespaceRegion[] = [];
  constructor() {
    this.detectWhitespaceRegions();
  }
  detectWhitespaceRegions() {
    // I detect nothing
  }
  applyDefaultRegion(marginManager: MarginManager) {
    const left = getDocumentWidth() - 140;
    const height = getDocumentHeight();
    const region = new WhitespaceRegion(new DOMRect(left, 0, 140, height));

    region.active.subscribe(() => {
      if (region.active.value) {
        // re-squish with right 140
        marginManager.setRight(140);
      } else {
        // re-squish with right 0
        marginManager.setRight(0);
      }
    });
    this.regions.push(region);
  }
  reserve({ height, top }: { height: number; top: number }): WhitespaceReservation {
    // TODO - implement space usage per each region, rollover to other regions, region eviction
    // For now we're just going to use the first region, and assign a DOMRect without worrying about overlaps
    const region = this.regions[0];
    const rr = region.rect;
    const rect = new DOMRect(rr.left, top, rr.width, height);

    // HACK
    region.active.set(true);
    const reservation = new WhitespaceReservation(rect, region);

    return reservation;
  }
}
