import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../viewmodel';

type Props = {
  node: VM.TopicSpace;
};
export const ViewportCrosshairs = ({ node }: Props) => {
  const pos = useObserveValue(() => node.focusCoordinates, [node]);
  const vps = useObserveValue(() => node.viewportState, [node]);
  const { x, y } = node.spaceCoordsToClientCoords(pos ?? vps.center);

  return (
    <div
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${x}px, ${y}px, 0)`,
        // zIndex: ,
        pointerEvents: 'none',
        color: '#DDF',
        background: 'none',
        position: 'fixed',
        // margin: '2px',
      }}
    >
      +
    </div>
  );
};
