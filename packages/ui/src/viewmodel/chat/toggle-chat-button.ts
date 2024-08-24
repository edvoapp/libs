import { MemoizeOwned } from '@edvoapp/util';
import { AppDesktop, Button, ButtonCA, ChatPanel } from '..';

interface CA extends ButtonCA<AppDesktop> {
  chatPanel: ChatPanel;
}
export class ToggleChatButton extends Button<AppDesktop> {
  chatPanel: ChatPanel;
  constructor({ chatPanel, ...args }: CA) {
    super(args);
    this.chatPanel = chatPanel;
  }
  static new(args: CA) {
    const me = new ToggleChatButton(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get unreadCount() {
    return this.chatPanel.unreadCount;
  }

  onClick() {
    this.chatPanel.toggle();
  }
}
