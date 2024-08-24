import {
  AsyncFilterMapObservableList,
  IObservable,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  WeakProperty,
  mapObs,
} from '@edvoapp/util';

import {
  BoundingBox,
  BranchNode,
  BranchNodeCA,
  ConditionalNode,
  ListNode,
  OverrideBoundingBox,
  PrivilegeComputingObject,
  VertexNode,
  VertexNodeCA,
} from '../base';
import { Message } from './message';
import { Firebase, Model, trxWrapSync } from '@edvoapp/common';
import { PropertyConfig, TextField } from '../text-field';
import { AgentInstance, Behavior, getAgentManager } from '../../service';
import * as Behaviors from '../../behaviors';
import { SpeakButton } from './speak-button';

import { TypingIndicator, RawTypingIndicatorData, FlattenedTypingIndicatorData } from './typing-indicator';
import { PrivState } from '@edvoapp/common/dist/model/privileges';
import { UpdatablesSet } from '../base/updatables';
import { ConversationLabel } from './conversation-label';
import { ToggleAgentButton } from './toggle-agent';
import { ChatGPTAgent } from '../../service/assistant/chatgpt';
import { ChatPanel } from './chatpanel';

// Set this to the longest duration we want to be seeing typing indicators
// The list will be re-evaluated at every half of this interval

// Example: If someone sent a message at 2501, we re-evaluate at 5000; it's 2499ms old so it's fresh
// we re-evaluate at 7500; it's 4999ms old so it's fresh
// we re-evaluate at 10000; it's 7499ms old so it goes away
// thus, it took 5 whole seconds (10000-5000) for the indicator to go away

// Example 2: if someone sent a message at 2499, we re-evaluate at 2500; it's 1ms old so it's fresh
// we re-evaluate at 5000; it's 5001ms old so it goes away
// so it disappears after 2.5s (5000-2500)

const ABSENT_CUTOFF_LIMIT = 50_000;

interface CA extends VertexNodeCA<ChatPanel> {
  isSpaceChat?: boolean;
}

// TODO: make a floating panel?
export class Chat extends VertexNode<ChatPanel> {
  rtdb: Firebase.Database;

  isSpaceChat: boolean;
  // everything returned from the db
  @OwnedProperty
  _typingIndicationList = new ObservableList<FlattenedTypingIndicatorData>();

  // filtered; gets re-run every 1s
  @MemoizeOwned()
  get typingIndicationList() {
    const currentUserID = this.context.currentUser.value?.id;

    return this._typingIndicationList.filterMapObs<Model.Vertex>((val) => {
      const now = Date.now();
      const { userID, timestamp = 0, subUserID } = val;
      // Never show typing indicator if it is older than 5 sec
      if (timestamp <= now - ABSENT_CUTOFF_LIMIT) return;

      // Don't show my own messages
      if (userID === currentUserID && !subUserID) return;

      const newestMessageByUser = this.getNewestMessageByUser(userID, subUserID);
      // if there is no newest message, then show the typing indicator
      if (!newestMessageByUser) return Model.Vertex.getById({ id: subUserID ?? userID });
      const newestMessageTimestamp = newestMessageByUser.seq.value;

      // don't show a typing indicator if there is a message from this user that is newer than the indicator's timestamp
      if (newestMessageTimestamp > timestamp) return;
      return Model.Vertex.getById({ id: subUserID ?? userID });
    });
  }

  conversationRef: Firebase.firebase.database.Reference;

