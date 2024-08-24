import styled, { css } from 'styled-components';
import * as VM from '../../viewmodel';
import { useEdvoObj, useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import { TopicCardRoot, TopicFooter } from '../../components/topic-space/card';
import { TagList } from '../../components/tag-list/tag-list';
import { BodyContent } from '../../components';
import { useMemo } from 'preact/hooks';
import { getContrastColor } from '../../lib/color';
import { MemberAppearance } from '../../behaviors';
import { CenteredLoadingSpinner } from '../../components/topic/member-body/centered-loading-spinner';
import { EventTotalsByDayChart } from '../../components/member/chart/event-totals-by-day';
import { TopicItemList } from '../../components/topic/member-body/topic-item';
import { Portal } from '../../components/topic/member-body/portal';
import { EmptyBrowser } from '../../components/topic/member-body/empty-browser';
import { Outline } from '../../components/topic/topic-outline-items-renderer';

type Props = {
  node: VM.MemberBody;
  backgroundColor?: string;
};

const colorableTypes = ['stickynote', 'normal', 'list'];

const MemberBodyR = styled.div<{
  backgroundColor?: string;
  color?: string;
  appearance?: MemberAppearance | null | undefined;
  indicated?: boolean;
}>`
    flex: 1 1 0%;
    overflow: auto;
    width: 100%;
    position: relative;
    display: flex;
    -webkit-box-align: stretch;
    align-items: stretch;
    -webkit-box-pack: center;
    justify-content: center;
    ${(props) =>
      colorableTypes.includes(props.appearance?.type ?? '') &&
      css`
        padding-top: ${['normal', 'list'].includes(props.appearance?.type ?? '') ? '16' : '0'}px;
        color: ${props.color};
      `}
}`;

export const MemberBody = ({ node, backgroundColor }: Props) => {
  // const header = useObserveValue(() => node.header, [node]);
  const footer = useObserveValue(() => node.footer, [node]);
  const expanded = useObserveValue(() => node.expanded, [node]);
  const appearance = useObserveValueMaybe<MemberAppearance | undefined>(() => node.appearance, [node]);
  const textColor = useMemo(() => appearance?.textColor ?? getContrastColor(appearance?.color || '#fff'), [appearance]);

  const bgColor = backgroundColor ?? appearance?.color ?? '#fff';

  const portal = useObserveValue(() => node.portal, [node]);

  const contentNode = useEdvoObj(() => node.content, []);
  const emptyBrowser = useObserveValue(() => node.emptyBrowser, [node]);

  let inside: JSX.Element | null = null;

  const outline = useObserveValue(() => node.outline, [node]);

  if (appearance === undefined) {
    inside = <CenteredLoadingSpinner />;
  } else {
    const module = appearance?.module;
    const chartConfig = appearance?.chartConfig;
    if (module && chartConfig) {
      // { "module": "chart-totals-by-day", "chartConfig": { "event": "created", "byUser": false } }
      if (module === 'chart-totals-by-day') {
        inside = <EventTotalsByDayChart config={chartConfig} />;
      }
    } else if (appearance?.type === 'list') {
      inside = <TopicItemList node={node} />;
    } else if (portal) {
      inside = <Portal node={portal} />;
    } else if (emptyBrowser) {
      inside = <EmptyBrowser node={emptyBrowser} />;
    } else if (appearance?.type === 'stickynote' || contentNode.isVisible) {
      inside = <BodyContent node={contentNode} />;
    } else if (outline) {
      inside = <Outline node={outline} />;
    }
  }

  return (
    <TopicCardRoot
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      color={textColor}
      backgroundColor={bgColor}
    >
      <MemberBodyR appearance={appearance}>{inside}</MemberBodyR>
      {footer && <Footer node={footer} />}
    </TopicCardRoot>
  );
};

type FooterProps = {
  node: VM.MemberFooter;
  noBackground?: boolean;
};

function Footer({ node }: FooterProps) {
  return (
    <TopicFooter
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
    >
      <TagList node={node.tagList} />
    </TopicFooter>
  );
}
