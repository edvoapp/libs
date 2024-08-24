import { config } from '@edvoapp/common';
import { useEdvoObj, useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import { FunctionComponent } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as VM from '../../viewmodel';
import { createPortal } from 'preact/compat';
import { MIN_MODAL_ZINDEX } from '../../utils';
import { Outline } from '../../components/topic/topic-outline-items-renderer';
import * as React from 'react';
import {
  ArrowOriginTarget,
  Overlay,
  SidecarBody,
  SidecarHeader,
  SidecarHeaderButtons,
  SidecarStyles,
  SidecarTitle,
  TopicSpaceCard,
  TopicSpaceCardBody,
  TopicSpaceCardInner,
} from '../../components/topic-space/card';
import { CloseIcon } from '../../assets';
import { ProfileSelector } from '../../components';
import { ProfileForm } from '../../components/profile-selector/profile-form';

interface clickHandlerProps {
  height: number;
  width: number;
}

const minConstraints: clickHandlerProps = { height: 50, width: 150 };

type Props = {
  node: VM.ContentCard | VM.Member;
  center?: boolean;
  loading?: boolean;
  readonly?: boolean;
  appearance?: string;
  bgColor?: string;
  member?: boolean;
  shared?: boolean;
  changed?: boolean;
  hasIcon?: boolean;
};

function cardTransform(clientRect: VM.BoundingBox) {
  const x = clientRect.left ?? 0;
  const y = clientRect.top ?? 0;
  return `translate3d(${x}px, ${y}px, 0) scale(${clientRect.totalScale})`;
}

export const SpaceCard: FunctionComponent<Props> = ({
  children,
  node,
  loading,
  readonly,
  appearance,
  shared,
  changed,
  hasIcon,
  bgColor,
}) => {
  const member = node instanceof VM.Member ? node : null;
  // All the resizey locationey stuff ONLY
  const focused = useObserveValue(() => node.isFocused, [node]);
  const ref = useRef<HTMLDivElement>();
  const cardInnerRef = useRef<HTMLDivElement | null>(null);
  const isTiled = useObserveValue(() => node.tiling, [node]);
  const meta = useObserveValue(() => node.meta, [node]);
  const { autoposition } = meta;
  const isIndicated = useObserveValue(() => node.indicated, [node]);

  // Update the style directly. Don't re-render the react component when clipPath or clientRect change
  useEffect(() => {
    const clipPathObs = node.clipPath;
    const clientRectObs = node.clientRectObs;

    const update = () => {
      const clientRect = clientRectObs.value;
      const unscaled = clientRect.unscale(clientRect.totalScale);
      if (ref.current) {
        let clipPath = clipPathObs?.value;

        if (clipPath === false) {
          ref.current.style.display = 'none';
          ref.current.style.clipPath = '';
        } else {
          ref.current.style.display = 'block';
          ref.current.style.clipPath = clipPath ?? '';
        }

        ref.current.style.transform = cardTransform(clientRect);
      }
      if (cardInnerRef.current) {
        cardInnerRef.current.style.width = `${unscaled.width}px`;
        cardInnerRef.current.style.height = `${unscaled.height}px`;
      }
    };

    const unsub1 = clipPathObs?.subscribe(update);
    const unsub2 = clientRectObs.subscribe(update);

    return () => {
      unsub1?.();
      unsub2();
    };
  }, [node]);

  useEffect(() => {
    const p = node.parentNode;
    let scale = 1;
    if (p instanceof VM.VertexNode) {
      const parentVertexID = p.vertex.id;
      if (config.hardCodedFocusMembers[parentVertexID] === node.vertex.id) {
        scale = 0.25;
      }
    }
  }, [node]);

  const tsPage = useMemo<VM.TSPage | null>(() => node.closestInstance(VM.TSPage), [node]);
  const zIndex = useObserveValue(() => node.zIndex, [node]);
  const hover = useObserveValue(() => node.hover, [node]);

  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // wait for the TS page to finish rendering, then we have a container in which to render
    tsPage?.waitForDomElement().then((el) => {
      setContainer(el);
    });
  }, [tsPage]);

  const style = useMemo(() => {
    return {
      position: 'fixed',
      visibility: 'visible',
      transformOrigin: 'top left',
      top: 0,
      left: 0,
      transition: 'none',
      transform: cardTransform(node.clientRectObs.value),
      clipPath: node.clipPath?.value || '',
      display: node.clipPath?.value == false ? 'none' : 'block',
      zIndex,
      boxShadow: isTiled
        ? ''
        : autoposition
        ? '4px 6px 14px 4px rgba(118, 120, 237, 1.0)' // temp??
        : '2px 3px 7px 2px rgba(0, 0, 0, 0.26)', // uncomment for autopositioned indicator
      // HACK - this will go away once the header is in the card
      // maxWidth: clientRect.innerWidth,
    };
  }, [node, isTiled, zIndex, autoposition]);

  const sidecar = useObserveValueMaybe(() => {
    return node instanceof VM.Member ? node.sidecar : undefined;
  }, [node]);
  const profileSelectorOpen = useObserveValueMaybe(
    () => (node instanceof VM.Member ? node.profileSelectorOpen : undefined),
    [node],
  );

  const profile_selector = node instanceof VM.Member && profileSelectorOpen && (
    <>
      <ProfileSelector node={node.profileSelector} />
      <ProfileForm node={node.profileForm} />
    </>
  );

  // HACK - store a copy so safeBindDomElement can be called on object cleanup
  const arrowDragHandleN = useEdvoObj(() => node.arrowDragHandleN, [node]);
  const arrowDragHandleE = useEdvoObj(() => node.arrowDragHandleE, [node]);
  const arrowDragHandleS = useEdvoObj(() => node.arrowDragHandleS, [node]);
  const arrowDragHandleW = useEdvoObj(() => node.arrowDragHandleW, [node]);

  if (!style || !container) return null;
  return createPortal(
    <>
      <TopicSpaceCard
        tabIndex={0}
        data-cy="space-card"
        ref={(r: HTMLDivElement | null) => {
          ref.current = r ?? undefined;
          node.safeBindDomElement(r);
        }}
        // @ts-ignore
        loading={loading}
        {...{
          style,
          shared,
          changed,
          member: !!member,
          readonly,
          focused,
          appearance,
          hover,
          hasIcon,
          isIndicated,
          bgColor,
        }}
      >
        <TopicSpaceCardBody {...{ appearance }}>
          <TopicSpaceCardInner
            ref={cardInnerRef}
            style={{
              width: node.planeCoords.value.width,
              height: node.planeCoords.value.height,
            }}
          >
            <Overlay data-cy="overlay" {...{ focused, isIndicated: isIndicated.drag }} />
            {children}
            <>
              {/* {focused && (
                <>
                  <ArrowOriginTarget
                    side={'n'}
                    ref={(r: HTMLElement | null) =>
                      arrowDragHandleN.safeBindDomElement(r)
                    }
                  />
                  <ArrowOriginTarget
                    side={'e'}
                    ref={(r: HTMLElement | null) =>
                      arrowDragHandleE.safeBindDomElement(r)
                    }
                  />
                  <ArrowOriginTarget
                    side={'s'}
                    ref={(r: HTMLElement | null) =>
                      arrowDragHandleS.safeBindDomElement(r)
                    }
                  />
                  <ArrowOriginTarget
                    side={'w'}
                    ref={(r: HTMLElement | null) =>
                      arrowDragHandleW.safeBindDomElement(r)
                    }
                  />
                </>
              )} */}
            </>
          </TopicSpaceCardInner>
          {sidecar && member && <Sidecar node={sidecar} member={member} />}
          {/*TODO: quick actions on content card */}
        </TopicSpaceCardBody>
        {profile_selector}
      </TopicSpaceCard>
    </>,
    container,
  );
};

const Sidecar = ({ node, member }: { node: VM.Sidecar; member: VM.Member }) => {
  const visible = useObserveValue(() => node.visible, [node]);

  useEffect(
    () =>
      member.planeCoords.subscribe((coords) => {
        const el = node.domElement;
        if (el) el.style.maxHeight = `${coords.height}px`;
      }),
    [node, member],
  );

  return (
    <>
      {visible && (
        <SidecarStyles
          ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
          style={{
            maxHeight: member.planeCoords.value.height,
          }}
        >
          <SidecarHeader>
            <SidecarTitle>Notes</SidecarTitle>
            <SidecarHeaderButtons>
              {/*<FullScreen/>*/}
              <CloseIcon
                onClick={() => {
                  void member.toggleSidecarExpanded(null);
                }}
              />
            </SidecarHeaderButtons>
          </SidecarHeader>
          <SidecarBody>
            <Outline node={node.outline} />
          </SidecarBody>
        </SidecarStyles>
      )}
    </>
  );
};
