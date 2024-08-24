import { Model, trxWrap } from '@edvoapp/common';

import { getContrastColor } from '../lib/color';
import { DEFAULT_CARD_DIMS, DEFAULT_PORTAL_DIMS, DEFAULT_WEBCARD_DIMS, DispatchStatus, EventNav } from '../service';
import { Behavior, equalsAny } from '../service/Behavior';

import { MemberAppearance, MemberAppearanceType } from './appearance-type';
import * as VM from '../viewmodel';
import { AppDesktop, BranchNode } from '../viewmodel';
import { Guard } from '@edvoapp/util';

type Position = { x: number; y: number };

/**
 * @deprecated use MemberAppearanceType from behaviors/appearance-type
 */
export type MemberType = MemberAppearanceType;

export class QuickAddActivate extends Behavior {
  constructor(readonly quickAdd: QuickAdd) {
    super();
  }
  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, node: VM.Node): DispatchStatus {
    // We might be handling an ESC.
    const key = e.key.toLowerCase();

    const topicSpace = node.findClosest((n) => n instanceof VM.TopicSpace && n);
    const rootNode = node.findClosest((n) => n instanceof AppDesktop && n);
    if (!rootNode) return 'decline';

    if (equalsAny('meta-/')) {
      this.quickAdd.activateQuickAddMode(rootNode, 'card-search');
      return 'stop';
    }
    const tsPage = node.findClosest((x) => x instanceof VM.TSPage && x);

    // currently we don't support quick-add outside the context of a tsPage, so may as well decline
    // if/when we decide to support quick-add elsewhere, we will have to be careful to deconflict priorities,
    // because currently it will steal events that are supposed to go to KeyFocus
    if (!tsPage) return 'decline';

    let ret: DispatchStatus;
    switch (key) {
      case 'n': {
        this.quickAdd.activateQuickAddMode(rootNode, 'normal');
        ret = 'stop';
        break;
      }
      case 'a': {
        this.quickAdd.activateQuickAddMode(rootNode, 'list');
        ret = 'stop';
        break;
      }
      case 's': {
        this.quickAdd.activateQuickAddMode(rootNode, 'stickynote');
        ret = 'stop';
        break;
      }
      // case 'b': {
      //   this.quickAdd.activateQuickAddMode(rootNode, 'browser');
      //   ret = 'stop';
      //   break;
      // }
      // case 't': {
      //   // TODO: Move this somewhere else. It's not a qui.
      //   topicSpace?.templateOpen.set(true);
      //   ret = 'stop';
      //   // This is necessary for the ESC.
      //   eventNav.setGlobalBehaviorOverrides(this, ['handleKeyDown']);
      //   break;
      // }
      case 'escape':
      case 'esc':
        if (!rootNode.quickAdding.value) return 'decline';
        tsPage.topicSearchCardOpen.set(false);
        topicSpace?.setTemplateOpen(false);

        // Why clear this? Keep the node type for possible double-clicks.
        // It doesn't hurt anybody.
        // this.nextMemberType.set(null);

        rootNode.quickAdding.set(false);
        this.quickAdd.handleSingleClick = false;
        ret = 'stop';
        break;
      default:
        ret = 'decline';
        break;
    }
    return ret;
  }
}

export class QuickAdd extends Behavior {
  priority = true;

  nextMemberType: MemberAppearanceType = 'stickynote';
  nextMemberColor: string | undefined;
  nextMemberDims: { height: number; width: number } | undefined;
  handleSingleClick = false;

  activateQuickAddMode(rootNode: VM.AppDesktop, type: MemberAppearanceType) {
    // Revert to the default color if we are adding a different type of member than previously
    if (type != this.nextMemberType) this.nextMemberColor = undefined;

    // QuickAdd.nextMemberColor = nextMemberColor;
    this.nextMemberType = type;

    rootNode.quickAdding.set(true);
    // NOTE: this doesn't _really_ belong here, because it's already in mousemove, but that only activates on mousemove,
    // and we need this to update instantly.
    document.documentElement.style.cursor = 'crosshair';
    this.handleSingleClick = true;

    const eventNav = rootNode.context.eventNav;
    eventNav.setGlobalBehaviorOverrides(this, ['handleKeyDown', 'handleMouseDown']);
  }

  quickAdd(topicSpace: VM.TopicSpace, memberType: MemberAppearanceType, clientCoords: { x: number; y: number }) {
    const coords = topicSpace.clientCoordsToSpaceCoords(clientCoords);
    if (!coords) return 'decline';

    this.handleCreate(
      topicSpace.context.eventNav,
      topicSpace,
      coords,
      {
        clientX: clientCoords.x,
        clientY: clientCoords.y,
      },
      memberType,
    );
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    eventNav.unsetGlobalBehaviorOverrides(this);
    const key = e.key.toLowerCase();
    const topicSpace = originNode.findClosest((n) => n instanceof VM.TopicSpace && n);
    const rootNode = originNode.findClosest((n) => n instanceof AppDesktop && n);
    if (!rootNode) return 'decline';
    if (!rootNode.quickAdding.value) return 'decline';
    const tsPage = rootNode.topicSpace.value;

    // currently we don't support quick-add outside the context of a tsPage, so may as well decline
    // if/when we decide to support quick-add elsewhere, we will have to be careful to deconflict priorities,
    // because currently it will steal events that are supposed to go to KeyFocus
    if (!tsPage) return 'decline';

    if (['esc', 'escape'].includes(key)) {
      tsPage?.topicSearchCardOpen.set(false);
      topicSpace?.setTemplateOpen(false);
      rootNode.quickAdding.set(false);
      this.handleSingleClick = false;
      // NOTE: this doesn't _really_ belong here, because it's already in mousemove, but that only activates on mousemove,
      // and we need this to update instantly.
      document.documentElement.style.cursor = 'default';
      return 'stop';
    }
    return 'decline';
  }

  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    eventNav.unsetGlobalBehaviorOverrides(this);

