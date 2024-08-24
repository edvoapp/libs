import { Model, globalStore, trxWrapSync } from '@edvoapp/common';
import {
  ChangeContext,
  Guard,
  Guarded,
  ItemEventOrigin,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  useUndoManager,
} from '@edvoapp/util';
import { CloneContext } from '../../utils';
import { NodeCA, Node } from './view-model-node';
import { ShareHelper } from './share-helper';
import { BoundingBox } from './bounding-box';
import { ArrowDragHandle } from '../arrow-drag-handle';
export interface VertexNodeCA<Parent extends Node | null = Node | null> extends NodeCA<Parent> {
  vertex: Model.Vertex;
}

export abstract class VertexNode<Parent extends Node | null = Node | null> extends Node<Parent> {
  @OwnedProperty
  vertex: Model.Vertex;
  @OwnedProperty
  shareHelper: ShareHelper;

  constructor({ vertex, ...args }: VertexNodeCA<Parent>) {
    super(args);
    this.vertex = vertex;

    this.shareHelper = this.context.getShareHelper(vertex);
    this.shareHelper.registerNode(this);
  }

  protected init(): void {
    super.init();
    const vertexNodeRegistry = this.context.vertexNodeRegistry;
    /**
     * On the first node for this inner, the inner momentarily exists with no nodes, and is not destroyed
     *  */
    if (vertexNodeRegistry.add(this.vertex.id, this)) {
      this.onCleanup(() => {
        vertexNodeRegistry.remove(this.vertex.id);
      });
    }
  }

  // Convenience methods

