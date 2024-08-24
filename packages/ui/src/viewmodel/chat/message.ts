import { MemoizeOwned, Observable } from '@edvoapp/util';
import { BranchNode, BranchNodeCA, ConditionalNode, ListNode } from '../base';
import { Chat } from './chat';
import { Model } from '@edvoapp/common';
import { UpdatablesSet } from '../base/updatables';
import { Button } from '../button';
import { ToolCallViewer } from '../tool-call-viewer';
import { UserAvatar } from '../user-avatar';
import { JsonViewer } from '../json-viewer';

type Parent = ListNode<Chat, Message>;

interface OutlineItemCA extends BranchNodeCA<Parent> {}

export class Message extends BranchNode<Parent> {
  label = 'Message';
  static new(args: OutlineItemCA): Message {
    const me = new Message(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['showToolCall', 'showJson', 'userAvatar'];
  }

  async load() {
    await super.load();
    await this.content.load();
  }

  get updatables(): UpdatablesSet {
    return new UpdatablesSet([this.bodyProperty, this.backref]);
  }
  @MemoizeOwned()
  get bodyProperty() {
    return this.backref.target
      .filterProperties({
        role: ['body'],
      })
      .firstObs();
  }

  @MemoizeOwned()
  get taskStatus() {
    return this.backref.target.getJsonPropValuesObs<{ status: string }>('task-status');
  }

  @MemoizeOwned()
  get isToolCall() {
    return this.backref.target
      .filterProperties({
        role: ['tool_call'],
        contentType: 'application/json',
      })
      .firstObs()
      .mapObs((v) => !!v);
  }

  @MemoizeOwned()
  get isDebugLog() {
    return this.backref.target
      .filterProperties({
        role: ['debug_logs'],
        contentType: 'application/json',
      })
      .firstObs()
      .mapObs((v) => !!v);
  }

  @MemoizeOwned()
  get userAvatar() {
    return ConditionalNode.new<UserAvatar, true>({
      parentNode: this,
      precursor: new Observable(true),
      factory: (_, parentNode) => {
        if (this.currentUserIsAuthor) return null;

        return UserAvatar.new({
          parentNode,
          vertex: Model.Vertex.getById({
            id: this.backref.subUserID ?? this.backref.userID,
          }),
          size: 'small',
          context: this.context,
          showNameAsTooltip: true,
        });
      },
    });
  }

  @MemoizeOwned()
  get content() {
    return this.bodyProperty.mapObs((p) => (p ? p.text : null));
  }

  get currentUserIsAuthor() {
    const userId = this.context.currentUser.value?.id;
    return this.backref.userID === userId && (!this.backref.subUserID || this.backref.subUserID === userId);
  }

  get selectable(): boolean {
    return true;
  }

  @MemoizeOwned()
  get showToolCall() {
    return new Button({
      parentNode: this,
      label: 'Show tool call',
      onClick: () => {
        ToolCallViewer.spawn({ vertex: this.vertex });
      },
    });
  }
  @MemoizeOwned()
  get showJson() {
    return new Button({
      parentNode: this,
      label: 'Show JSON',
      onClick: () => {
        JsonViewer.spawn({ vertex: this.vertex });
      },
    });
  }
}
