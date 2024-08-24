import equals from 'fast-deep-equal';
import { trxWrap, trxWrapSync } from '@edvoapp/common';
import * as VM from '../viewmodel';
import { equalsAny, equalsKey, FocusContext, keyMappings, PasteElement } from '..';
import { Behavior, DispatchStatus, EventNav } from '../service';
import { getWasmBindings } from '@edvoapp/util';

// We want to use precedence-based behavior dispatching
// Separation of concerns - We want to AVOID yield-based behavior dispatching

/**
 * The purpose of this behavior module is to implement all behaviors which are specific to a text field itself.
 * This means moving the caret, changing the selection, editing, deleting, etc.
 */
export class Text extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, node: VM.Node): DispatchStatus {
    const key = e.key.toLowerCase();
    const dk = eventNav.downKeys;
    const sortedDk = [...eventNav.downKeys].sort();
    const selectionState = eventNav.selectionState;
    const selection = selectionState.selection;

    const isText = node instanceof VM.TextField;

    // we need to return 'native' in order to handle paste, cut and copy

    const isCopy = equalsAny('meta-c');
    const isCut = equalsAny('meta-x');
    const isPaste = equalsAny('meta-v');
    const isSelectAll = equalsAny('meta-a');

    if (isPaste) return 'native'; // paste events should always return native

    if (isCopy || isCut || (!isText && isSelectAll)) {
      if (isText) {
        const txt = node.value.to_lossy_string();
        const { start: startOffset = 0, end: endOffset = 0 } = node.textRangeOffsets ?? {};
        const start = Math.min(startOffset, endOffset);
        const end = Math.max(startOffset, endOffset);
        const selection = txt.slice(start, end);
        if (selection === '') return 'decline'; // no-op on copy/cut if nothing is selected
      }
      return 'native';
    }

    // HANDLE SELECT ALL
    if (isText) {
      if (isSelectAll) {
        const textLength = node.value?.length;
        node.setTextSelection(0, textLength);
        return 'stop';
      } else if (equalsAny('home')) {
        const currentOffset = node.textRangeOffsets?.start;
        if (currentOffset !== 0) {
          node.setTextSelection(0, 0);
          return 'stop';
        } else {
          return 'decline';
        }
      } else if (equalsAny('end')) {
        const textLength = node.value?.length;
        const currentOffset = node.textRangeOffsets?.end;
        if (currentOffset != textLength) {
          node.setTextSelection(textLength, textLength);
          return 'stop';
        } else {
          return 'decline';
        }
      } else if (equalsAny('shift-home')) {
        const startOffset = node.textRangeOffsets?.start ?? 0;
        node.setTextSelection(startOffset, 0);
        return 'stop';
      } else if (equalsAny('shift-end')) {
        const textLength = node.value?.length ?? 0;
        const startOffset = node.textRangeOffsets?.start ?? 0;
        node.setTextSelection(startOffset, textLength);
        return 'stop';
      } else {
        //console.log(`detected keys: ${sortedDk}`);
      }
    }

    // We are NOT yielding, but we are declining because the text field won't accept this input
    if (dk.has('meta') || dk.has('control')) {
      return 'decline';
    }
    if (['esc', 'escape'].some((k) => dk.has(k) || key === k)) {
      // if (node.parentNode instanceof VM.TopicSearch) {
      //   return processTopicSearch(node.parentNode);
      // }
      return 'decline';
    }

    // COMPAT -- TODO: Remove this
    if (
      (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) &&
      !['Up', 'ArrowUp', 'Down', 'ArrowDown'].includes(e.key)
    ) {
      // if we're at the beginning already and we hit left, we don't want the native event
      if (e.target.selectionStart === 0 && e.target.selectionEnd === 0 && ['Left', 'ArrowLeft'].includes(e.key))
        return 'decline';
      return 'native';
    }

    if (!isText) return 'decline';

    if (e.key === 'Enter' && node.onEnter) {
      node.onEnter();
      return 'stop';
    }

    // SHIFT + ARROW KEY behaviors
    if (equals(['arrowleft', 'shift'], sortedDk)) {
      const { start: startOffset = 0, end: endOffset = 0 } = node.textRangeOffsets ?? {};
      if (endOffset - 1 >= 0) {
        const gr = node.value.nth_grapheme(endOffset - 1);
        const width = gr ? getWasmBindings().len_utf16_gr(gr) : 1;
        node.setTextSelection(startOffset, endOffset - width);
        selectionState.clear();
      }
      return 'stop';
    }