  @MemoizeOwned()
  get nameProp() {
    return this.vertex
      .filterProperties({
        role: ['name'],
        contentType: 'text/plain',
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  @MemoizeOwned()
  get name(): ObservableReader<string | undefined> {
    return this.nameProp.mapObs<string | undefined>((p) => p?.text);
  }

  @MemoizeOwned()
  get bodyProperty(): ObservableReader<Model.Property | null | undefined> {
    return this.vertex
      .filterProperties({
        role: ['body'],
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs();
  }

  @MemoizeOwned()
  get bodyText(): ObservableReader<string | undefined> {
    return this.vertex
      .filterProperties({
        role: ['body'],
        contentType: 'text/plain',
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs()
      .mapObs<string | undefined>((p) => p?.text);
  }

  // TODO: make this a memoize owned once Observable becomes an outer
  @MemoizeOwned()
  get validUserIDsForInstructions(): ObservableReader<string[] | undefined> {
    // TODO include coalesced adminIDs
    /**
     * Sets to nobody until it is loaded
     */
    return this.vertex.userID.mapObs<string[] | undefined>((uid) => (uid ? [uid] : []));
  }

  @MemoizeOwned()
  get visibleUserIDsForDescendants(): ObservableReader<string[] | undefined> {
    const vertexUserObs = this.vertex.userID;
    const coalesced = this.coalescedPrivileges;
    const obs = new Observable<string[] | undefined>(
      // Not loaded yet. At least show my own stuff
      [globalStore.getCurrentUserID()],
      () => Promise.all([vertexUserObs.load(), coalesced.load()]),
    );

    const calc = (origin: ItemEventOrigin, ctx: ChangeContext) => {
      const inh = coalesced.value;

      // Not loaded yet
      if (!inh) return;

      const projected = Model.Priv.PrivState.fromInherited(inh);

      if (projected.writeID.includes('PUBLIC')) {
        // PUBLIC means don't filter - because there are no actual users with a userID of PUBLIC
        obs.set(undefined, origin, ctx);
      } else {
        // Not loaded yet
        const vertexUserId = vertexUserObs.value;
        if (!vertexUserId) return;
        // I should only render the visual descendants which are authorized to write or I have written
        obs.set([...projected.writeID, vertexUserId, globalStore.getCurrentUserID()], origin, ctx);
      }
    };

    obs.onCleanup(
      vertexUserObs.subscribe((_: string | undefined, origin: ItemEventOrigin, ctx: ChangeContext) =>
        calc(origin, ctx),
      ),
    );
    obs.managedSubscription(coalesced, (_, origin, ctx) => calc(origin, ctx));

    calc('UNKNOWN', {});
    return obs;
  }
  @MemoizeOwned()
  get coalescedPrivileges(): ObservableReader<Model.Priv.InheritedPrivs | undefined> {
    const shareState = this.shareHelper.shareState;
    const parentCoalesced = this.privilegeCoalescenceParent?.coalescedPrivileges ?? undefined;

    // TODO: test & ensure that this works. I don't want to just push this as a hotfix because I can't properly
    // orchestrate a repro.

    // return Observable.calculated(
    //   ({ shareState: _, parentCoalesced }) =>
    //     shareState.performCoalescence(parentCoalesced),
    //   { shareState, parentCoalesced },
    // );

    const obs = new Observable<Model.Priv.InheritedPrivs | undefined>(undefined, async () => {
      await Promise.all([shareState.load(), parentCoalesced?.load()]);
    });

    const calc = (origin: ItemEventOrigin, ctx: ChangeContext) => {
      // Don't bother to check if we're loaded. If shareState or parentCoalesced haven't loaded,
      // we'll simply default to no privileges, and nothing should be visible
      // Then we'll get recalc'd when they do load
      const privs = shareState.performCoalescence(parentCoalesced?.value);
      obs.set(privs, origin, ctx, true);
    };

    this.managedSubscription(this.shareHelper.shareState, (_, origin, ctx) => calc(origin, ctx));

    if (parentCoalesced) {
      this.managedSubscription(parentCoalesced, (_, origin, ctx) => calc(origin, ctx));
    }

    // shareState and parentCoalesced Might already be loaded
    calc('UNKNOWN', {});

    return obs;
  }
  // private getRootNodePriviliges() {
  //   if (this.parentNode)
  //     throw 'only run getRootNodePrivileges on the root node';
  //   const vertexUserID = this.vertex.userID.value;
  //   if (!vertexUserID);

  //   let privs = ModelUtil.projectInhertedPrivileges(inh);
  //   let visibleUserIDsForDescendants: string[] | undefined = [
  //     ...privs.writeID,
  //     await get(),
  //     /**
  //      *  TODO: apply this to vertex.shares to make sure we don't read Sue's
  //      * share instruction that she's maliciously added. I think this is the right place for this
  //      * but we probably also need to do it in one other place
  //      */

  //     Firebase.getCurrentUserID(),
  //   ];

  //   /**
  //    * NOTE: If we have a parentNode, then that node is responsible for updating
  //    * visisibleUserIds because we just cloned its observable
  //    * TODO: Making a clonable observable where the clones lack a .set method
  //    */
  //   if (visibleUserIDsForDescendants.includes('PUBLIC'))
  //     visibleUserIDsForDescendants = undefined;
  //   this.visibleUserIDsForDescendants.set(visibleUserIDsForDescendants);
  // }

  /**
   * Get an observable of relationships between this node and other nodes presently in the ViewModel
   */
  getCrosslinkObs = ({
    role,
    filter,
  }: {
    role: string[];
    filter: (node: Node) => boolean;
  }): ObservableList<[Model.Backref, VertexNode]> => {
    // TODO: this is leaking memory
    // YES indeed it is - TODO: Migrate this to a central service
    const _obs = new ObservableList<[Model.Backref, VertexNode]>();

    const backrefMap: Record<string, Model.Backref> = {};
    const backrefs = this.vertex.filterBackrefs({
      role,
      userID: this.visibleUserIDsForDescendants,
    });

    _obs.onCleanup(() => {
      for (const key in backrefMap) {
        delete backrefMap[key];
      }
    });

    _obs.onCleanup(
      backrefs.subscribe({
        ITEM_LISTENER: (backref, op, origin, ctx) => {
          const other_vertex_id = backref.target.id;
          if (op === 'ADD') {
            const otherNode = this.context.vertexNodeRegistry.get(other_vertex_id);

            if (otherNode && filter(otherNode)) {
              _obs.insert([backref, otherNode], origin, ctx, true);
            }
            backrefMap[other_vertex_id] = backref;
          } else if (op === 'REMOVE') {
            delete backrefMap[other_vertex_id];
            _obs.removeWhere(([b, _]) => b === backref);
          }
        },
      }),
    );

    _obs.onCleanup(
      this.context.vertexNodeRegistry.subscribe({
        ITEM_LISTENER: (otherNode: VertexNode, op, origin, ctx) => {
          if (op === 'ADD') {
            const backref = backrefMap[otherNode.vertex.id];

            if (backref && filter(otherNode)) {
              _obs.insert([backref, otherNode], origin, ctx, true);
            }
          } else if (op === 'REMOVE') {
            _obs.removeWhere(([_, o]) => o === otherNode);
          }
        },
      }),
    );

    const blobbiesEnabled = this.context.authService.currentUserVertexObs.mapObs<boolean | null | undefined>((user) =>
      user ? user.getFlagPropertyObs('blobbies-enabled').mapObs((v) => !!v) : null,
    );

    // HACK: temporarily put blobbies behind a user setting
    const obs = _obs.filterObs(
      (x) => !!blobbiesEnabled.value,
      'crosslink-obs',
      () => blobbiesEnabled.load(),
    );

    obs.managedSubscription(blobbiesEnabled, () => obs.reevaluate());

    return obs;
  };

  // TODO: implement
  get clientRectObs(): ObservableReader<BoundingBox> {
    return super.clientRectObs;
    // return new Observable(new BoundingBox({ x: 0, y: 0, height: 0, width: 0 }));
  }

  @MemoizeOwned()
  get arrowDragHandleN(): ArrowDragHandle {
    return ArrowDragHandle.new({
      parentNode: this,
      context: this.context,
    });
  }
  @MemoizeOwned()
  get arrowDragHandleE(): ArrowDragHandle {
    return ArrowDragHandle.new({
      parentNode: this,
      context: this.context,
    });
  }

  @MemoizeOwned()
  get arrowDragHandleS(): ArrowDragHandle {
    return ArrowDragHandle.new({
      parentNode: this,
      context: this.context,
    });
  }

  @MemoizeOwned()
  get arrowDragHandleW(): ArrowDragHandle {
    return ArrowDragHandle.new({
      parentNode: this,
      context: this.context,
    });
  }

  lineageContainsCycle() {
    return this.lineageContains(this.vertex);
  }

  /**
   * overwriting VMNode.shallowClone because we want to ensure we traverse this node's tree,
   * but do not clone the vertex because we may have many VertexNodes for a single vertex and we don't want to clone it many times
   */
  @Guarded
  async shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    return Promise.resolve(targetParentVertex);
  }

  /**
   * Archives a vertex and its associated entities.
   *
   * TODO: Leaks memory. Migrate this to the datamodel ASAP.
   *
   * @param doCb - Optional callback function that will be executed after the archiving process is completed.
   * @param undoCb - Optional callback function that will be executed after the archiving process is undone.
   *
   * @returns {Promise<void>} - A promise that resolves when the archiving process is completed.
   */
  async archive(doCb?: () => void, undoCb?: () => void, includeEvents = true) {
    this.leak();
    let archived = new ObservableList<
      Model.Vertex | Model.Backref | Model.Edge | Model.Property | Model.TimelineEvent
    >().leak();
    const vertex = this.vertex.leak();

    const collections = await Guard.while(
      {
        edges: vertex.edges,
        backrefs: vertex.backrefs,
        properties: vertex.properties,
        events: includeEvents ? vertex.events : null,
      },
      ({ edges, backrefs, properties, events }) =>
        Promise.all([edges.get(), backrefs.get(), properties.get(), events?.get()]),
    );

    const navigationHistory = this.context.navigationHistory;

    useUndoManager().add_action(
      () => {
        trxWrapSync((trx) => {
          archived.clear();

          for (const collection of collections) {
            if (!collection) continue;
            for (const entity of collection) {
              archived.insert(entity);
              entity.archive(trx);
            }
          }

          // archive vertex last
          archived.insert(vertex);
          vertex.archive(trx);
          navigationHistory.removeVertexFromHistory(vertex.id);
        });
        doCb?.();
      },
      () => {
        trxWrapSync((trx) => {
          archived.forEach((v) => v.unarchive(trx));
        });
        undoCb?.();
      },
    );
  }
}
