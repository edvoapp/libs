import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../../viewmodel';
import './action-menu.scss';
import { Check } from '../../../assets/icons/check';

interface Props {
  node: VM.AppearanceDropdown;
}

export function AppearanceDropdown({ node }: Props) {
  const appearanceTypeButtons = useObserveValue(() => node.appearanceTypeButtons, [node]);

  return (
    <div
      className="menu bg-white/60 backdrop-blur p-1 absolute top-[120%] -left-1 whitespace-nowrap flex flex-col gap-1 border border-black/10 shadow"
      ref={(r) => node.safeBindDomElement(r)}
      style={{ zIndex: 100_000 }}
    >
      {appearanceTypeButtons.map((node) => (
        <AppearanceTypeButton node={node} key={node.type.type} />
      ))}
    </div>
  );
}

const AppearanceTypeButton = ({ node }: { node: VM.AppearanceTypeButton }) => {
  return (
    <div
      ref={(r) => node.safeBindDomElement(r)}
      className={`h-7 w-24 flex items-center justify-between gap-4 transition-all menu-button text-sm p-1`}
    >
      <span>
        {node.type.type === 'normal'
          ? 'Notes Only'
          : node.type.type === 'list'
          ? 'List'
          : node.type.type === 'subspace'
          ? 'Spatial'
          : ''}
      </span>
      {node.selected && <Check width={11} />}
    </div>
  );
};
