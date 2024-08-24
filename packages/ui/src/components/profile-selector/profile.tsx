import { useEdvoObj, useObserveValue } from '@edvoapp/util';

import { DeleteIcon } from '../..';
import * as VM from '../../viewmodel';
import { ProfileAvatar } from './profile-avatar';
import { Text } from '../topic/body-content/text';

export function Profile({ node }: { node: VM.Profile | VM.DefaultProfile }) {
  const vertex = node instanceof VM.Profile ? node.vertex : null;

  if (node instanceof VM.Profile && vertex) {
    const profileStatus = useObserveValue(() => vertex.status, [vertex]);
    const profileName = useObserveValue(() => node.profileName, [node]);
    if (!profileName || profileStatus === 'archived') return null;

    // HACK - store a copy so safeBindDomElement can be called on object cleanup
    const archiveProfileButton = useEdvoObj(() => node.archiveProfileButton, [node]);

    return (
      <div className="profiles__list__item" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
        <ProfileAvatar />
        <Text node={node.textField} />
        <SelectProfileButton node={node.selectProfileButton} />
        <button
          className="profiles__list__item__btn profiles__list__item__btn--remove"
          ref={(r: HTMLElement | null) => archiveProfileButton.safeBindDomElement(r)}
        >
          <DeleteIcon />
        </button>
      </div>
    );
  }

  // Default profile
  return (
    <div className="profiles__list__item" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <ProfileAvatar />
      <p className="profiles__list__item__name">Default</p>
      <SelectProfileButton node={node.selectProfileButton} />
      <span className="profiles__list__item__btn"></span>
    </div>
  );
}

const SelectProfileButton = ({ node }: { node: VM.SelectProfileButton }) => {
  const active = useObserveValue(() => node.active, [node]);

  // TODO: create a "radio button" VM node.
  return (
    <input
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      className="profiles__list__item__btn profiles__list__item__btn--status"
      type="radio"
      readOnly={active}
      checked={active}
    />
  );
};
