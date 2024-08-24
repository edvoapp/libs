import {
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  WeakObservableList,
  mapObs,
  mapObsList,
} from '@edvoapp/util';
import { Behaviors } from '../..';
import {
  Node,
  ChildNode,
  BoundingBox,
  ListNode,
  NodeCA,
  OverrideBoundingBox,
  ChildNodeCA,
  ConditionalNode,
  BranchNode,
  BranchNodeCA,
} from '../base';
import { Chat } from './chat';
import { Model, trxWrapSync } from '@edvoapp/common';
import { AppDesktop } from '../app-desktop';
import { ConversationListItem } from './conversation-list';
import { NewSpaceChatButton } from './new-spacechat-button';
import { TopicSpace } from '../topic-space';

export interface CA extends ChildNodeCA<AppDesktop> {}

export type ChatPanelState = {
  width?: number;
  height?: number;
  expanded?: boolean;
};

export class ChatPanel extends ChildNode<AppDesktop> {
  hasDepthMask = true;
  zIndexed = true;

  constructor(args: CA) {
    super(args);
  }
  static new(args: CA) {
    const me = new ChatPanel(args);
    me.init();
    return me;
  }
  init() {
    super.init();
  }
  get childProps(): string[] {
    return ['conversationList', /*'newSpaceChatButton',*/ 'activeChat'];
  }
  @MemoizeOwned()
  get state() {
    return this.context.currentUser.mapObs((user) => user?.getJsonPropValuesObs<ChatPanelState>('chatPanelState'));
  }
  minWidth = 400;
  maxWidth = 1000;
  minHeight = 300;
  resizable(): boolean {
    return true;
  }
  resizeCorners: Behaviors.ResizeCorner[] = Behaviors.ALL_CORNERS;
  @OwnedProperty
  _resizing = new Observable<OverrideBoundingBox | null>(null);
  resizeStep({ box }: Behaviors.ResizeStepArgs) {
    this._resizing.set(box);
  }
  resizeCancel(): void {
    this._resizing.set(null);
  }
  async resizeDone({ box, trx }: Behaviors.ResizeDoneArgs) {
    const bbox = this.clientRectObs.value.compose(box);

    // current user vertex
    const currentUser = this.context.currentUser.value;
    if (!currentUser) return;

    await currentUser.setJsonPropValues<ChatPanelState>(
      'chatPanelState',
      {
        width: bbox.width,
        height: bbox.height,
      },
      trx,
    );

    this._resizing.set(null);
  }

  @MemoizeOwned()
  get visible(): ObservableReader<boolean> {
    return this.state.mapObs((state) => state?.expanded ?? false);
  }

  @MemoizeOwned()
  get expanded() {
    return this.state.mapObs((state) => state?.expanded ?? false);
  }

  expand() {
    void this.context.currentUser.value?.setJsonPropValues<ChatPanelState>('chatPanelState', { expanded: true }, null);
  }
  collapse() {
    void this.context.currentUser.value?.setJsonPropValues<ChatPanelState>('chatPanelState', { expanded: false }, null);
  }
  toggle() {
    this.expanded.value ? this.collapse() : this.expand();
  }

  @OwnedProperty
  _defaultSpaceChats = new ObservableList<Chat>();

