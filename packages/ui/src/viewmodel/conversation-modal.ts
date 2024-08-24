import { MemoizeOwned } from '@edvoapp/util';
import { Annotator } from '../service';
import { Highlight, HighlightRenderContext } from '../service/annotator/highlight';
import { VertexNode, VertexNodeCA, Node, ChildNodeCA, ChildNode } from './base';
import { Outline } from './outline/outline';

export interface ActiveConversation {
  highlight: Highlight<HighlightRenderContext>;
  highlightManager: Annotator.HighlightManager;
}

interface Args extends ChildNodeCA<Node> {
  activeConversation: ActiveConversation;
}

export class ConversationModal extends ChildNode {
  activeConversation: ActiveConversation;
  constructor({ activeConversation, ...args }: Args) {
    super(args);
    this.activeConversation = activeConversation;

    // It is very unusual to have a component that focuses itself on creation, but given the fact that this is a modal
    // It would seem to make sense here
    this.defer(() => {
      void this.context.focusState.setFocus(this, {});
    });
  }
  static new(args: Args) {
    const me = new ConversationModal(args);
    me.init();
    return me;
  }
  get childProps(): (keyof this & string)[] {
    return ['outline'];
  }

  @MemoizeOwned()
  get outline() {
    return Outline.new({
      vertex: this.activeConversation.highlight.vertex,
      context: this.context,
      parentNode: this,
    });
  }
  focusHighlight(highlight: Highlight<HighlightRenderContext> | null) {
    this.activeConversation.highlightManager.focusHighlight(highlight);
  }
  @MemoizeOwned()
  get modalPosition() {
    const { positionInfo } = this.activeConversation.highlight;

    return positionInfo.mapObs((positionInfo) => {
      let { top, bottom, left, width } = positionInfo?.boundingRect || {
        top: 0,
        bottom: 0,
        left: 0,
        width: 0,
      };

      const defaultWidth = 500;

      console.log('modalPosition', top, bottom, left, width);

      if (width > defaultWidth) {
        width = Math.min(defaultWidth, width);
      } else {
        width = defaultWidth;
      }
      return {
        top,
        left,
        width,
      };
    });
  }
}
