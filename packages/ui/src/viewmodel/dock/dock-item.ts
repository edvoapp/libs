import { MemoizeOwned, Observable, ObservableReader, OwnedProperty, tryJsonParse } from '@edvoapp/util';

import { Model, TrxRef, trxWrap } from '@edvoapp/common';
import * as Behaviors from '../../behaviors';
import { MemberAppearance } from '../../behaviors';
import { Behavior } from '../../service';

import { BranchNode, BranchNodeCA, ConditionalNode, PropertyValueNode } from '../base';
import { DockTab } from './dock-tab';
import { DockItemBody } from './dock-item-body';

export class DockItem extends BranchNode {
  // implements Draggable
  overflow = true;
  static new(args: BranchNodeCA) {
    const me = new DockItem(args);
    me.init();
    return me;
  }
  get childProps(): (keyof this & string)[] {
    return ['tab', 'body', 'appearance'];
  }

  getHeritableBehaviors(): Behavior[] {
    return [new Behaviors.ContentMode()];
  }

  get cursor() {
    return 'grab';
  }

  @MemoizeOwned()
  get body() {
    return ConditionalNode.new<DockItemBody, boolean, DockItem>({
      parentNode: this,
      precursor: this.expanded,
      factory: (want, parentNode) =>
        want
          ? DockItemBody.new({
              parentNode,
              backref: this.backref,
              vertex: this.vertex,
              context: this.context,
            })
          : null,
    });
  }

  @MemoizeOwned()
  get expanded() {
    return this.meta.mapObs((meta) => {
      return meta?.dockExpanded ?? false;
    });
  }

  setExpandedProp(dockExpanded: boolean) {
    void trxWrap(async (trx) => {
      const d = {
        trx,
        meta: { dockExpanded },
      };
      if (this.meta.value) {
        await this.backref.setMetaMerge(d);
      } else {
        this.backref.setMeta(d);
      }
    });
  }
  //
  // get draggable(): boolean {
  //   return true;
  // }
  //
  // _dragging = new Observable<Position | null>(null);
  // setDragging(pos: Position | null) {
  //   this._dragging.set(pos);
  // }

  @MemoizeOwned()
  get tab() {
    return DockTab.new({
      parentNode: this,
      backref: this.backref,
      vertex: this.vertex,
      context: this.context,
    });
  }

  @MemoizeOwned()
  get appearance() {
    // Arguably apparance is NOT a Node - we should set this as a property of the inner though!
    return PropertyValueNode.new<MemberAppearance | undefined>({
      property: this.vertex
        .filterProperties({
          role: ['appearance'],
          userID: this.visibleUserIDsForDescendants,
        })
        .firstObs(),
      valueTransform: (p) => {
        // Formatted for your reading pleasure o/
        if (typeof p === 'undefined') return undefined;
        if (!p) return {};

        const jsonObs = p.content.mapObs((c) => tryJsonParse<MemberAppearance>(c));

        return jsonObs;
      },

      parentNode: this,
    });
  }

  @MemoizeOwned()
  get fitContentObs(): ObservableReader<boolean> {
    return this.vertex
      .filterProperties({
        role: ['appearance'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs()
      .mapObs<boolean>((property) => {
        let el = property?.content.mapObs((c) => {
          const type = tryJsonParse<MemberAppearance>(c).type;
          return type === 'stickynote';
        });
        return el ?? false;
      });
  }

  @OwnedProperty
  selected = new Observable(false);

  @MemoizeOwned()
  get meta() {
    return this.backref.meta;
  }
  async getSize() {
    const { height, width, ratio } = await this.backref.meta.get();
    return { height, width, ratio };
  }
  async setSize({ trx, size }: { trx: TrxRef; size: Model.SizedState }) {
    await this.backref.setMetaMerge({ trx, meta: size });
  }

  async setAppearance(newAppearance: Partial<MemberAppearance>) {
    await trxWrap(async (trx) => {
      const [current, ...rest] = await this.vertex
        .filterProperties({
          role: ['appearance'],
          contentType: 'application/json',
        })
        .toArray();
      rest.forEach((p) => p.archive(trx));

      const currentAppearance = tryJsonParse<MemberAppearance>(current?.text.value);
      const content = JSON.stringify({
        ...currentAppearance,
        ...newAppearance,
      });

      if (current) {
        current.setContent(trx, content);
      } else {
        this.vertex.createProperty({
          trx,
          role: ['appearance'],
          contentType: 'application/json',
          initialString: content,
        });
      }
    });
  }
}
