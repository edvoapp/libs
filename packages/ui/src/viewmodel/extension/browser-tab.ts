import { ChildNode, ChildNodeCA, ConditionalNode, ListNode, Node } from '../base';
import { createEmbedProps, Draggable, MemberAppearance, PositionAndType, UrlPaste } from '../../behaviors';
import { MemoizeOwned, Observable, OwnedProperty, useUndoManager } from '@edvoapp/util';
import { TagList } from '../tag-list';
import { config, globalStore, Model, subTrxWrap, TrxRef, trxWrap, trxWrapSync } from '@edvoapp/common';
import { ActionGroup, Behavior, DEFAULT_WEBCARD_DIMS, EventNav } from '../../service';
import { BrowserWindow } from './browser-window';
import { TopicSpaceCardState } from '@edvoapp/common/dist/model';

interface TabCA extends ChildNodeCA<ListNode<BrowserWindow, Tab>> {
  tab: Model.BrowserContext;
}

// Saved-in-edvo indicator
// Tags for those items which are saved
export class Tab extends ChildNode<ListNode<BrowserWindow, Tab>> implements Draggable {
  @OwnedProperty
  vertex = new Observable<Model.Vertex | null | undefined>(undefined);
  @OwnedProperty
  tab: Model.BrowserContext;
  allowHover = true;

  constructor({ tab, ...args }: TabCA) {
    super(args);
    this.tab = tab;
  }

  static new(args: TabCA) {
    const me = new Tab(args);
    me.init();
    return me;
  }

  init() {
    super.init();

    this.managedSubscription(this.tab.url, (url) => void this.urlChanged(url), true);
  }

  get childProps(): (keyof this & string)[] {
    return ['tags', 'archiveBtn'];
  }

  @MemoizeOwned()
  get tags(): ConditionalNode<TagList, Model.Vertex | null | undefined, Tab> {
    return ConditionalNode.new<TagList, Model.Vertex | null | undefined, Tab>({
      parentNode: this,
      precursor: this.vertex,
      factory: (vertex, parentNode) =>
        vertex &&
        TagList.new({
          parentNode,
          vertex,
          relationshipType: 'tag',
        }),
    });
  }

  @MemoizeOwned()
  get archiveBtn(): ConditionalNode<ArchiveBtn, boolean, Tab> {
    const pinnedObs = this.tab.pinned;
    const urlObs = this.tab.url;
    const hoverObs = this.hover;
    const precursor = Observable.fromObservables(() => {
      const pinned = pinnedObs.value;
      const url = urlObs.value;
      const hover = hoverObs.value;
      // return true;
      return Boolean(!pinned && url && !!hover);
    }, [pinnedObs, urlObs, hoverObs]);

    return ConditionalNode.new<ArchiveBtn, boolean, Tab>({
      parentNode: this,
      precursor,
      factory: (want, parentNode) => (want ? ArchiveBtn.new({ parentNode }) : null),
    });
  }

