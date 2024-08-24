import { Model, TrxRef, globalStore } from '@edvoapp/common';
import { Guarded, MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';

import { CloneContext } from '../../utils';
import { UpdatablesSet } from './updatables';

import { VertexNode, VertexNodeCA } from './vertex-node';
import { Node } from './view-model-node';

export interface BranchNodeCA<Parent extends Node = Node> extends VertexNodeCA<Parent> {
  backref: Model.Backref;
}

export abstract class BranchNode<Parent extends Node = Node> extends VertexNode<Parent> {
  @OwnedProperty
  readonly backref: Model.Backref;
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  label: string = 'Item';
  constructor({ backref, ...args }: BranchNodeCA<Parent>) {
    super(args);
    this.backref = backref;
  }

  protected init(): void {
    super.init();

    if (this.zIndexed) {
      this.defer(() => {
        this.onCleanup(
          this.backref.seq.subscribe(() => {
            // TODO optimize this. we're calling it too much
            this.zEnumerateAll();
          }, true),
        );
      });
    }
  }
  get editable() {
    return this.backref.editable;
  }
  get seq() {
    return this.backref.seq.value;
  }
  @MemoizeOwned()
  get meta() {
    return this.backref.meta;
  }

  async updateMeta({ trx, meta }: { trx: TrxRef; meta: Model.TopicSpaceCardState }) {
    await this.backref.setMetaMerge({ trx, meta });
  }
  /**
   *  * Who is able to edit the content of this thing <-- ACL side of the coin
   *   AND
   *  * Which visual descendants of this node can I see? <-- read squelching side of the coin
   *
   * NOTE: This obnoxiously-specific name is purely for rendering out the view model tree, for me, right now.
   */
  @MemoizeOwned()
  get visibleUserIDsForDescendants(): ObservableReader<string[] | undefined> {
    const vertexUserObs = this.vertex.userID;
    const privsObs = this.backref.privs;

    return Observable.fromObservables(() => {
      const p = privsObs.value;
      const vertexUserId = vertexUserObs.value;
      if (p.writeID.includes('PUBLIC')) {
        // PUBLIC means don't filter - because there are no actual users with a userID of PUBLIC
        return undefined;
      } else {
        // I should only render the visual descendants which are authorized to write or I have written
        const v = [...p.writeID, globalStore.getCurrentUserID()];
        if (vertexUserId) v.push(vertexUserId);
        return v;
      }
    }, [vertexUserObs, privsObs]);
  }

  /**
   * NOTE: in similar vein to writeID and visibleUserIDsForDescendants, adminIDs controls:
   * * Who is able to edit the *PRIVILEGES* of this thing, which match the ACL.
   */
  get validInstructionUserIDs(): ObservableReader<string[]> {
    // TODO - Very important to filter by this value in performCoalescence
    return this.backref.privs.mapObs((p) => {
      // I should only execute the descendent instructions which are authorized by this node
      // Or which I have authored
      return [...p.adminID, globalStore.getCurrentUserID()];
    });
  }

  lineageContains(vertex: Model.Vertex): boolean {
    if (this.backref.parent === vertex) return true;
    return super.lineageContains(vertex);
  }

  /**
   * This is potentially the only place we are *creating* a new vertex for cloning purposes
   * */

  /**
   * overwriting VMNode.shallowClone because branch nodes are the only way we go from one vertex to another.
   * This is potentially the only place we are *creating* a new vertex for cloning purposes.
   */

  @Guarded
  shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    const parentVertex = cloneContext.cloneVertex(this.vertex);
    // this backref is pointing from the parent Node to this.vertex
    cloneContext.cloneBackref(parentVertex, targetParentVertex, this.backref);
    return Promise.resolve(parentVertex);
  }

  @MemoizeOwned()
  get updatables(): UpdatablesSet {
    return new UpdatablesSet([this.backref]);
  }
}