    if (equals(['arrowright', 'shift'], sortedDk)) {
      const { start: startOffset = 0, end: endOffset = 0 } = node.textRangeOffsets ?? {};
      const gr = node.value.nth_grapheme(endOffset);
      const width = gr ? getWasmBindings().len_utf16_gr(gr) : 1;
      const e = Number(endOffset) + width;
      console.log('MARK 2', e, width);
      if (e <= node.value.length) {
        node.setTextSelection(startOffset, e);
        selectionState.clear();
      }
      return 'stop';
    }

    if (equals(['arrowup', 'shift'], sortedDk)) {
      // HACK - this behavior should not care about selection state, but because it takes precedence over the selection,
      // and we can't currently compose the precedence in a way that says "if we have a selection then selection state behavior should take
      // precedence," this behavior needes to yield in the case a selection is present.
      if (selection.length) return 'decline';
      const offset = node.getPreviousLineOffset();

      const { start: startOffset = 0, end: endOffset = 0 } = node.textRangeOffsets ?? {};
      if (offset !== null) {
        node.setTextSelection(startOffset, offset);
        selectionState.clear();
        return 'stop';
      }

      if (endOffset > 0) {
        node.setTextSelection(startOffset, 0);
        return 'stop';
      }

      return 'decline';
    }
    if (equals(['arrowdown', 'shift'], sortedDk)) {
      const offset = node.getNextLineOffset();

      const { start: startOffset = 0, end: endOffset = 0 } = node.textRangeOffsets ?? {};
      if (offset !== null) {
        node.setTextSelection(startOffset, offset);
        selectionState.clear();
        return 'stop';
      }

      const textLength = node.value.length;
      if (endOffset < textLength) {
        node.setTextSelection(startOffset, textLength);
        return 'stop';
      }

      // I can't select another line. We've already selected the bottom line fully
      // Therefore we have to let the NEXT behaviors handle this
      return 'decline';
    }

    // Regular character handling
    if (!node.editable.value) return 'decline';

    // TODO: something smart, like hitting "Enter" while multiple selected or typing a key should
    // replace the selected nodes with whatever was typed, but we can handle that later
    if (key.length === 1) {
      if (key == '@' && node.allowedLozenges) {
        node.setLozengeCaret();
        return 'stop';
      }

      // TODO: re-enable.
      // if (key == '[') {
      //   node.setLozengeCaret();
      //
      //   const start = Math.min(startOffset, endOffset);
      //   node.setTextSelection(start, start);
      //
      //   return 'stop';
      // }

      // this is how we type new characters into the text field
      node.insertString(e.key);
      return 'stop';
    } else if (key === 'backspace') {
      if (node.removeCharacter() || !node.yieldIneffectiveKeys) {
        return 'stop';
      } else {
        return 'continue';
      }
    }

    // outline-item will handle bullet creating behavior
    // this will handle "Enter" that makes its way to the text field
    if (e.key === 'Enter' && !(node instanceof VM.OutlineItem)) {
      node.insertString('\n');
      return 'stop';
    }

