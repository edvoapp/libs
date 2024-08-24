import { Observable, useObserveValue } from '@edvoapp/util';
import cx from 'classnames';
import { useMemo } from 'preact/hooks';
import './styles.scss';
import { Model } from '@edvoapp/common';
import { VM } from '../..';
import { BoundingBox } from '../../viewmodel';

export type HasMeta = VM.ContentCard | VM.Member;

type Extremities = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

interface Props {
  members: VM.Member[];
  singles: HasMeta[];
  node: VM.TopicSpace;
}

// const MAX_MINIMAP_HEIGHT = 300;
const MAX_MINIMAP_WIDTH = 400;

export function MiniMap({ members, singles, node }: Props) {
  const vp = useObserveValue(() => node.viewportState, [node]);
  const panning = useObserveValue(() => node.panning, [node]);
  const scale = useObserveValue(() => node.planeScaleObs, [node]);
  const zooming = useObserveValue(() => node.zooming, [node]);

  const isChatWindowOpen = useObserveValue(() => node.isChatWindowOpen, [node]);
  const chatWindowClientRect = useObserveValue(() => node.chatWindowClientRectObs, [node]);

  // We're cutting a corner here by simply not worrying about updating any member state during panning
  // We're only updating the viewport state, and recalculating everything every time

  // LATER - we will have to subscribe to both members AND their metas in such a way that we will
  // properly recalc all the min/maxes and not leak memory
  // useObserveList(() => members, [members]);

  // const [, forceUpdate] = useReducer((x) => x + 1, 0);
  // useEffect(() => {
  //   members.value.forEach((m) => {
  //     m.meta.subscribe(() => {
  //       forceUpdate(1);
  //     });
  //   });
  // }, [members.value]);

  const memberItems = [...members, ...singles].reduce<VM.BoundingBox[]>((acc, m) => {
    // use planeCoords, not clientRect, because we want this to be relative to the viewport
    const rect = m.planeCoords.value;
    acc.push(rect);
    return acc;
  }, []);

  const { height, width, left, top, right, bottom, planeScale } = vp;

  // how much space does the viewport actually take on the screen? This informs us about how big to make the "viewport rectangle" within the minimap
  const viewportClientHeight = height * scale;
  const viewportClientWidth = width * scale;

  // let's not use memo for now
  const extremities = memberItems.reduce(
    (acc, member) => {
      return {
        minX: Math.min(acc.minX, member.x),
        maxX: Math.max(acc.maxX, member.x + member.width),
        minY: Math.min(acc.minY, member.y),
        maxY: Math.max(acc.maxY, member.y + member.height),
      };
    },
    {
      minX: left,
      maxX: right,
      minY: top,
      maxY: bottom,
    },
  );

  const { minX, maxX, minY, maxY } = extremities;

  // content is "how BIG is my canvas" in LOGICAL coordinates
  const contentHeight = maxY - minY;
  const contentWidth = maxX - minX;
  const contentAspectRatio = contentWidth / contentHeight;

  // how BIG is my minimap? Max width is 400px, then make it as tall as it needs to be
  const { minimapScreenHeight, minimapScreenWidth } = useMemo(() => {
    let minimapScreenHeight = Math.min(viewportClientHeight * 0.4, 300);
    let minimapScreenWidth = contentAspectRatio * minimapScreenHeight;
    if (minimapScreenWidth > MAX_MINIMAP_WIDTH) {
      minimapScreenWidth = Math.min(viewportClientWidth * 0.4, 400);
      minimapScreenHeight = minimapScreenWidth / contentAspectRatio;
    }
    return { minimapScreenHeight, minimapScreenWidth };
  }, [viewportClientWidth, viewportClientHeight, contentAspectRatio]);

  const minimapToContentRatio = minimapScreenHeight / contentHeight;

  const viewportStyle = {
    left: (vp.x - minX) * minimapToContentRatio,
    top: (vp.y - minY) * minimapToContentRatio,
    height: ((viewportClientHeight / contentHeight) * minimapScreenHeight) / planeScale,
    width: ((viewportClientWidth / contentWidth) * minimapScreenWidth) / planeScale,
  };

  // LATER: do this with SVG or better yet wgpu
  return (
    <div
      className={cx('minimap', {
        panning,
        zooming,
        // for debugging only
        // panning: true,
      })}
      style={{
        height: minimapScreenHeight,
        width: minimapScreenWidth,
        right: isChatWindowOpen ? 12 + chatWindowClientRect.width : 0,
      }}
    >
      {members.map((node) => (
        <MinimapItem node={node} scale={minimapToContentRatio} extremities={extremities} />
      ))}
      {singles.map((node) => (
        <MinimapItem node={node} scale={minimapToContentRatio} extremities={extremities} />
      ))}
      <div className="viewport" style={viewportStyle} />
    </div>
  );
}

const MinimapItem = ({
  node,
  scale,
  extremities: { minX, minY },
}: {
  node: HasMeta;
  scale: number;
  extremities: Extremities;
}) => {
  const planeCoords = useObserveValue(() => node.planeCoords, [node]);

  const style = useMemo(() => {
    const { x, y, height, width } = planeCoords;
    return {
      top: (y - minY) * scale,
      left: (x - minX) * scale,
      height: height * scale,
      width: width * scale,
    };
  }, [planeCoords, minX, minY, scale]);

  return <div className={cx('member')} style={style} />;
};