  constructor({ isSpaceChat, ...args }: CA) {
    super(args);
    this.rtdb = Firebase.database();
    this.isSpaceChat = isSpaceChat ?? false;

    const conversationRef = this.rtdb.ref(`chat/${this.vertex.id}/user`);
    this.conversationRef = conversationRef;

    // Any time we get a new value, update
    const cb = conversationRef.on('value', (snapshot) => {
      if (!this.alive) return;
      const vals = Object.values<RawTypingIndicatorData>(snapshot?.val() ?? {});
      this.updateFromDb(vals);
    });
    this.onCleanup(() => conversationRef.off('value', cb));

    // initial get
    void conversationRef.get().then((snapshot) => {
      if (!this.alive) return;
      const vals = Object.values<RawTypingIndicatorData>(snapshot?.val() ?? {});
      this.updateFromDb(vals);
    });

    const heartbeat = setInterval(() => {
      this.typingIndicationList.reevaluate();
    }, ABSENT_CUTOFF_LIMIT / 2);
    this.onCleanup(() => clearInterval(heartbeat));

    const currentUserID = this.context.currentUser.value?.id;
    this.managedSubscription(this.pendingMessage, (val) => {
      if (!currentUserID) return;
      const userRef = conversationRef.child(currentUserID);
      void userRef.set({
        userID: currentUserID,
        // If the user has deleted all text, then set timestamp to 0
        timestamp: val.length ? Date.now() : 0,
      });
    });
  }

  static new(args: CA) {
    const me = new Chat(args);
    me.init();
    return me;
  }

  getHeritableBehaviors(): Behavior[] {
    return [new Behaviors.Transcribe()];
  }

  getNewestMessageByUser(userID: string, subUserID?: string) {
    const messages = this.messageBackrefs.value;

    const messagesByThisUser = messages.filter(
      (backref) => backref.userID === userID && (!backref.subUserID || backref.subUserID === subUserID),
    );
    if (messagesByThisUser.length === 0) return null;
    return messagesByThisUser[messagesByThisUser.length - 1];
  }

  updateFromDb(newValue: RawTypingIndicatorData[]) {
    let changed = false;
    for (const { userID, sub, timestamp } of newValue) {
      if (sub) {
        // if we have sub, then it's not the user, it's an agent
        // Note that this includes other users' agents that may be present in the conversation
        for (const { userID: subUserID, timestamp } of Object.values(sub)) {
          const existingRecord = this._typingIndicationList.find(
            (val) => userID === val.userID && !!val.subUserID && subUserID === val.subUserID,
          );
          if (existingRecord) {
            existingRecord.timestamp = timestamp;
            changed = true;
          } else {
            this._typingIndicationList.insert({ userID, subUserID, timestamp });
          }
        }
      }
      const existingRecord = this._typingIndicationList.find((val) => userID === val.userID && !val.subUserID);
      if (existingRecord) {
        existingRecord.timestamp = timestamp;
        changed = true;
      } else {
        // omit sub
        this._typingIndicationList.insert({ userID, timestamp });
      }
    }

    // This probably doesn't need to be done since we're pinging every second anyway
    if (changed) this.typingIndicationList.reevaluate();
  }

  get selectable(): boolean {
    return true;
  }

  get childProps(): (keyof this & string)[] {
    return ['messages', 'textfield', 'speakButton', 'participants', 'typingIndicator', 'toggleAgentButton'];
  }

  @OwnedProperty
  activeAgents = new ObservableList<AgentInstance>();

  init() {
    super.init();

    let agentBackrefs = this.vertex.filterEdges(['agent-participant']);
    agentBackrefs.registerReferent(this, 'agent-backrefs');

    this.onCleanup(
      agentBackrefs.subscribe(
        {
          ITEM_LISTENER: (backref, type, origin, ctx) => {
            if (!this.alive) return;
            if (type === 'ADD') {
              const agent = getAgentManager().findAgent(backref.target);
              if (agent) {
                const instance = agent.getInstance(this.vertex);
                this.activeAgents.insert(instance);
              }
            } else if (type === 'REMOVE') {
              const instance = this.activeAgents.find((x) => x.agent.user === backref.target);
              if (instance) {
                // This should cause the agent instance to unsubscribe from the chat
                this.activeAgents.remove(instance);
              }
            }
          },
        },
        true,
      ),
    );

    this.onCleanup(
      this.typingIndicationList.subscribe({
        ITEM_LISTENER: (val, op, origin, ctx) => {
          if (op === 'ADD') {
            this.parentNode.expand();
          }
        },
      }),
    );
  }

