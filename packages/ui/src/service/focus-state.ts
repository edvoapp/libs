import { EdvoObj, WeakProperty } from '@edvoapp/util';
import * as VM from '../viewmodel';
import { globalContext } from '../viewmodel';

export interface FocusContext {
  selectionStart?: number | 'end';
  selectionEnd?: number | 'end';
  x?: number;
  y?: number;
  edge?: 'top' | 'bottom';
  trigger?: 'key' | 'pointer' | 'other';
  occasion?: 'create';
  selecting?: boolean;
}

export interface PendingFocus {
  match: (node: VM.Node) => boolean | VM.Node;
  context: FocusContext;
}

export interface FocusTarget extends VM.Node {}

export class FocusState extends EdvoObj {
  // Note: even though the goal of PLM-1906 was to make currentFocus non-nullable, we are going to make all WeakProperties nullable soon
  // Thus, I figure we may as well not bother with making currentFocus non-nullable, and instead of setting currentFocus to null, set it to the root node.
  // I did remove the null type and made sure that nothing was setting currentFocus to null to ensure that we are indeed following that rule. It just isn't committed.
  @WeakProperty
  currentFocus: FocusTarget | null = null;
  pendingFocus: PendingFocus | null = null;

  async setFocus(target: FocusTarget, context: FocusContext) {
    const currentFocus = this.currentFocus;

    this.currentFocus = target;
    target.onCleanup(() => {
      // The purpose of this is to ensure that if a node goes away while it is leaf-focused, we properly re-set the currentFocus
      // ideally it would be target.parentNode?.findClosest(n=>n.focusable) but this makes a lot of assumptions that aren't necessarily safe
      // to make about the existence of that target
      // thus, for the sake of fixing the behavior where things whose leaf-focused children get derendered are forever branch-focused, we just specify the root node
      target.onBlur();
      if (this.currentFocus) return;
      // if we haven't already focused on something else, then focus on the root node
      const root = globalContext().rootNode;
      if (root) void this.setFocus(root, context);
      else this.blur();
    });
    void target.waitForDomElement().then((el) => {
      if ('scrollIntoViewIfNeeded' in el) {
        // @ts-expect-error not widely supported?
        el.scrollIntoViewIfNeeded(false);
        // the argument is centerIfNeeded, and its default is true. we dont want that
      }
    });
    if (currentFocus?.alive && !currentFocus.contains(target)) {
      const commonParent = currentFocus.lowestCommonAncestor(target);
      currentFocus.onBlur(commonParent);
    }
    target.onFocus(context);
  }

  blur() {
    const currentFocus = this.currentFocus;
    if (!currentFocus) return;
    currentFocus?.onBlur?.();

    // Note: rootNode is technically nullable as it is a WeakProperty, but this should be OK
    this.currentFocus = globalContext().rootNode;

    // Blur the actual document.activeElement
    const { activeElement: domActiveElement } = document;
    if (domActiveElement && 'blur' in domActiveElement) {
      (domActiveElement as HTMLInputElement).blur();
    }
  }

  setPendingFocus(pendingFocus: PendingFocus) {
    this.trace(1, () => ['setPendingFocus', pendingFocus]);
    this.pendingFocus = pendingFocus;
  }

  checkActiveFocus() {
    const active = document.activeElement;
    const current = this.currentFocus?.domElement;

    if (active !== current) {
      globalContext().extBridge?.sendCurrentTabMessage('COMMAND/BLUR');
      current?.focus();
    }
  }

  checkPendingFocus(node: VM.Node): boolean {
    const pendingFocus = this.pendingFocus;

    if (!pendingFocus) return false;

    this.trace(2, () => ['checkPendingFocus', node.constructor.name, pendingFocus, node, pendingFocus?.match(node)]);

    const matchedNode = pendingFocus?.match(node);

    if (matchedNode instanceof VM.Node) {
      this.trace(1, () => ['checkPendingFocus', 'MATCHED', matchedNode]);
      void this.setFocus(matchedNode, pendingFocus.context);
    } else if (matchedNode === true) {
      this.trace(1, () => ['checkPendingFocus', 'MATCHED', node]);
      void this.setFocus(node, pendingFocus.context);
    } else {
      return false;
    }

    this.pendingFocus = null;
    return true;
  }
}
