// the technical limitation of z-index for browsers
import { clamp } from '@edvoapp/util';

export const MAX_ZINDEX = 2_147_483_647;
export const ZINDEX_RANGE_SIZE = 1_000_000;

// reserve the upper 1 million for system-level things
export const MAX_SYSTEM_ZINDEX = MAX_ZINDEX - 1;
export const MIN_SYSTEM_ZINDEX = MAX_SYSTEM_ZINDEX - ZINDEX_RANGE_SIZE;
export const SYSTEM_ZINDEX_RANGE = [MIN_SYSTEM_ZINDEX, MAX_SYSTEM_ZINDEX];

export function clampSystemZIndex(val: number) {
  return clamp(MIN_SYSTEM_ZINDEX, MAX_SYSTEM_ZINDEX, val);
}

// reserve the next million for modals and dialogues
export const MAX_MODAL_ZINDEX = MIN_SYSTEM_ZINDEX - 1;
export const MIN_MODAL_ZINDEX = MAX_MODAL_ZINDEX - ZINDEX_RANGE_SIZE;
export const MODAL_ZINDEX_RANGE = [MIN_MODAL_ZINDEX, MAX_MODAL_ZINDEX];

export function clampModalZIndex(val: number) {
  return clamp(MIN_MODAL_ZINDEX, MAX_MODAL_ZINDEX, val);
}

// reserve the next million for things that are dragging
export const MAX_DRAGGABLE_ZINDEX = MIN_MODAL_ZINDEX - 1;
export const MIN_DRAGGABLE_ZINDEX = MAX_DRAGGABLE_ZINDEX - ZINDEX_RANGE_SIZE;
export const DRAGGABLE_ZINDEX_RANGE = [MIN_DRAGGABLE_ZINDEX, MAX_DRAGGABLE_ZINDEX];

export function clampDraggableZIndex(val: number) {
  return clamp(MIN_DRAGGABLE_ZINDEX, MAX_DRAGGABLE_ZINDEX, val);
}

// reserve the next million for other things
export const MAX_OTHER_ZINDEX = MIN_DRAGGABLE_ZINDEX - 1;
export const MIN_OTHER_ZINDEX = MAX_OTHER_ZINDEX - ZINDEX_RANGE_SIZE;
export const OTHER_ZINDEX_RANGE = [MIN_OTHER_ZINDEX, MAX_OTHER_ZINDEX];

export function clampOtherZIndex(val: number) {
  return clamp(MIN_OTHER_ZINDEX, MAX_OTHER_ZINDEX, val);
}

// reserve the bottom 1 million zindex range for misc things
export const MIN_ZINDEX = 1;
export const MIN_LOW_ZINDEX = MIN_ZINDEX + 1;
export const MAX_LOW_ZINDEX = MIN_LOW_ZINDEX + ZINDEX_RANGE_SIZE;
export const LOW_ZINDEX_RANGE = [MIN_LOW_ZINDEX, MAX_LOW_ZINDEX];

export function clampLowZIndex(val: number) {
  return clamp(MIN_LOW_ZINDEX, MAX_LOW_ZINDEX, val);
}

// anything else is fair game
export const MIN_USABLE_ZINDEX = MAX_LOW_ZINDEX + 1;
export const MAX_USABLE_ZINDEX = MIN_OTHER_ZINDEX - 1;
export const USABLE_ZINDEX_RANGE = [MIN_USABLE_ZINDEX, MAX_USABLE_ZINDEX];

export function clampUsableZIndex(val: number) {
  return clamp(MIN_USABLE_ZINDEX, MAX_USABLE_ZINDEX, val);
}
