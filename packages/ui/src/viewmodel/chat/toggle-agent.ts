import { Node, ChildNode, ChildNodeCA, ConditionalNode, VertexNode } from '../base';
import { AppDesktop } from '../app-desktop';
import { Clickable } from '../../behaviors';
import { Model, trxWrap, trxWrapSync } from '@edvoapp/common';
import { MemoizeOwned, Observable, ObservableList, OwnedProperty, mapObs } from '@edvoapp/util';
import { Chat } from './chat';
import { TextField } from '../text-field';
import { getAgentManager } from '../../service/assistant/manager';
import { Button, ButtonCA } from '../button';

interface CA extends ButtonCA {
  conversation: Model.Vertex;
}

export class ToggleAgentButton extends Button {
  @OwnedProperty
  conversation: Model.Vertex;
  constructor({ conversation, ...args }: CA) {
    super(args);
    this.conversation = conversation;
  }
  static new(args: CA) {
    const me = new ToggleAgentButton(args);
    me.init();
    return me;
  }
  @MemoizeOwned()
  get agentEdges() {
    return this.conversation.filterEdges(['agent-participant']);
  }
  @MemoizeOwned()
  get active() {
    return mapObs(this.agentEdges, (edges) => edges.length > 0);
  }

  onClick() {
    const manager = getAgentManager();
    const agent = manager.primaryAgent;
    const user = this.context.authService.currentUserVertexObs.value;
    if (!agent || !user) {
      return;
    }

    const activeEdge = this.agentEdges.find((edge) => edge.target === agent.user);
    if (activeEdge) {
      trxWrapSync((trx) => {
        activeEdge.archive(trx);
      });
    } else {
      trxWrapSync((trx) => {
        this.conversation.createEdge({
          trx,
          target: agent.user,
          role: ['participant', 'agent-participant'],
          meta: {},
        });
      });
    }

    // if (activeConversation) {
    //   void trxWrap(async (trx) => {
    //     await activeConversation.setMetaMerge({
    //       trx,
    //       meta: { expanded: false },
    //     });
    //   });
    // } else if (inactiveConversation) {
    //   void trxWrap(async (trx) => {
    //     await inactiveConversation.setMetaMerge({
    //       trx,
    //       meta: { expanded: true },
    //     });
    //   });
    // } else if (agent && user) {
    //   trxWrapSync((trx) => {
    //     // create edge to agent
    //     conversation.createEdge({
    //       trx,
    //       target: agent.user,
    //       role: ['participant', 'agent-participant'],
    //       meta: {},
    //     });
    //     // create edge to user
    //     conversation.createEdge({
    //       trx,
    //       target: user,
    //       role: ['participant'],
    //       meta: {},
    //     });
    //   });
    // }
  }
}
// type NewChatWindowParent = ConditionalNode<
//   NewChatWindow,
//   Model.Vertex | null | undefined,
//   AppDesktop
// >;

// export class InviteAgentSomething extends ChildNode<NewChatWindowParent> {
//   static new(args: ChildNodeCA<NewChatWindowParent>) {
//     const me = new NewChatWindow(args);
//     me.init();
//     return me;
//   }

//   get childProps(): (keyof this & string)[] {
//     return ['textfield'];
//   }

//   @MemoizeOwned()
//   get textfield() {
//     return TextField.singleString({
//       parentNode: this,
//       fitContentParent: this,
//       emptyText: 'Agent Name',
//       onSubmit: () => this.createAgent(),
//       onChange: (s) => this.agentName.set(s),
//     });
//   }

//   @MemoizeOwned()
//   get agentName() {
//     return new Observable('');
//   }
// }