  registerSpace(space: TopicSpace) {
    const found = this._defaultSpaceChats.find((c) => c.vertex === space.vertex);
    if (found) return;

    // Default space chat
    const spaceChat = Chat.new({
      parentNode: this,
      privilegeCoalescenceParent: space,
      vertex: space.vertex,
      context: this.context,
      isSpaceChat: true,
    });
    this._defaultSpaceChats.insert(spaceChat);
  }
  deregisterSpace(space: TopicSpace) {
    if (!this.alive) return;

    const found = this._defaultSpaceChats.find((c) => c.vertex === space.vertex);
    if (found) {
      this._defaultSpaceChats.remove(found);
    }
  }
  // @MemoizeOwned()
  // get currentSpaceChat() {
  //   return mapObs(
  //     this.parentNode.topicSpace,
  //     (ts) => ts && ts.topicSpace.defaultSpaceChat,
  //   );
  // }
  // @MemoizeOwned()
  // get spaceChatBackrefs() {
  //   return mapObsList(this.currentSpace, (tsv) =>
  //     tsv?.vertex.filterBackrefs({ role: ['conversation'] }),
  //   );
  // }
  // get participantBackrefs() {
  //   return mapObsList(this.context.currentUser, (user) =>
  //     user?.filterBackrefs({ role: ['participant'] }),
  //   );
  // }
  // get generalChatBackrefs(){
  //     // exclude the space chat backrefs from the participant backrefs
  // TODO
  // }
  @MemoizeOwned()
  get conversationList() {
    // need to attach this to each chat listing (currently called ChatName, but it occurs to me that this needs to include the unread acount as well as the name)
    return ListNode.new<ChatPanel, ConversationListItem, Model.Vertex>({
      parentNode: this,
      precursor: this._defaultSpaceChats.mapObs((c) => c.vertex),

      factory: (vertex, parentNode) =>
        ConversationListItem.new({
          parentNode,
          vertex,
          context: this.context,
          isSpaceChat: true,

          onClick: () => {
            this.upgrade()?.chosenChat.upgrade()?.set(vertex);
          },
        }),
    });
  }
  @MemoizeOwned()
  get unreadCount() {
    // we have to subscribe to _defaultSpaceChats to observe conversations which are leaving / entering the list
    // And when one is added, we need to subscribe to ITS unreadCount observable, and unsubscribe when it's removed from the _defaultSpaceChats list
    // we can't use Observable.calculated because we have to subscribe to many individual unreadCount observables

    //TODO: we need some kind of reduceObsListOfObs function or something like that which does this
    // const unsubMap = new WeakMap<Chat, () => void>();
    // const calc = () => {
    //   let count = 0;
    //   for (const chat of this._defaultSpaceChats.value) {
    //     count += chat.unreadCount.value;
    //   }
    //   return count;
    // };

    // this.onCleanup(
    //   this._defaultSpaceChats.subscribe({
    //     ITEM_LISTENER: (chat, op, origin, ctx) => {
    //       if (op === 'ADD') {
    //         const unsub = chat.unreadCount.subscribe((unreadCount) => calc());
    //         unsubMap.set(chat, unsub);
    //       } else if (op === 'REMOVE') {
    //         const unsub = unsubMap.get(chat);
    //         if (unsub) {
    //           unsub();
    //           unsubMap.delete(chat);
    //         }
    //       }
    //     },
    //   }),
    // );

    return new Observable(42);

    // }});
  }
  // @MemoizeOwned()
  // get newSpaceChatButton() {
  //   return NewSpaceChatButton.new({
  //     parentNode: this,
  //     currentSpaceVertex: mapObs(this.currentSpace, (s) => s?.vertex),
  //   });
  // }

  // @MemoizeOwned()
  // get allChats() {
  //   return ListNode.new<ChatPanel, Chat, Model.Backref>({
  //     parentNode: this,
  //     precursor: this.spaceChatBackrefs, // TODO create a consolidated list of all chats, not just space chats
  //     factory: (backref, parentNode) =>
  //       Chat.new({
  //         parentNode,
  //         vertex: backref.target,
  //         context: this.context,
  //       }),
  //   });
  // }

  @OwnedProperty
  chosenChat = new Observable<Model.Vertex | null>(null);

  @MemoizeOwned()
  get activeChat(): ConditionalNode<Chat, Chat | null, ChatPanel> {
    const precursor = Observable.calculated(
      ({ chosen, defaultSpaceChats }) => {
        if (chosen) {
          const found = defaultSpaceChats.find((c) => c.vertex === chosen);
          if (found) {
            return found;
          }
        }

        return defaultSpaceChats[0] ?? null;
      },
      { chosen: this.chosenChat, defaultSpaceChats: this._defaultSpaceChats },
    );

    return ConditionalNode.new<Chat, Chat | null, ChatPanel>({
      parentNode: this,
      precursor,
      // Weeeird to return our own VM node from different accessors >_>
      // This feels very hacky, but we need something to perform the queries for the messages on each chat
      // Maybe this would be better done with a sort of service for each active chat?
      factory: (chat) => chat,
    });
  }
  //   get
  //   activeChat: ConditionalNode<Chat, ChatPanel> | null = null;

  //   @MemoizeOwned()
  //   get groupChats() {
  //     return ListNode.new<TSPage, Chat, Model.Backref>({
  //       parentNode: this,
  //       precursor: this.context.currentUser
  //         .value!.filterBackrefs({ role: ['participant'] })
  //         .filterObs(
  //           (b) => b.meta.value.expanded ?? true,
  //           undefined,
  //           undefined,
  //           true,
  //         ),
  //       factory: (backref, parentNode) =>
  //         Chat.new({
  //           parentNode,
  //           backref,
  //           vertex: backref.target,
  //           context: this.context,
  //         }),
  //     });
  //   }
  @MemoizeOwned()
  get clientRectObs(): ObservableReader<BoundingBox> {
    // TODO layout for multiple chat panels
    return Observable.calculated(
      ({ parentRect, state, resizing }) => {
        let { width, height } = state ?? {};
        width ??= 300;
        height ??= 400;
        return new BoundingBox({
          x: parentRect.right - (width + 12), // HACK
          y: parentRect.bottom - (height + 66),
          width,
          height,
        }).compose(resizing);
      },
      {
        parentRect: this.parentNode.clientRectObs,
        resizing: this._resizing,
        state: this.state,
      },
    );
  }
}
