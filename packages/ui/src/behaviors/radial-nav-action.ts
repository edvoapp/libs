import { Behavior, DispatchStatus, EventNav } from '..';
import * as VM from '../viewmodel';
import { MemberType } from './quick-add';

export class RadialNavAction extends Behavior {
  handleMouseDown(eventNav: EventNav, event: MouseEvent, originNode: VM.Node): DispatchStatus {
    // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
    const middleClick = event.button === 1; // ?
    if (!(originNode instanceof VM.TopicSpace) || !middleClick) return 'decline';

    const tsPage = originNode.findClosest((n) => n instanceof VM.TSPage && n);
    if (!tsPage) return 'decline';
    tsPage.radialNavOpen.set(true);

    const rnav = tsPage.radialNav.value;
    if (!rnav) return 'decline';

    document.documentElement.style.cursor = 'default';

    const { x, y } = { x: event.clientX, y: event.clientY };

    rnav.summoned.set({ x, y, topicSpace: originNode });

    void eventNav.focusState.setFocus(rnav, {});

    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseUp']);

    return 'stop';
  }

  handleMouseUp(eventNav: EventNav, event: MouseEvent, originNode: VM.Node): DispatchStatus {
    const tsPage = originNode.closestInstance(VM.TSPage);
    const rnav = originNode instanceof VM.RadialNav ? originNode : tsPage?.radialNav.value;
    if (!rnav) return 'decline';

    eventNav.unsetGlobalBehaviorOverrides(this);

    const rnavBtn = originNode.findClosest((n) => n instanceof VM.RadialNavButton && n);

    if (rnavBtn && rnavBtn.memberType) {
      let memberType: MemberType | null = rnavBtn.memberType;
      rnav.quickAdd(memberType);
    }

    rnav.summoned.set(null);
    rnav.setHover(false);
    tsPage?.radialNavOpen.set(false);
    return 'stop';
  }

  handleKeyDown(_eventNav: EventNav, event: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    const tsPage = originNode.closestInstance(VM.TSPage);
    const key = event.key.toLowerCase();
    if (!(originNode instanceof VM.RadialNav) || !(key === 'escape')) return 'decline';

    const rnav = tsPage?.radialNav.value;
    if (!rnav) return 'decline';

    rnav.isFocused.set(false);
    tsPage?.radialNavOpen.set(false);
    return 'stop';
  }
}