  // TODO: figure out how to unify this with UrlPaste#upsertVertex
  async upsert(
    trx: TrxRef,
    target?: Model.Vertex,
    seq = 1,
    meta?: Partial<TopicSpaceCardState>,
  ): Promise<Model.Vertex | null> {
    let vertex = await this.vertex.get();

    const url = UrlPaste.urlTidy((await this.tab.url.get()) ?? undefined)?.toString();

    const name = this.tab.title.value ?? '(Untitled)';
    const faviconUrl = this.tab.faviconUrl.value;
    if (vertex) {
      // simply create an edge if there is already an existing Vertex
      if (target) {
        vertex.createEdge({
          trx,
          target,
          role: ['member-of', 'tag'],
          seq,
          meta: {
            ...meta,
            autoposition: true,
            autosize: true,
            ...DEFAULT_WEBCARD_DIMS,
          },
        });
      }
      return vertex;
    }
    // if we don't have a URL, then we have nothing to save
    if (!url) return null;

    // otherwise, create the vertex
    vertex = Model.Vertex.create({
      trx,
      name,
      kind: 'resource',
      attributes: { url },
    });
    this.vertex.set(vertex);

    if (target) {
      vertex.createEdge({
        trx,
        target,
        role: ['member-of', 'tag'],
        seq,
        meta: {
          ...meta,
          autoposition: true,
          autosize: true,
          ...DEFAULT_WEBCARD_DIMS,
        },
      });
    }

    let body = vertex.createProperty({
      trx,
      role: ['body'],
      contentType: 'text/x-uri',
      initialString: url,
    });

    if (config.isElectron) {
      await vertex.setJsonPropValues<MemberAppearance>(
        'appearance',
        {
          type: 'browser',
        },
        trx,
      );
    }

    // It's pretty unlikely that this is a PDF, so lets assume it isn't, and then check/repair it in the background
    // TODO: we really need to be getting the content type from the tab or otherwise in-browser,
    // because this is not going to work for access controlled PDFs
    trx.addOp(undefined, (trx) => this.conditionallyReviseBodyProperty(trx, url, body));
    await createEmbedProps(vertex, url, trx);
    if (faviconUrl) {
      const faviconContentType = (() => {
        const lastIndex = faviconUrl.lastIndexOf('.');
        if (lastIndex === -1) return null;
        const ext = faviconUrl.slice(lastIndex + 1);
        // curiously, sometimes there are favicons like favicon.ico?v3
        // thanks firebase emulator suite
        if (ext.startsWith('ico')) return 'image/x-icon';
        switch (ext) {
          case 'jpg':
          case 'jpeg':
            return 'image/jpg';
          case 'svg':
            return 'image/svg+xml';
          case 'png':
            return 'image/png';
          case 'gif':
            return 'image/gif';
          default:
            return null;
        }
      })();
      if (faviconContentType) {
        vertex.createProperty({
          trx,
          role: ['favicon'],
          contentType: faviconContentType,
          initialString: faviconUrl,
        });
      }
    }
    return vertex;
  }

  async conditionallyReviseBodyProperty(trx: TrxRef, url: string, existingBody: Model.Property) {
    // get the content type, but only after we've created the vertex and edge
    const { contentType } = await globalStore.callServerFunction('getContentTypeFromUrl', { url });

    if (contentType === 'application/pdf') {
      await Model.Property.createAsync({
        trx,
        role: ['body'],
        parent: existingBody.parent,
        contentUrl: url,
        contentType,
        // uploadTaskRef: (uploadTask: firebase.storage.UploadTask) => {
        //   uploadTask.on('state_changed', {
        //     next: () => this.onStateChange(uploadTask),
        //     error: (e) => this.onUploadError(e, uploadTask),
        //   });
        // },
      });
      existingBody.archive(trx);
    }
  }

  recreateTab(trx: TrxRef, tabOpts: Partial<Parameters<typeof Model.BrowserContext.create>[0]> = {}) {
    const {
      parent,
      seq: seqObs,
      deviceContextId,
      faviconUrl: faviconUrlObs,
      url: urlObs,
      title: titleObs,
      pinned: pinnedObs,
    } = this.tab;
    const url = urlObs.value ?? undefined;
    const faviconUrl = faviconUrlObs.value ?? undefined;
    const pinned = pinnedObs.value ?? undefined;
    const title = titleObs.value ?? undefined;
    const seq = seqObs.value ?? undefined;
    // instead of un-archiving, create a new one, because when the tab closes the record gets deleted anyway.
    Model.BrowserContext.create({
      trx,
      type: 'tab',
      url,
      faviconUrl,
      seq,
      parent,
      deviceContextId,
      pinned,
      title,
      originator: 'app',
      ...tabOpts,
    });
  }
  move({ trx, parent, seq }: { trx: TrxRef; parent: Model.BrowserContext; seq: number }) {
    console.log('move', { seq });

    const oldSeq = this.tab.seq.value ?? 1;
    const oldParent = this.tab.parent;

    useUndoManager().add_action(
      () => {
        void subTrxWrap(trx, async (trx) => {
          console.log('DO', { parent, seq });
          this.tab.update({ trx, parent, seq });
        });
      },
      () => {
        void trxWrap(async (trx) => {
          console.log('UNDO', { parent, seq });
          this.tab.update({ trx, parent: oldParent, seq: oldSeq });
        });
      },
    );
  }

