import { Model } from '@edvoapp/common';
import { getMetaKey } from '@edvoapp/util';
import equals from 'fast-deep-equal';
import {
  Action,
  ActionGroup,
  Behavior,
  DispatchStatus,
  equalsAny,
  EventNav,
  keyMappings,
  useNavigator,
} from '../service';
import * as VM from '../viewmodel';
import { JumpToTopic } from '../assets';
import { POSITION, TYPE } from '../service/toast';
import { toast } from 'react-toastify';

export class JumpTo extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const closestMember = originNode.closestInstance(VM.Member);
    const closestCard =
      closestMember || originNode.findClosest((n) => (n instanceof VM.ContentCard || n instanceof VM.DockItem) && n);
    const closestItem = originNode.closestInstance(VM.TopicItem);
    const node = closestItem || closestCard;
    if (!node) return [];

    let label: string;
    if (closestItem) label = 'Item';
    else if (closestCard) label = 'Card';
    else return [];

    const actions = [this.getJumpAction(node), this.getOpenInNewTabAction(node), this.getCopyLinkAction(node)].filter(
      Boolean,
    ) as Action[];

    return [{ label, actions }];
  }

  getJumpAction(node: VM.VertexNode | null | undefined): Action | null {
    if (!node || node instanceof VM.ContentCard) return null;
    // const property = this.getPropertyFromNode(node);
    // const contentType = property?.contentType;
    // ~~do not allow jump to resources~~
    // allow for now... :')
    // if (contentType === 'text/x-uri' || contentType === 'text/x-embed-uri')
    //   return null;
    return {
      icon: JumpToTopic,
      label: 'Jump to Topic',
      hotkey: `${getMetaKey()}-J`,
      apply: () => {
        void this.jumpToTopic(node);
      },
    };
  }

  getOpenInNewTabAction(node: VM.VertexNode | null | undefined): Action | null {
    if (!node) return null;
    const property = this.getPropertyFromNode(node);
    const contentType = property?.contentType;
    if (contentType === 'text/x-uri' || contentType === 'text/x-embed-uri') {
      return {
        label: 'Open page in new Tab',
        hotkey: `${getMetaKey()}-O`,
        apply: () => {
          void this.doOpenInNewTab(node);
        },
      };
    }
    return null;
  }

  getCopyLinkAction(node: VM.VertexNode | null | undefined): Action | null {
    if (!node) return null;
    const property = this.getPropertyFromNode(node);
    const contentType = property?.contentType;
    const content = property?.text.value;
    if (contentType === 'text/x-uri' || (contentType === 'text/x-embed-uri' && content)) {
      return {
        label: 'Copy link to clipboard',
        // hotkey: `${getMetaKey()}-O`,
        apply: () => {
          void this.doCopyLink(node);
        },
      };
    }
    return null;
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof VM.Member && n);
    if (!node) return 'decline';

    if (equalsAny('meta-j')) {
      this.jumpToTopic(node);
      return 'stop';
    }

    if (equalsAny('meta-o')) {
      void this.doOpenInNewTab(node);
      return 'stop';
    }
    return 'decline';
  }

  jumpToTopic(node: VM.VertexNode) {
    const nav = useNavigator();
    node.context.focusState.setPendingFocus({
      match: (x) => x instanceof VM.TopicSpace && x.vertex === node.vertex,
      context: {},
    });
    nav.openTopic(node.vertex);
  }

  // Ideally we would be able to await node.vertex.filterProperties(...).toArray()
  // but this method needs to be synchronous.
  getPropertyFromNode(node: VM.VertexNode) {
    let property: Model.Property | null | undefined = null;
    // this is a "borrow"
    if (node instanceof VM.Member) property = node.body.value?.content.property.value;
    if (node instanceof VM.ContentCard) property = node.content.property.value;
    if (node instanceof VM.DockItem) property = node.body.value?.body.content.property.value;
    if (node instanceof VM.TopicItem) property = node.bodyProperty.value;
    if (node instanceof VM.MemberBody) property = node.content.property.value;
    return property;
  }

  // This navigates the user to a new tab and opens the URL saved in the vertex.
  doOpenInNewTab(node: VM.VertexNode) {
    const property = this.getPropertyFromNode(node);
    const contentType = property?.contentType;
    if (contentType === 'text/x-uri' || contentType === 'text/x-embed-uri') {
      const nav = useNavigator();
      void nav.openVertexInTab({
        vertex: node.vertex,
        newTab: true,
      });
    }
  }

  doCopyLink(node: VM.VertexNode) {
    const property = this.getPropertyFromNode(node);
    const contentType = property?.contentType;
    const content = property?.text.value;
    if (!content) return;
    if (contentType === 'text/x-uri' || contentType === 'text/x-embed-uri') {
      void navigator.clipboard.writeText(content);
      toast.info('Link copied to clipboard!', {
        type: TYPE.INFO,
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        draggable: false,
        position: POSITION.TOP_CENTER,
      });
    }
  }
}