    // Text navigation with arrow keys
    switch (e.key) {
      case 'ArrowLeft': {
        const { start: startOffset = 0, end: _endOffset = 0 } = node.textRangeOffsets ?? {};

        // Multi-selecting
        if (startOffset != _endOffset) {
          node.setTextSelection(startOffset, startOffset);
          return 'stop';
        }

        if (_endOffset === 0 || !node.editable.value) {
          // I'm already as far left as I can get. Let the next behavior look at this event
          // (behavior-precedence)
          return 'decline';
        }

        // need to get nth grapheme correctly and its width
        const gr = node.value.nth_grapheme(startOffset - 1);
        const width = gr ? getWasmBindings().len_utf16_gr(gr) : 1;
        const end = Math.max(_endOffset - width, 0);

        node.setTextSelection(end, end);

        return 'stop';
      }
      case 'ArrowRight': {
        const { start: startOffset = 0, end: _endOffset = 0 } = node.textRangeOffsets ?? {};

        // hitting right while text is selected should place the caret at the right end of the selection
        if (startOffset != _endOffset) {
          node.setTextSelection(_endOffset, _endOffset);
          return 'stop';
        }

        // need to get nth grapheme correctly and its width
        const gr = node.value.nth_grapheme(startOffset);
        const width = gr ? getWasmBindings().len_utf16_gr(gr) : 1;
        const end = Number(_endOffset) + width;
        const len = node.value.length;

        if (end > len) return 'decline';

        node.setTextSelection(end, end);

        return 'stop';
      }
      case 'ArrowUp': {
        const offset = node.getPreviousLineOffset();
        if (offset !== null) {
          node.setFocus({
            selectionStart: offset,
            selectionEnd: offset,
          });
          return 'stop';
        }
        return 'decline';
      }
      case 'ArrowDown': {
        const offset = node.getNextLineOffset();
        if (offset !== null) {
          node.setFocus({
            selectionStart: offset,
            selectionEnd: offset,
          });
          return 'stop';
        }
        return 'decline';
      }
      default:
        break;
    }
    return 'ignore';
  }

  // Cut, Copy and Paste handling
  handleCut(_eventNav: EventNav, e: ClipboardEvent, originNode: VM.Node): DispatchStatus {
    const emptyBullet = originNode.findClosest((n) => n instanceof VM.EmptyBullet && n);
    const textNode = originNode.findClosest((n) => n instanceof VM.TextField && n);
    this.trace(4, () => ['handleCut', e, originNode, emptyBullet, textNode]);

    if (textNode) {
      const txt = textNode.value.to_lossy_string();
      const { start: startOffset = 0, end: endOffset = 0 } = textNode.textRangeOffsets ?? {};
      const start = Math.min(startOffset, endOffset);
      const end = Math.max(startOffset, endOffset);
      // TODO(Frank): Test for txt with lozenges
      const selection = txt.slice(start, end);
      if (selection === '') return 'decline';
      e.clipboardData?.setData('text/plain', selection);
      e.preventDefault();
      // copying and then inserting an empty string is effectively the same thing as "cutting"
      textNode.insertString('');

      return 'stop';
    }
    if (emptyBullet || textNode) return 'native';
    return 'decline';
  }

  handleCopy(_eventNav: EventNav, e: ClipboardEvent, originNode: VM.Node): DispatchStatus {
    const emptyBullet = originNode.findClosest((n) => n instanceof VM.EmptyBullet && n);
    if (emptyBullet) return 'native';
    const textNode = originNode.findClosest((n) => n instanceof VM.TextField && n);
    this.trace(4, () => ['handleCopy', { e, originNode, emptyBullet, textNode }]);

    if (textNode) {
      const { start: startOffset = 0, end: endOffset = 0 } = textNode.textRangeOffsets ?? {};
      const start = Math.min(startOffset, endOffset);
      const end = Math.max(startOffset, endOffset);
      if (start === end) return 'decline';
      const selection = textNode.value.to_lossy_string().slice(start, end);
      e.clipboardData?.setData('text/plain', selection);
      e.preventDefault();
      return 'stop';
    }
    return 'decline';
  }

  handlePaste(eventNav: EventNav, e: ClipboardEvent, originNode: VM.Node): DispatchStatus {
    const { focusState } = eventNav;
    const emptyBullet = originNode.findClosest((n) => n instanceof VM.EmptyBullet && n);
    const textNode = originNode.findClosest((n) => n instanceof VM.TextField && n);
    const outlineItem = originNode.findClosest((n) => n instanceof VM.OutlineItem && n);
    const oldParent =
      outlineItem?.parentNode?.findClosest((n) => (n instanceof VM.OutlineItem || n instanceof VM.Outline) && n) ||
      emptyBullet?.findClosest((n) => n instanceof VM.Outline && n);
    const isInput = (e.target as HTMLElement).tagName === 'INPUT';
    // navigator.clipboard.read().then((clipboardItems) => {
    //   for (const clipboardItem of clipboardItems) {
    //     for (const type of clipboardItem.types) {
    //       if (type === 'text/html') {
    //         clipboardItem.getType(type).then((blob) =>
    //           blob.text().then((textHtml) => {
    //
    //           }),
    //         );
    //       }
    //     }
    //   }
    // });
    const parentVertex = oldParent?.vertex;
    const prevSibling = outlineItem?.prevSibling();
    const nextSibling = outlineItem?.nextSibling();
    const plainText = e.clipboardData?.getData('text/plain');
    const textHtml = e.clipboardData?.getData('text/html');
    this.trace(4, () => [
      'handlePaste',
      {
        e,
        originNode,
        emptyBullet,
        textNode,
        plainText,
        textHtml,
      },
    ]);
    if (textHtml) {
      const d = new DOMParser();
      const doc = d.parseFromString(textHtml, 'text/html');
      // TODO: refactor htmlToPasteElement because this is kinda goofy
      const el = doc.body.querySelector('ul')?.parentElement;
      if (el) {
        const rootPasteElement = PasteElement.htmlToPasteElement(el);

        if (rootPasteElement.validate() && parentVertex) {
          trxWrapSync((trx) => {
            const last = rootPasteElement.applyChildren(
              trx,
              parentVertex,
              prevSibling?.backref?.seq.value,
              nextSibling?.backref?.seq.value,
            );
            if (last) {
              focusState.setPendingFocus({
                match: (node) => node instanceof VM.OutlineItem && node.vertex === last,
                context: {},
              });
            }
          });
          return 'stop';
        }
      }
    }
    if (emptyBullet) {
      emptyBullet.handleCreate(plainText);
      return 'stop';
    }
    if (textNode && plainText) {
      textNode.insertString(plainText);
      return 'stop';
    }
    if (isInput) {
      // HACK
      return 'native';
    }
    return 'decline';
  }

  // TODO: Currently we are requiring that the bodyNode is focused in order to click "in" and set the caret.
  // Eventually we might want it to click directly in and set the caret/focus.
  pointerSelecting = false;
  startOffset: number | undefined = undefined;
  skipMouseUp = false;
  handleMouseDown(eventNav: EventNav, e: MouseEvent, node: VM.Node<VM.Node<any> | null>): DispatchStatus {
    const textNode = node.findClosest((n) => n instanceof VM.TextField && n);
    if (!textNode) return 'decline';
    if (!textNode.editable.value) return 'decline';
    const dk = eventNav.downKeys;

    // TODO: This is yielding behavior, which regardless of whatever pointerMoveMode, is bad, and we should change this.
    // Ideally we would conditionally reprioritize the behaviors that respond to the modifier keys or focus state
    // So as to adhere to the principle of preemption/first refusal
    if (node.context.modeObs.value === 'modkey') {
      // I'm not sure if this one is yielding or not. It's a little bit debatable
      // in modkey mode, Panning / Dragging is conditioned on a modifier key of some kind
      if (dk.has('meta') || dk.has('control')) return 'decline';
    } else {
      // HACK - this behavior module should only be thinking about text field stuff
      // The reason this is a hack is that we shouldn't be thinking about the topic space panning mode here in the text behavior
      // That's somebody else's responsibility

      // HACK - This is "Yielding" to another behavior
      // What we should do instead is re-order the behaviors to allow whatever behavior IS responsible for handling topic-space panning
      // To handle it first, so that we never get to this point in the first place.

      // >> This is a violation of separation of concerns <<
      // It's bad factorization to have unrelated subsystems thinking about each other.
      // What SHOULD happen is that the `Pan` behavior should see this event first and decide if it wants to handle it.
      // Then we only get to the Text behavior if it said `decline`

      // otherwise, we must yield in the case that we are inside a potentially draggable member
      // Why are we checking this here? Because the priority of our behaviors is currently wrong.
      const member = textNode.findClosest((n) => n instanceof VM.Member && n);
      if (member && !member.isFocused.value) return 'decline';
    }

    // When we click, we measure, update, and re-render:
    // 1. figure out what the offset is for this x/y position (mouse click) - Walk (DOM Nodes) backwards from range node/offset - summing offsets
    // * (THEN) update the caret/selection state: Bindings.TextPosition (this is stable until the click again or type a character)
    // * (causes) update the caret/selection OFFSETs (start: number, end:number) - THIS >>>ALSO<<< must be updated when the ContentState changes
    // * (causess) update the caret x/y/height + selection boxes
    //    2. figure out the x/y position for this offset (caret rendering) - Walk (VM Nodes) FOWARDS from first child's 0 offset until we - counting upward to get remainder offset
    //     2a. Create native dom Range object for the correct node + remainder offset
    //     2b. range.getClientBoundingRect (caret) / getClientsRects(selection) -- actually doing the above twice
    // * (causesss) the TextCaretAndSelectionWhatever to re-render, drawing the divs to illustrate Caret and Selection boxes

    // DOM tree
    // <div class="textField"> <- this.domElement
    //   <span1 class="text">The </span><div2 class="lozenge"><i><b>dog</b></i></div><span3 class="text"> jum|ped</span>
    // </div>

    // VM Tree
    // TextField (domEl=textEl):
    //    contentItems
    //       Text (domEl=span1)
    //       Lozenge (domEl=div2)
    //       Text (domEl=span3)
    const offset = textNode.offsetFromPoint(e.clientX, e.clientY);
    if (offset === null) {
      return 'decline';
    }
    void eventNav.focusState.setFocus(textNode, {
      selectionStart: offset,
      selectionEnd: offset,
    });

    this.pointerSelecting = true;
    this.startOffset = offset;
    this.skipMouseUp = true;

    // Tell EventNav that this behavior is in a special mode that should be prioritized
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseUp', 'handleMouseMove']);

    return 'stop';
  }
  handleDoubleClick(eventNav: EventNav, e: MouseEvent, originNode: VM.Node<VM.Node<any> | null>): DispatchStatus {
    const textNode = originNode.findClosest((n) => n instanceof VM.TextField && n);
    if (!textNode) return 'decline';

    const offset = textNode.offsetFromPoint(e.clientX, e.clientY);
    if (offset === null) {
      return 'decline';
    }

    const value = textNode.value;

    // search for the preceeding whitespace or offset 0
    // search for the succeeding whitespace or offset END

    let selectionStart = 0;
    let selectionEnd = value.length;

    const isWs = new RegExp(/\s/);
    for (let i = 0; i < value.length; i++) {
      // TODO(Frank): add ContentState.charAt(n)
      let whitespace = isWs.test(value.to_lossy_string().charAt(i));

      if (i < offset && whitespace) {
        selectionStart = Math.max(selectionStart, i + 1);
      }
      if (i > offset && whitespace) {
        selectionEnd = Math.min(selectionEnd, i);
      }
    }

    void eventNav.focusState.setFocus(textNode, {
      selectionStart,
      selectionEnd,
    });

    this.skipMouseUp = true;
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseMove']);

    return 'stop';
  }
  handleTripleClick(eventNav: EventNav, e: MouseEvent, originNode: VM.Node<VM.Node<any> | null>): DispatchStatus {
    const textNode = originNode.findClosest((n) => n instanceof VM.TextField && n);
    if (!textNode) return 'decline';

    void eventNav.focusState.setFocus(textNode, {
      selectionStart: 0,
      selectionEnd: textNode.value.length,
    });

    this.skipMouseUp = true;
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseMove']);

    return 'stop';
  }

  handleMouseMove(eventNav: EventNav, e: MouseEvent, node: VM.Node<VM.Node<any> | null>): DispatchStatus {
    const textNode = node.findClosest((n) => n instanceof VM.TextField && n);
    if (!textNode) return 'decline';
    if (!textNode.editable.value) return 'decline';
    if (!textNode.isFocused.value) {
      if (!this.pointerSelecting) return 'decline';
      // if we are moving the mouse over an unfocused node, that means we are doing a multi-select
      const focusedOutlineItem = eventNav.focusState.currentFocus?.findClosest((n) => n instanceof VM.OutlineItem && n);

      const thisOutlineItem = textNode.findClosest((n) => n instanceof VM.OutlineItem && n);
      // if no outline item, then decline -- this is just for multiselect bullet
      if (!focusedOutlineItem || !thisOutlineItem) return 'decline';
      // if outline item, then collapse and let someone else handle it!
      focusedOutlineItem.contentBody.textField.value?.setTextSelection(0, 0);
      eventNav.unsetGlobalBehaviorOverrides(this);
      return 'continue';
    } else {
      if (this.pointerSelecting) {
        const offset = textNode.offsetFromPoint(e.clientX, e.clientY);

        if (offset && offset !== this.startOffset && this.startOffset !== undefined) {
          textNode.setTextSelection(this.startOffset, offset);
        }

        this.skipMouseUp = true;
        // Make sure we receive the mouseUp
        eventNav.setGlobalBehaviorOverrides(this, ['handleMouseUp', 'handleMouseMove']);
      }
      // eventNav.selectionState.clear();
      return 'stop';
    }
  }

  handleMouseUp(eventNav: EventNav, e: MouseEvent, node: VM.Node<VM.Node<any> | null>): DispatchStatus {
    const skip = this.skipMouseUp;
    this.skipMouseUp = false;
    eventNav.unsetGlobalBehaviorOverrides(this);
    this.pointerSelecting = false;
    this.startOffset = undefined;

    if (skip) return 'stop';

    const textNode = node.findClosest((n) => n instanceof VM.TextField && n);
    if (!textNode) return 'decline';

    const context: FocusContext = node.getFocusContextForEvent(e);
    void eventNav.focusState.setFocus(textNode, context);

    return 'stop';
  }
}
