import { Model, TrxRef } from '@edvoapp/common';
import { EdvoObj } from '@edvoapp/util';

export class PasteElement extends EdvoObj {
  constructor(readonly text: string, readonly children: PasteElement[]) {
    super();
  }
  static htmlToPasteElement(listItem: HTMLElement): PasteElement {
    const ulChild = listItem.querySelector<HTMLUListElement>(':scope > ul');
    const nextSibling = listItem.nextElementSibling;
    const ulSibling = nextSibling?.matches('ul') ? nextSibling : null;
    const ul = ulChild || ulSibling;
    let text: string;

    if (ulChild) {
      let textNode: Node | null = null;
      for (const node of Array.from(listItem.childNodes)) {
        if (node.nodeType === 3) {
          textNode = node;
          break;
        }
      }
      text = textNode?.textContent || '&nbsp;';
    } else {
      text = listItem.textContent || '&nbsp;';
    }
    let children: PasteElement[] = [];
    if (ul) {
      const listItems = ul.querySelectorAll<HTMLLIElement>(':scope > li');
      children = Array.from(listItems).map((li) => PasteElement.htmlToPasteElement(li));
    }
    return new PasteElement(text, children);
  }
  totalCount(): number {
    return 1 + this.children.reduce((accum, kid) => accum + kid.totalCount(), 0);
  }
  // TODO: validate this in a smarter fashion
  validate() {
    return this.totalCount() < 100;
  }
  // used to attach children of this PasteElement to the parent between prev and next
  applyChildren(trx: TrxRef, parent: Model.Vertex, prevSeq?: number, nextSeq?: number): Model.Vertex | null {
    // recursively create children at attach to entity

    // let origPrev: Model.Vertex | null = prev;

    const increment = nextSeq ? (nextSeq - (prevSeq || 0)) / (this.children.length + 1) : 1;
    let seq = (prevSeq || 0) + increment;
    let curr: Model.Vertex | null = null;
    for (const child of this.children) {
      const childEntity = child.apply(trx);

      childEntity.createEdge({
        trx,
        target: parent,
        role: ['category-item'],
        seq,
        meta: {},
      });
      seq += increment;
      curr = childEntity;
    }

    return curr || parent;
  }
  // create an entity
  apply(trx: TrxRef) {
    const entity = Model.Vertex.create({ trx });
    entity.createBodyTextProperty({ trx, initialText: this.text });
    this.applyChildren(trx, entity);
    return entity;
  }
}