  // ALL participants, here for sharing purposes
  @MemoizeOwned()
  get _participants() {
    return this.vertex.filterEdges(['participant']);
  }

  // All participants other than me
  @MemoizeOwned()
  get participants() {
    return ConversationLabel.new({
      parentNode: this,
      context: this.context,
      vertex: this.vertex,
      isSpaceChat: this.isSpaceChat,
    });
  }

  @MemoizeOwned()
  get typingIndicator() {
    // This should be based on presence data, not participant data

    return TypingIndicator.new({
      parentNode: this,
      avatars: this.typingIndicationList,
    });
  }

  // Invites a user and adds a share instruction to the chat
  inviteUser(userId: string) {
    trxWrapSync((trx) => {
      const user = Model.Vertex.getById({ id: userId });
      this.vertex.createEdge({
        trx,
        target: user,
        role: ['participant'],
        meta: {},
        // meta: { expanded: true },
      });
      Model.Priv.Share.create({
        trx,
        vertex: this.vertex,
        data: {
          shareType: 'allow',
          shareCategory: 'write',
          targetUserID: user.id,
        },
      });
    });
  }

  // TODO: implement pagination here
  @MemoizeOwned()
  get messageBackrefs() {
    return (
      this.vertex
        .filterBackrefs({
          role: ['message'],
        })
        // chronological -- last one is the newest one
        // TODO: consider doing reverse-chron, because we want to paginate later
        // requires doing flex reverse in the react component
        .sortObs((a, b) => a.seq.value - b.seq.value)
    );
  }

  @MemoizeOwned()
  get messages(): ListNode<Chat, Message, Model.Backref> {
    return ListNode.new<Chat, Message, Model.Backref>({
      parentNode: this,
      label: 'message-list',
      precursor: this.messageBackrefs,
      iterateChildrenForwards: true,
      factory: (backref, parentNode, index) => {
        return Message.new({
          parentNode,
          index,
          vertex: backref.target,
          backref,
          context: this.context,
        });
      },
    });
  }

  @MemoizeOwned()
  get speakButton() {
    return SpeakButton.new({ parentNode: this });
  }

  @OwnedProperty
  pendingMessage = new Observable('');

  // @MemoizeOwned()
  // get unreadCount() {
  //   // count messages without a read property
  //   // return mapObs(
  //   //   new AsyncFilterMapObservableList<Model.Backref, number>(
  //   //     this.messageBackrefs,
  //   //     async (backref) => {
  //   //       const read = await backref.target.getFlagProperty('read');
  //   //       return read ? 0 : 1;
  //   //     },
  //   //   ),
  //   //   (v) => v.reduce((a, b) => a + b, 0),
  //   // ).debounced(500);

  // }

  @MemoizeOwned()
  get textfield() {
    const tf = TextField.singleString({
      parentNode: this,
      fitContentParent: this,
      onChange: (s) => this.pendingMessage.set(s),
      emptyText: 'Ask anything...',
      onSubmit: () => {
        trxWrapSync((trx) => {
          const message = Model.Vertex.create({ trx });
          message.createEdge({
            trx,
            target: this.vertex,
            role: ['message'],
            meta: { messageRole: 'user' },
            seq: Date.now(),
          });
          message.createBodyTextProperty({
            trx,
            initialText: this.pendingMessage.value,
          });
        });

        tf.clearContent();
      },
    });
    return tf;
  }

  @MemoizeOwned()
  get toggleAgentButton() {
    const agentManager = getAgentManager();
    return ConditionalNode.new<ToggleAgentButton, ChatGPTAgent | null | undefined, Chat>({
      precursor: agentManager.agents.firstObs(),
      parentNode: this,
      factory: (agent, parentNode) => {
        return agent
          ? ToggleAgentButton.new({
              parentNode,
              conversation: this.vertex,
            })
          : null;
      },
    });
  }
}
