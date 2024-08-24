import { useObserveValue } from '@edvoapp/util';
import { Tooltip, VM } from '../../..';
import '../topic-space.scss';
import './action-menu.scss';
import { use } from 'marked';
import { ColorPalette } from './color-palette';

interface Props {
  node: VM.ColorPickerButton;
}
export function ColorPickerButton({ node }: Props) {
  const color = useObserveValue(() => node.color, [node]);
  const colorPalette = useObserveValue(() => node.colorPalette, [node]);

  return (
    <div className="relative">
      <Tooltip tooltipChildren={'Change background color'} usePortal popperConfig={{ placement: 'left' }}>
        <div
          ref={(r) => node.safeBindDomElement(r)}
          className={`h-7 w-7 p-1 flex items-center justify-center transition-all menu-button text-sm
        }`}
          style={{ zIndex: 100_000 }}
        >
          <div className={`w-4 h-4 rounded-full border-[1px] border-black/20`} style={{ background: color }}></div>
        </div>
      </Tooltip>
      {colorPalette && <ColorPalette node={colorPalette} />}
    </div>
  );
}
