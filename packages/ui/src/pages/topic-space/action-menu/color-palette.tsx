import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../../viewmodel';
import './action-menu.scss';

interface Props {
  node: VM.ColorPalette;
}

export function ColorPalette({ node }: Props) {
  const colorButtons = useObserveValue(() => node.colorButtons, [node]);
  const isTiling = useObserveValue(() => node.isTiling, [node]);

  return (
    <div
      className={`menu bg-white/60 backdrop-blur p-1 absolute ${
        !isTiling ? '-top-[160%] left-[38%] -translate-x-[38%]' : 'top-[130%] left-[75%] -translate-x-[75%]'
      }  whitespace-nowrap flex gap-1 border border-black/10 shadow`}
      ref={(r) => node.safeBindDomElement(r)}
      style={{ zIndex: 200_000 }}
    >
      {colorButtons.map((node) => (
        <ColorButton node={node} key={node.color} />
      ))}
    </div>
  );
}

const ColorButton = ({ node }: { node: VM.ColorButton }) => {
  const selected = useObserveValue(() => node.selected, [node]);
  const color = node.color.toLowerCase();
  return (
    <div
      ref={(r) => node.safeBindDomElement(r)}
      className={`h-7 w-7 flex items-center justify-center transition-all ${
        selected ? 'menu-button-active' : 'menu-button'
      }`}
    >
      <div className={`w-4 h-4 rounded-full border-[1px] border-black/20`} style={{ backgroundColor: color }} />
    </div>
  );
};
