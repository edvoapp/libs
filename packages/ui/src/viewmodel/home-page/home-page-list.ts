import { DB, globalStore, Model } from '@edvoapp/common';
import {
  Button,
  ChildNode,
  ChildNodeCA,
  ConditionalNode,
  ListNode,
  NameTagField,
  Node,
  VertexNode,
  VertexNodeCA,
} from '..';
import {
  Guard,
  Guarded,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
} from '@edvoapp/util';
import { HomePage } from '..';
import { createToast, POSITION, TYPE, useNavigator } from '../..';
import { Clickable } from '../../behaviors';

interface CA extends ChildNodeCA<HomePage> {
  showRecents?: boolean;
  listMode: ObservableReader<'recents' | 'favorites' | 'shared'>;
}

const edvoSpaceRegexp = new RegExp(/(?:.*[plm|app].*\.edvo\.com|localhost:4000)\/topic\/(\w*)/i);

export class HomePageList extends ChildNode<HomePage> {
  @OwnedProperty
  loadingResults = new Observable(false);

  clear_timer: null | (() => void) = null;
  showRecents?: boolean;
  zIndexed = true;
  listMode: ObservableReader<'recents' | 'favorites' | 'shared'>;

  constructor({ showRecents, listMode, ...args }: CA) {
    super({ ...args });
    this.showRecents = showRecents;
    this.listMode = listMode;
  }
  static new(args: CA) {
    const me = new HomePageList(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['recentItems', 'pinnedItems', 'sharedItems'];
  }

  @MemoizeOwned()
  get dedupedVertices(): ObservableList<Model.Vertex> {
    return Model.TimelineEvent.dedupedEventVerticesListObs();
  }

  // raw timeline events
  @OwnedProperty
  _timelineEvents: ObservableList<Model.TimelineEvent> = Model.TimelineEvent.recents();
  // _timelineEvents = new ObservableList<Model.TimelineEvent>();

  @Guarded
  async loadEvents(startAfter: DB.Timestamp | null, limit: number) {
    const guard = Guard.unsafe(this._timelineEvents);
    let query = Model.TimelineEvent.rawQuery({
      limit,
      where: [
        ['eventType', 'in', ['visited', 'created']],
        ['status', '==', 'active'],
      ],
      orderBy: ['eventDate', 'desc'],
    });

    if (startAfter) query = query.startAfter(startAfter);

    const querySnapshot = await query.get();

    const events = querySnapshot.docs.map((snapshot: any) => Model.TimelineEvent.hydrate({ snapshot }));

    // this is really an "append" or "concat"
    this._timelineEvents.replace([], events);
    guard.release();
  }

  @MemoizeOwned()
  get _recentPrecursor() {
    return ObservableList.calculated(
      ({ timelineEvents }) => {
        const deduped = timelineEvents.reduce<Record<string, { vertex: Model.Vertex; event: Model.TimelineEvent }>>(
          (acc, event) => {
            const vertex = event.parent;
            const vertexId = vertex.id;
            const curr = acc[vertexId];
            if (curr) {
              // const evtDate = val.eventDate;//.toDate();
              curr.event = event.eventDate > curr.event.eventDate ? event : curr.event;
            } else {
              acc[vertexId] = { vertex, event };
            }
            return acc;
          },
          {},
        );

        // Use the Schwartz
        return Object.values(deduped).sort((a, b) =>
          globalStore.compareTimestamps(b.event.eventDate, a.event.eventDate),
        );
      },
      {
        timelineEvents: this._timelineEvents,
      },
    );
  }

  @MemoizeOwned()
  get recentItems(): ListNode<HomePageList, HomePageListItem, { vertex: Model.Vertex; event: Model.TimelineEvent }> {
    const precursor = this._recentPrecursor;

    return ListNode.new<HomePageList, HomePageListItem, { vertex: Model.Vertex; event: Model.TimelineEvent }>({
      parentNode: this,
      precursor,
      label: 'Recent Items',
      factory: ({ vertex, event }, parentNode): HomePageListItem => {
        return HomePageListItem.new({
          parentNode,
          vertex: vertex,
          visitEvent: event,
          context: parentNode.context,
          onClick: (e) => {
            const nav = useNavigator();
            vertex.saved.then(() => {
              nav.openTopic(vertex, undefined, undefined);
            });
          },
        });
      },
    });
  }

  @MemoizeOwned()
  get pinnedItems(): ListNode<HomePageList, HomePageListItem, Model.Property> {
    const precursor = globalStore
      .query<Model.Property>('property', null, {
        where: [
          ['userID', '==', globalStore.getCurrentUserID()],
          ['role', 'array-contains', 'pin'],
          ['status', '==', 'active'],
        ],
        // since flag properties are always freshly created, we will always be notified for new records.
        orderBy: ['updatedAt', 'desc'],
      })
      .sortObs((a, b) => globalStore.compareTimestamps(b?.updatedAt, a?.updatedAt));

    return ListNode.new<HomePageList, HomePageListItem, Model.Property>({
      parentNode: this,
      precursor,
      label: 'Pinned Items',
      factory: (property, parentNode): HomePageListItem => {
        return HomePageListItem.new({
          parentNode,
          vertex: property.parent,
          context: parentNode.context,
          onClick: (e) => {
            const nav = useNavigator();
            nav.openTopic(property.parent, undefined, undefined);
          },
        });
      },
    });
  }

  @MemoizeOwned()
  get sharedItems(): ListNode<HomePageList, HomePageListItem, Model.Property> {
    const currentUserID = globalStore.getCurrentUserID();
    const precursor = globalStore
      .query<Model.Property>('property', null, {
        where: [
          ['status', '==', 'active'],
          ['userID', '!=', currentUserID],
          ['contentType', '==', 'application/x-share'],
          ['recipientID', 'array-contains', currentUserID],
        ],
        limit: 100,
        // since flag properties are always freshly created, we will always be notified for new records.
        orderBy: [
          ['userID', 'desc'],
          ['updatedAt', 'desc'],
        ],
      })
      .filterObs((p) => {
        const json = p.json?.value as Model.Priv.ShareInstructionData | null;
        if (!json) return false;

        return json.shareType == 'allow';
      })
      .sortObs((a, b) => globalStore.compareTimestamps(b?.updatedAt, a?.updatedAt));

    return ListNode.new<HomePageList, HomePageListItem, Model.Property>({
      parentNode: this,
      precursor,
      label: 'Shared Items',
      factory: (shareInstructionProp, parentNode): HomePageListItem => {
        return HomePageListItem.new({
          parentNode,
          vertex: shareInstructionProp.parent,
          context: parentNode.context,
          shareDate: shareInstructionProp.updatedAt,
          onClick: (e) => {
            const nav = useNavigator();
            nav.openTopic(shareInstructionProp.parent, undefined, undefined);
          },
        });
      },
    });
  }

  @MemoizeOwned()
  get events() {
    return globalStore
      .query<Model.TimelineEvent>('event', null, {
        limit: 200,
        where: [
          ['eventType', 'in', ['visited', 'created']],
          ['userID', '==', globalStore.getCurrentUserID()],
          ['status', '==', 'active'],
        ],
        orderBy: ['eventDate', 'desc'],
      })
      .sortObs((a, b) => globalStore.compareTimestamps(b.eventDate, a.eventDate));
  }

  @MemoizeOwned()
  get dedupedEventVertices() {
    return this.events
      .reduceObs<Record<string, Model.Vertex>>(
        (acc, val) => {
          const vertex = val.parent;
          const vertexId = vertex.id;
          acc[vertexId] = vertex;
          return acc;
          // Don't use deepEq here
        },
        () => ({}),
      )
      .mapObs((e) => Object.values(e));
  }

  onSelect(vertex: Model.Vertex) {
    const nav = useNavigator();
    nav.openTopic(vertex, undefined, undefined);
  }
}

interface HomePageListItemCA extends VertexNodeCA<Node> {
  shareDate?: DB.Timestamp;
  visitEvent?: Model.TimelineEvent;
  onClick?: (e: MouseEvent) => boolean | void | null | undefined;
}

export class HomePageListItem extends VertexNode<Node> implements Clickable {
  shareDate?: DB.Timestamp;
  _visitEvent?: Model.TimelineEvent;
  _onClick?: (e: MouseEvent) => boolean | void | null | undefined;
  onClick(e: MouseEvent): boolean | void | null | undefined {
    return this._onClick?.(e);
  }
  allowHover: boolean = true;
  constructor({ visitEvent, onClick, shareDate, ...args }: HomePageListItemCA) {
    super(args);
    this._visitEvent = visitEvent;
    this._onClick = onClick;
    this.shareDate = shareDate;
  }