    const tsPage = originNode.findClosest((n) => n instanceof VM.TSPage && n);
    const topicSpace = originNode.findClosest((n) => n instanceof VM.TopicSpace && n);

    const rootNode = originNode.findClosest((n) => n instanceof AppDesktop && n);
    if (!rootNode) return 'decline';

    if (!rootNode.quickAdding.value) return 'decline';

    // Note: eventually we should handle this better, but for now, i think it makes sense to only allow QuickAdd if you click directly on the topic space
    if (!topicSpace) return 'decline';

    if (!(originNode instanceof VM.TopicSpace)) return 'decline';
    if (!this.handleSingleClick) {
      tsPage?.topicSearchCardOpen.set(false);
      return 'decline';
    }
    this.handleSingleClick = false;
    topicSpace.setHandleSingleClick(false);

    const coords = topicSpace.clientCoordsToSpaceCoords({
      x: e.clientX,
      y: e.clientY,
    });
    this.handleCreate(eventNav, topicSpace, coords, e);

    rootNode.quickAdding.set(false);

    return 'stop';
  }

  handleDoubleClick(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const node = originNode.findClosest((n) => n instanceof VM.TopicSpace && n);
    // Note: eventually we should handle this better, but for now, i think it makes sense to only allow QuickAdd if you click directly on the topic space
    if (!(originNode instanceof VM.TopicSpace) || !node) return 'decline';
    const doubleClickToCreateEnabled = node.context.authService.currentUserVertexObs.mapObs((user) =>
      user ? user.getFlagPropertyObs('double-click-to-create-enabled').mapObs((v) => !!v) : user,
    ).value;
    if (!doubleClickToCreateEnabled) return 'decline';

    const coords = node.clientCoordsToSpaceCoords({
      x: e.clientX,
      y: e.clientY,
    });
    this.handleCreate(eventNav, node, coords, e, undefined, true);
    return 'stop';
  }

  cardSearch(eventNav: EventNav, node: VM.TopicSpace, event: { clientY: number; clientX: number }) {
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseDown', 'handleKeyDown']);
    const searchCard = node.topicSearchCard;
    searchCard.parentNode.topicSearchCardOpen.set(true);

    if (!searchCard.value) return 'decline';

    searchCard.value.spaceCoords.set({ x: event.clientX, y: event.clientY });
    const coords = node.clientCoordsToSpaceCoords({
      x: event.clientX,
      y: event.clientY,
    });

    if (!coords) return 'decline';

    searchCard.value.coords.set(coords);
    searchCard.value.visible.set(true);
    void eventNav.focusState.setFocus(searchCard.value, {});
  }

  handleCreate(
    eventNav: EventNav,
    node: VM.TopicSpace,
    coords: Position,
    e: { clientY: number; clientX: number },
    memberType?: MemberAppearanceType,
    copyLast?: boolean,
  ) {
    memberType ??= this.nextMemberType;

    if (memberType === null) return;
    if (memberType === 'card-search') return this.cardSearch(eventNav, node, e);
    const nextMemberDims = this.nextMemberDims;

    this.trace(1, () => ['adding QuickAdd']);
    const vertex = node.vertex;
    const lastMember = node.members.lastChild() as BranchNode | null;

    let defaultColor = memberType === 'stickynote' ? '#E0E31A' : '#FFF';
    const color = copyLast ? this.nextMemberColor ?? defaultColor : defaultColor;
    const textColor = getContrastColor(color);

    const defaultDims = (() => {
      switch (memberType) {
        case 'subspace':
          return DEFAULT_PORTAL_DIMS;
        case 'browser':
          return DEFAULT_WEBCARD_DIMS;
        case 'stickynote':
        case 'normal':
          return DEFAULT_CARD_DIMS;
        default:
          return;
      }
    })();

    const dims = copyLast ? nextMemberDims : defaultDims;

    const meta: Model.TopicSpaceCardState = {
      x_coordinate: coords.x,
      y_coordinate: coords.y,
      ...dims,
    };

    void trxWrap(async (trx) => {
      await Guard.while(Model.Vertex.create({ trx }), async (noteVertex) => {
        const role = ['member-of'];
        if (memberType === 'stickynote') {
          noteVertex.createProperty({
            trx,
            role: ['body'],
            contentType: 'text/plain',
            initialString: '',
          });
        } else {
          // is an outline card
          role.push('tag');
        }
        await noteVertex.setJsonPropValues<MemberAppearance>(
          'appearance',
          {
            color,
            textColor,
            type: memberType,
          },
          trx,
        );

        eventNav.focusState.setPendingFocus({
          match: (n) => {
            return (
              node.contains(n) &&
              (n
                .closest((n) => n instanceof VM.MemberBody && n.vertex == noteVertex)
                ?.findChild((n) => n.focusable && n) ??
                false)
            );
          },
          context: {},
        });

        noteVertex.createEdge({
          trx,
          role,
          target: vertex,
          seq: (lastMember?.seq ?? 0) + 1,
          meta,
        });
      });
    });
  }
}
