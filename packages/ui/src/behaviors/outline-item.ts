import { Model, trxWrap, TrxRef, trxWrapSync } from '@edvoapp/common';
import { Guard, getWasmBindings, useUndoManager, ObservableList } from '@edvoapp/util';
import { ActionGroup, Behavior, DispatchStatus, EventNav } from '../service';
import { insertSeq } from '../utils/seq';
import * as VM from '../viewmodel';

// type SplitArgs = {
//   subject: Model.Vertex;
//   textareaElement: HTMLTextAreaElement;
//   parent: Model.Vertex;
//   currentSeq?: number;
//   prevSeq?: number;
//   nextSeq?: number;
//   hasChildren: boolean;
// };

// TODO: consider whether backspace unlinking is fundamentally different from Behaviors.UnlinkItem
//       This would require eligibility determination for unlinking in explicit vs implicit contexts.
//       Eg:
//          * using the context menu option OR pressing backspace with several OutlineItems selected = explicit. JUST DO IT
//             vs
//          * pressing the backspace key while inside a BodyContent = implicit. SOMETIMES do it
//
//       This is primarily a question of selection vs focus
export class OutlineItem extends Behavior {
  private async doDelete(nodes: VM.OutlineItem[]) {
    if (nodes.length === 0) return;

    const nodesToArchive = nodes.filter((node) => node.backref?.editable.value);
    let archived = new ObservableList<
      Model.Vertex | Model.Backref | Model.Edge | Model.Property | Model.TimelineEvent
    >().leak();

    useUndoManager().add_action(
      () => {
        // DO
        trxWrapSync((trx: TrxRef) => {
          nodesToArchive.forEach((node) => {
            archived.insert(node.backref);
            node.backref.archive(trx);
          });
        });
      },
      () => {
        // UNDO
        trxWrapSync((trx: TrxRef) => {
          archived.forEach((node) => node.unarchive(trx));
        });
      },
    );
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof VM.OutlineItem && n);
    if (!node) return 'decline';

    const textNode = node.contentBody.textField.value;

    if (!textNode) return 'decline';

    // If the textnode or its topic search are not focused,
    // the textnode will be focus
    if (!(eventNav.focusState.currentFocus instanceof VM.TextField)) {
      eventNav.focusState.setFocus(textNode, {});
    }

    const { key } = e;
    const { focusState } = eventNav;

    let prevSibling = node.prevSibling();
    let nextSibling = node.nextSibling();
    let oldParent = node.parentNode.closest((x) => x instanceof VM.OutlineItem || x instanceof VM.Outline) as
      | VM.OutlineItem
      | VM.Outline
      | null;
    let firstChild = node.firstChildOutlineItem();
    let prevCousinNthRemoved = prevSibling?.deepestLastChild();
    const parentVertex = oldParent?.vertex;

    const { selectionStart, selectionEnd } = textNode;
    const contentState = textNode.value;
    const text = contentState.to_lossy_string();
    const beforeText = text.substring(0, selectionStart);
    const afterText = text.substring(selectionEnd);