  async visitEvent(): Promise<Model.TimelineEvent | null> {
    if (this._visitEvent) return this._visitEvent;

    const v = await this.vertex.getLastVisitEvent();

    this._visitEvent = v ?? undefined;
    return v;
  }

  static new(args: HomePageListItemCA) {
    const me = new HomePageListItem(args);
    me.init();
    return me;
  }

  get cursor() {
    return 'pointer';
  }

  get childProps(): (keyof this & string)[] {
    return ['nameTagField', 'shareButton', 'archiveButton'];
  }
  @MemoizeOwned()
  get nameTagField(): NameTagField {
    return NameTagField.new({
      parentNode: this,
      vertex: this.vertex,
      nameReadonly: true,
      allowHover: true,
      cursor: this.cursor,
      alwaysShowAddTagButton: false,
      disableAddTag: true,
      tagsReadonly: true,
      tagLimit: 5,
    });
  }
  @MemoizeOwned()
  get shareButton() {
    const precursor = Observable.calculated(({ hover }) => hover === 'branch' || hover === 'leaf', {
      hover: this.hover,
    });
    return ConditionalNode.new<Button<Node>, boolean | string, HomePageListItem>({
      parentNode: this,
      precursor: precursor,
      factory: (want, parentNode) => {
        if (!want) return null;
        return Button.new({
          parentNode,
          onClick: () => {
            const nav = useNavigator();
            nav.openTopic(this.vertex, undefined, { share: 'true' });
          },
        });
      },
    });
  }
  @MemoizeOwned()
  get archiveButton() {
    const precursor = Observable.calculated(({ hover, userID, currentUser }) => hover && userID === currentUser?.id, {
      hover: this.hover,
      userID: this.vertex.userID,
      currentUser: this.context.currentUser,
    });

    return ConditionalNode.new<Button<Node>, boolean | string, HomePageListItem>({
      parentNode: this,
      precursor,
      factory: (want, parentNode) => {
        if (!want) return null;
        return Button.new({
          parentNode,
          onClick: () => {
            createToast('Archived! CMD-Z to undo.', {
              type: TYPE.INFO,
              autoClose: 3000,
              hideProgressBar: false,
              closeOnClick: true,
              draggable: false,
              position: POSITION.TOP_CENTER,
            });
            this.archive();
          },
        });
      },
    });
  }
}
