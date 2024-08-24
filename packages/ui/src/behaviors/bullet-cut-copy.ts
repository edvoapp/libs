import marked from 'marked';

import { trxWrap, trxWrapSync } from '@edvoapp/common';
import { Behavior, DispatchStatus, EventNav, keyMappings, PasteElement } from '../service';
import * as VM from '../viewmodel';
import equals from 'fast-deep-equal';
import { OutlineItem } from '../viewmodel';

// Copy and paste bullets as markdown, bidirectionally.
// TODO: Rename this to MarkdownCopyPaste or BulletCopyPaste
export class BulletCutCopy extends Behavior {
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const { selectionState } = eventNav;
    if (selectionState.selection.length === 0) return 'decline';

    const sortedDk = [...eventNav.downKeys].sort();

    if (equals(keyMappings['meta-c'], sortedDk)) {
      this.handleCopy(eventNav, e);
      return 'stop';
    }
    if (equals(keyMappings['meta-x'], sortedDk)) {
      this.handleCut(eventNav, e);
      return 'stop';
    }

    return 'decline';
  }

  handleCopy(eventNav: EventNav, e: Event) {
    const { selectionState } = eventNav;
    if (selectionState.selection.length === 0) return 'decline';

    const { plainTextRes } = this.generateCopyText(eventNav);
    const htmlRes = marked(plainTextRes);
    // compat
    if (e instanceof ClipboardEvent) {
      e.clipboardData?.setData('text/plain', plainTextRes);
      e.clipboardData?.setData('text/html', htmlRes);
    }
    void navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([plainTextRes], { type: 'text/plain' }),
        'text/html': new Blob([htmlRes], { type: 'text/html' }),
      }),
    ]);

    return 'stop';
  }

  handleCut(eventNav: EventNav, e: Event): DispatchStatus {
    const { selectionState, focusState } = eventNav;
    if (selectionState.selection.length === 0) return 'decline';
    const selection = selectionState.selection;
    const len = selection.length;

    const selectionStartElement = selection.idx(0);
    const selectionEndElement = selection.idx(len - 1);

    const startPrevSibling = selectionStartElement?.prevSibling();
    const startParent = selectionStartElement?.parentNode;

    if (len) {
      // copy then delete
      this.handleCopy(eventNav, e);
      const items = selection.value.filter((el) => el instanceof VM.OutlineItem) as VM.OutlineItem[];
      trxWrapSync((trx) => {
        for (const el of items) {
          el.backref.archive(trx);
        }
      });

      const elementToFocus =
        // endPrevSibling || endParent ||
        startPrevSibling || startParent;
      if (elementToFocus) {
        void focusState.setFocus(elementToFocus, {});
      }
      return 'stop';
    }

    return 'decline';
  }

  generateCopyText(eventNav: EventNav) {
    let plainTextRes = '';
    let htmlRes = '<ul>';
    for (const entity of eventNav.selectionState.selection.value) {
      this.trace(4, () => ['handleCopy', { entity }]);

      if (!(entity instanceof VM.OutlineItem)) continue;

      const bodyText = entity.contentBody.value?.to_lossy_string();
      this.trace(4, () => ['handleCopy', { bodyText }]);
      plainTextRes += `- ${bodyText}\n`;
      htmlRes += '<li>';
      htmlRes += '<span>';
      htmlRes += bodyText || '&nbsp;\n';
      htmlRes += '</span>';
      const { plainText, html } = this.iterateChildren(entity, 1);
      plainTextRes += plainText;
      htmlRes += html;
      htmlRes += '</li>';
    }
    htmlRes += `</ul>\n`;
    return { htmlRes, plainTextRes };
  }

  iterateChildren(node: VM.OutlineItem, tier: number): { plainText: string; html: string } {
    const childItems = node.items;
    this.trace(4, () => ['handleCopy', { node, len: childItems.length }]);

    if (childItems.length === 0) return { plainText: '', html: '' };
    let plainTextOut = '';
    let htmlOut = '<ul>';
    for (const childItem of childItems.value) {
      const prefix = '    '.repeat(tier);
      plainTextOut += prefix;
      plainTextOut += '- ';
      const text = childItem.contentBody.value?.to_lossy_string() || '';
      this.trace(4, () => ['handleCopy', { childItem, text }]);
      const { plainText, html } = this.iterateChildren(childItem, tier + 1);
      plainTextOut += text;
      plainTextOut += '\n';
      plainTextOut += plainText;
      htmlOut += '<li>';
      htmlOut += '<span>';
      htmlOut += text || '&nbsp;';
      htmlOut += '</span>';
      htmlOut += html;
      htmlOut += '</li>';
    }
    htmlOut += '</ul>\n';
    return { plainText: plainTextOut, html: htmlOut };
  }
}