    switch (key) {
      case 'Enter': {
        // Make a new bullet

        if (!parentVertex) return 'stop';
        // on enter, we should handle submission
        const prevSeq = prevSibling?.seq;
        const currentSeq = node.seq;
        const nextSeq = nextSibling?.seq;

        const appearanceType = node?.appearance.value?.type ?? 'bullet';

        trxWrapSync((trx) =>
          Guard.while(Model.Vertex.create({ trx }), (newBullet) => {
            newBullet.createProperty({
              trx,
              role: ['appearance'],
              contentType: 'application/json',
              initialString: JSON.stringify({
                type: appearanceType,
              }),
            });

            let seq: number;
            let newNodeBodyText = null;
            if (firstChild || (beforeText === '' && afterText !== '')) {
              // This bullet has a child, or we are at the beginning of the bullet that has text.
              // therefore keep rightmost text, and put the new bullet before this bullet
              seq = insertSeq(prevSeq, currentSeq);

              // Text field of the current bullet

              // The quick fox
              // remove beforeText + selection from this bullet
              // textField.load().then(() =>{
              textNode.removeRange(0, selectionEnd);

              textNode.setTextSelection(0, 0);
              // });
              newNodeBodyText = beforeText;

              // Leave the current node focused
            } else {
              // This bullet has no children, therefore the new bullet follows it
              seq = insertSeq(currentSeq, nextSeq);

              // remove selection + afterText from this bullet
              const removeLen = contentState.length - selectionStart;
              if (removeLen > 0) {
                textNode.removeRange(selectionStart, removeLen);
              }
              newNodeBodyText = afterText;

              // Focus the new node
              focusState.setPendingFocus({
                match: (node) =>
                  node instanceof VM.TextField &&
                  node.parentNode.parentNode instanceof VM.BodyContent &&
                  node.parentNode.parentNode.vertex === newBullet
                    ? node
                    : false,
                context: { selectionStart: 0 },
              });
            }

            if (newNodeBodyText !== null) {
              newBullet.createBodyTextProperty({
                trx,
                initialText: newNodeBodyText,
                privs: originNode.projectedPrivileges(),
              });
            }

            // We may or may not have rendered the new OutlineItem already
            newBullet.createEdge({
              trx,
              target: parentVertex,
              role: ['category-item'],
              seq,
              meta: {},
            });
          }),
        );

        // selectionState.stopSelection();
        return 'stop';
      }
      case 'Backspace': {
        // Consider removing this and updating Unlink behavior to do it instead
        const selectionState = eventNav.selectionState;
        const focusState = eventNav.focusState;
        const selection = selectionState.selection.value;
        if (selection.length) {
          const toDelete = selection
            .reduce((acc, m) => {
              const outlineItem = m.closestInstance(VM.OutlineItem);
              if (outlineItem) acc.push(outlineItem);
              return acc;
            }, [] as VM.OutlineItem[])
            .sort((a, b) => a.seq - b.seq);

          const [start] = toDelete;

          const startPrevSibling = start?.prevSibling();
          const startParent = start?.closestInstance(VM.OutlineItem);

          void this.doDelete(toDelete);
          const elementToFocus = startPrevSibling || startParent;

          if (elementToFocus?.alive) {
            const focusableTarget = elementToFocus.findChild((n) => n.focusable && n);
            void focusState.setFocus(focusableTarget ?? elementToFocus, {
              selectionStart: 'end',
              selectionEnd: 'end',
            });
          }
          return 'stop';
        } else if (textNode.textRangeOffsets) {
          const range = textNode.textRangeOffsets;
          if (range.length > 0 || range.start > 0) return 'decline';
          if (!textNode.isEmpty()) {
            // TODO: handle this case
            return 'stop';
          }
          if (firstChild) return 'stop';

          // TODO: handle when there
          void this.doDelete([node]);
          const elementToFocus = prevCousinNthRemoved || prevSibling || oldParent;

          if (elementToFocus) {
            const focusableTarget = elementToFocus.findChild((n) => n.focusable && n);
            void focusState.setFocus(focusableTarget ?? elementToFocus, {
              selectionStart: 'end',
              selectionEnd: 'end',
            });
          }
          return 'stop';
        }
        return 'continue';
      }
      case '|':
      case '-':
      case '*':
      case ']': {
        // Appearance shortcut

        const t = beforeText.replace(' ', '');

        let setAppearance: 'checkbox' | 'bullet' | 'plain' | 'highlight' | undefined;

        if (t === '[' && key === ']') setAppearance = 'checkbox';
        if (t === '' && ['*', '-'].includes(key)) setAppearance = 'bullet';
        if (t === '' && key === '|') setAppearance = 'plain';

        if (setAppearance) {
          void node.vertex.setJsonPropValues<VM.OutlineItemAppearance>('appearance', { type: setAppearance }, null);
          // HACK - move this to BodyContent.applyFocusContext
          const el = textNode.domElement as HTMLTextAreaElement | null;
          if (el) {
            el.selectionStart = 0;
            el.selectionEnd = 0;
          }

          // The appearance shortcut ONLY works at the front of the textfield
          // therefore our caret must be AFTER all shortcut characters, and we
          // can remove everything before the caret
          if (selectionEnd > 0) {
            // We only need to remove text IF there was a leading space or this is a close-squarebrace ]
            // Because otherwise this shortcut is being triggered by a single keydown which the text behavior WILL NOT SEE
            // because we are stopping the event dispatch below.
            textNode.removeRange(0, selectionEnd);
          }

          return 'stop';
        }
        return 'continue';
      }
    }
    return 'decline';
  }
}
