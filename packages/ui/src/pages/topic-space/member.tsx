import { Model } from '@edvoapp/common';
import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import { Spinner } from '../../assets';
import { ActionMenu, Behaviors, SharingStatus, VM } from '../..';
import { useSharedBranchNode } from '../../hooks/useSharedState';
import { SpaceCard } from './topic-space-card';
import { MemberBody } from './member-body';
import { TopicControls as TopicControlsR } from '../../components/topic-space/card';
import './topic-space.scss';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { NameTagField } from './name-tag-field';
import { UrlBar } from '../../components/url-bar';
import { createPortal } from 'preact/compat';
import { AppDesktop } from '../../viewmodel';

type Props = {
  node: VM.Member;
};

export const MemberCard = ({ node }: Props) => {
  const { shared, changed } = useSharedBranchNode(node);
  const appearance = useObserveValue<Behaviors.MemberAppearance | undefined>(() => node.computedAppearance, [node]);

  const visible = useObserveValue(() => node.visible, [node]);
  const readonly = !useObserveValue(() => node.backref.editable, [node]);
  const body = useObserveValue(() => node.body, [node]);
  const hasIcon = !!useObserveValueMaybe(() => body?.content.icon, [body]);

  const header = useObserveValue(() => node.header, [node]);
  const actionMenu = useObserveValue(() => node.actionMenu, [node]);

  const tileMode = useObserveValue(() => (node.root as AppDesktop)?.tileContainer.visible, [node]);
  // const expanded =
  //   node instanceof VM.Member
  //     ? useObserveValue(() => node.topicCard.expanded, [node])
  //     : false;

  if (!visible) return null;

  if (appearance === undefined) {
    return (
      <SpaceCard
        loading
        member
        {...{
          shared,
          changed,
          node,
          hasIcon,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
          }}
        >
          <Spinner className="animate-spin h-10 w-10 text-indigo-600 mb-3" />
        </div>
      </SpaceCard>
    );
  }

  return (
    <>
      {actionMenu && <ActionMenu node={actionMenu} />}
      {header && !tileMode && <Header node={header} />}
      <SpaceCard
        member
        appearance={appearance?.type}
        bgColor={appearance?.color}
        {...{
          readonly,
          shared,
          changed,
          node,
          hasIcon,
        }}
      >
        {body && <MemberBody node={body} />}
      </SpaceCard>
    </>
  );
};

type HeaderProps = {
  node: VM.MemberHeader;
  expanded?: boolean;
  noBackground?: boolean;
};

function Header({ node, expanded }: HeaderProps) {
  const titleRef = useRef<HTMLDivElement>();

  // const urlBar = useObserveValue(() => node.urlBar, [node]);
  const hover = useObserveValue(() => node.hover, [node]);
  const showCount = Boolean(node.showCount && !expanded && hover);
  const count = useObserveValueMaybe(() => node.members, [node])?.length ?? 0;
  const memberRect = useObserveValue(() => node.parentNode.parentNode.clientRectObs, [node]);
  const meta = useObserveValue(() => node.parentNode.parentNode.meta, [node]);
  const { autoposition } = meta;
  const zIndex = useObserveValue(() => node.inheritedZIndex, [node]);

  // Update the style directly. Don't re-render the react component when clipPath or clientRect change
  useEffect(() => {
    const clipPathObs = node.clipPath;
    const clientRectObs = node.clientRectObs;
    const memberRectObs = node.parentNode.parentNode.clientRectObs;

    const update = () => {
      const clientRect = clientRectObs.value;
      const memberRect = memberRectObs.value;
      const unscaled = clientRect.unscale(clientRect.totalScale);
      if (titleRef.current) {
        let clipPath = clipPathObs?.value;

        if (clipPath === false) {
          titleRef.current.style.display = 'none';
          titleRef.current.style.clipPath = '';
        } else {
          titleRef.current.style.display = 'block';
          titleRef.current.style.clipPath = clipPath ?? '';
        }

        titleRef.current.style.transform = `translate3d(${clientRect.left}px, ${clientRect.top}px, 0)`;
        titleRef.current.style.maxWidth = `${memberRect.width}`;
      }
    };

    const unsub2 = clientRectObs.subscribe(update);

    return () => {
      unsub2();
    };
  }, [node]);

  const titleStyle = useMemo(() => {
    return {
      position: 'fixed',
      visibility: 'visible',
      transformOrigin: 'top left',
      top: 0,
      left: 0,
      transition: 'none',
      transform: `translate3d(${node.clientRectObs.value.left}px, ${node.clientRectObs.value.top}px, 0)`,
      height: '25',
      maxWidth: memberRect.width,
      overflow: 'hidden',
      zIndex,
      clipPath: node.clipPath?.value || '',
      display: node.clipPath?.value == false ? 'none' : 'block',
    };
  }, [node, memberRect, autoposition, zIndex]);

  return createPortal(
    <div
      style={titleStyle}
      ref={(r: HTMLDivElement | null) => {
        titleRef.current = r ?? undefined;
        node.safeBindDomElement(r);
      }}
    >
      <NameTagField node={node.nameTagField} showCount={showCount} count={count} singleLine={true} />
      {/* {urlBar && <UrlBar node={urlBar} />} */}
    </div>,
    document.body,
  );
}
