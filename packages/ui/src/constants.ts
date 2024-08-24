// --- z-index constants ---
const MAX_CSS_Z = 2_147_483_647;

// Reserved z-index for wgpu canvas.
// const WGPU_CANVAS_Z = 2_147_483_647; // hardcoded in CSS; .wgpu-surface

// Reserved range of z-indexes for alerts and overlays.
const ALERT_OVERLAY_SIZE = 1000;
const ALERT_OVERLAY_START = MAX_CSS_Z - ALERT_OVERLAY_SIZE;
export const ALERT_OVERLAY_Z = Array.from({ length: 1000 }, (_, index) => ALERT_OVERLAY_START + index);

// Reserved range of z-indexes for modals and panels.
const MODAL_PANEL_SIZE = 1000;
const MODAL_PANEL_START = ALERT_OVERLAY_START - MODAL_PANEL_SIZE;
export const MODAL_PANEL_Z = Array.from({ length: 1000 }, (_, index) => MODAL_PANEL_START + index);

export const DEPTH_MASK_Z = MODAL_PANEL_START - 1;
export const SELECTION_BOX_Z = DEPTH_MASK_Z - 1;
export const SELECTION_INDICATOR_Z = SELECTION_BOX_Z - 1;

// --- resize constants ---
export const RESIZE_THRESHOLD = 7;
