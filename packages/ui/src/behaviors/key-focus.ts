import { Behavior, DispatchStatus, EventNav, FocusContext, FocusTarget } from '../service';
import * as VM from '../viewmodel';

export class KeyFocus extends Behavior {
  getFocusTarget(target: FocusTarget, prevFocus: FocusTarget | null, bias: 'parent' | 'child'): VM.Node | null {
    if (bias === 'parent') {
      return target.closestParent((n) => n.focusable) ?? null;
    } else {
      // check if we are focusing into an outline, then focus on the last outlineItem textfield

      // TODO: consider what's more elegant: findChild with a prefilter, or a different
      // recursive find that calls the closure with a list
      const focusTarget =
        target.findChild(
          (n) => n.focusable && n,
          (parent, children) => (parent.focusChildOrdering == 'forward' ? children : children.reverse()),
        ) ?? null;

      return focusTarget;
    }
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const { key } = e;
    const { focusState } = eventNav;
    const currentFocusedNode = focusState.currentFocus;

    if (key === 'Escape') {
      if (!currentFocusedNode) return 'continue';
      const target = this.getFocusTarget(originNode, currentFocusedNode, 'parent');
      if (target) {
        void focusState.setFocus(target, {});
      } else {
        focusState.blur();
      }
      return 'stop';
    }

    if (key === 'Enter') {
      if (!currentFocusedNode) return 'continue';
      const target = this.getFocusTarget(originNode, currentFocusedNode, 'child');
      if (target) {
        void focusState.setFocus(target, {});
      }

      return 'stop';
    }

    let focusNode: VM.Node | null = null;
    let ctx: FocusContext | null = null;
    if (['Up', 'ArrowUp'].includes(key)) {
      const nodeAndCtx = originNode.upwardNode();
      if (nodeAndCtx) {
        focusNode = nodeAndCtx.node;
        ctx = sanitizeFocusContext(nodeAndCtx.ctx, {
          x: originNode.focusCoords?.x ?? 0,
          edge: 'bottom',
          trigger: 'key',
        });
      }
    }
    if (['Down', 'ArrowDown'].includes(key)) {
      const nodeAndCtx = originNode.downwardNode();
      if (nodeAndCtx) {
        focusNode = nodeAndCtx.node;
        ctx = sanitizeFocusContext(nodeAndCtx.ctx, {
          x: originNode.focusCoords?.x ?? 0,
          edge: 'top',
          trigger: 'key',
        });
      }
    }

    if (['Left', 'ArrowLeft'].includes(key)) {
      const nodeAndCtx = originNode.leftwardNode();
      if (nodeAndCtx) {
        focusNode = nodeAndCtx.node;
        ctx = sanitizeFocusContext(nodeAndCtx.ctx, {
          selectionStart: 'end',
          selectionEnd: 'end',
          trigger: 'key',
        });
      }
    }

    if (['Right', 'ArrowRight'].includes(key)) {
      const nodeAndCtx = originNode.rightwardNode();
      if (nodeAndCtx) {
        focusNode = nodeAndCtx.node;
        ctx = sanitizeFocusContext(nodeAndCtx.ctx, {
          selectionStart: 0,
          selectionEnd: 0,
          trigger: 'key',
        });
      }
    }

    this.trace(4, () => ['KeyFocus', originNode, focusNode, ctx, key]);

    if (focusNode && ctx) {
      void focusState.setFocus(focusNode, ctx);
      return 'stop';
    }

    if (key === 'Backspace') {
      if (
        originNode instanceof VM.TextField &&
        originNode.parentNode instanceof VM.TopicSearch &&
        originNode.isEmpty()
      ) {
        const { focusState } = eventNav;
        focusState.blur();
        return 'stop';
      }
    }

    return 'decline';
  }
}

export const sanitizeFocusContext = (
  ctx: Omit<FocusContext, 'trigger' | 'edge' | 'selectin'> | undefined,
  { trigger, edge, selecting, ...defaults }: FocusContext,
): FocusContext => {
  return {
    ...(ctx ?? defaults),
    trigger,
    edge,
    selecting,
  };
};
