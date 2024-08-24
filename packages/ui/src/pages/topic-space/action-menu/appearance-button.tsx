import { useObserveValue } from '@edvoapp/util';
import { Tooltip, VM } from '../../..';
import '../topic-space.scss';
import './action-menu.scss';
import { ArrowDown } from '../../../assets/icons/arrow-down';
import { ArrowUp } from '../../../assets/icons/arrow-up';
import { AppearanceDropdown } from './appearance-dropdown';

interface Props {
  node: VM.AppearanceButton;
}
export function AppearanceButton({ node }: Props) {
  const appearanceType = useObserveValue(() => node.appearanceType, [node]);
  const appearanceDropdown = useObserveValue(() => node.appearanceDropdown, [node]);
  return (
    <div className="relative">
      <Tooltip tooltipChildren={'Change View'} usePortal popperConfig={{ placement: 'top', offset: [0, 12] }}>
        <div
          ref={(r) => node.safeBindDomElement(r)}
          className={`h-7 p-1 flex items-center justify-center transition-all menu-button text-sm
        }`}
          style={{ zIndex: 100_000 }}
        >
          <div className="flex gap-2 px-1 items-center whitespace-nowrap">
            <span>
              {appearanceType === 'normal'
                ? 'Notes Only'
                : appearanceType === 'list'
                ? 'List'
                : appearanceType === 'subspace'
                ? 'Spatial'
                : ''}
            </span>
            {appearanceDropdown ? <ArrowUp width={11} /> : <ArrowDown width={11} />}
          </div>
        </div>
      </Tooltip>
      {appearanceDropdown && <AppearanceDropdown node={appearanceDropdown} />}
    </div>
  );
}
