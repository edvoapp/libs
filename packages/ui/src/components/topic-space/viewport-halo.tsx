import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../viewmodel';

type Props = {
  planeOffsets: VM.Position;
  node: VM.TopicSpace;
};
export const ViewportHalo = ({ planeOffsets, node }: Props) => {
  const { left, top, width, height } = useObserveValue(() => node.viewportState, [node]);

  return (
    <div
      className="viewport-halo"
      style={{
        left: left + planeOffsets.x,
        top: top + planeOffsets.y,
        width: width - 2,
        height: height - 2,
        zIndex: 99999999,
        pointerEvents: 'none',
        border: 'solid 2px #DDF',
        background: 'none',
        position: 'fixed',
        // margin: '2px',
      }}
    ></div>
  );
};