  upsertAndArchive(trx: TrxRef | null = null) {
    useUndoManager().add_action(
      () => {
        void subTrxWrap(trx, async (trx) => {
          await this.upsert(trx);
          this.tab.archive(trx);
        });
      },
      () => trxWrapSync((trx) => this.recreateTab(trx)),
    );
  }

  getHeritableBehaviors() {
    return [new TabBehavior()];
  }

  _cancelUrlChange?: () => void;
  async urlChanged(url: string | null) {
    this.validate();
    this._cancelUrlChange?.();

    let cancelled = false;
    this._cancelUrlChange = () => {
      cancelled = true;
    };

    if (url) {
      let query = globalStore
        .createQuery<Model.VertexData>('vertex')
        .where('kind', '==', 'resource')
        .where(`attributes.url`, '==', url);

      const qsnapshot = await query.get();
      // Drop it to the floor. Got called again with a newer url
      if (cancelled || this.destroyed) return;

      if (qsnapshot.size > 0) {
        const snapshot = qsnapshot.docs[0];
        const vertex = Model.Vertex.hydrate({ snapshot });
        this.vertex.set(vertex);
      } else {
        this.vertex.set(null);
      }
    } else {
      this.vertex.set(null);
    }

    delete this._cancelUrlChange;
  }

  get seq() {
    return this.tab.seq.value ?? 1.0;
  }

  get cursor() {
    const url = this.tab.url.value;
    const disabled = !url;
    return disabled ? 'not-allowed' : 'grab';
  }

  useDragProxy = true;

  get dragHandle() {
    return true;
  }

  get draggable() {
    return true;
  }

  @OwnedProperty
  dragging = new Observable<PositionAndType | null>(null);

  setDragging(pos: PositionAndType | null) {
    this.dragging.set(pos);
  }

  handleDepart(trx: TrxRef): boolean {
    // for now, do not remove the tab
    // this.tab.archive(trx);
    return true;
  }
}

class TabBehavior extends Behavior {
  getActions(n: Node): ActionGroup[] {
    const node = n.closestInstance(Tab);
    if (!node) return [];
    return [
      {
        label: 'Tab',
        actions: [
          {
            label: 'Archive this tab',
            apply: () => {
              this.closeTab(node);
            },
          },
        ],
      },
    ];
  }

  closeTab(tab: Tab) {
    trxWrapSync((trx) => tab.tab.archive(trx));
  }
}

interface ArchiveBtnCA extends ChildNodeCA<ConditionalNode<ArchiveBtn, boolean, Tab>> {}

export class ArchiveBtn extends ChildNode<ConditionalNode<ArchiveBtn, boolean, Tab>> {
  allowHover = true;
  get cursor() {
    return 'pointer';
  }
  static new(args: ArchiveBtnCA) {
    const me = new ArchiveBtn(args);
    me.init();
    return me;
  }

  getLocalBehaviors(): Behavior[] {
    return [new ArchiveBehavior()];
  }
}

class ArchiveBehavior extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node) {
    const btn = originNode.closestInstance(ArchiveBtn);
    if (!btn) return 'decline';
    const tab = btn.parentNode.parentNode;
    // tab.upsertAndArchive();
    trxWrapSync((trx) => tab.tab.archive(trx));
    return 'stop';
  }
}
