import { useObserveValue } from '@edvoapp/util';

import { AddCircle } from '../../assets';
import * as VM from '../../viewmodel';
import { Profile } from './profile';

import './styles.scss';

interface Props {
  node: VM.ProfileSelector;
}

// More like profile manager...
export function ProfileSelector({ node }: Props) {
  const profiles = useObserveValue(() => node.profiles, [node]);
  const profileSelectorOpened = useObserveValue(() => node.open, [node]);

  return (
    <>
      <div
        className="profile-selector"
        style={{
          display: profileSelectorOpened ? 'block' : 'none',
          opacity: profileSelectorOpened ? 1 : 0,
          pointerEvents: profileSelectorOpened ? 'auto' : 'none',
        }}
        ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      >
        <div
          className="profile-selector__inner"
          style={{
            transform: profileSelectorOpened ? 'translate(-50%, 0)' : 'translate(-50%, 100%)',
            visibility: profileSelectorOpened ? 'visible' : 'hidden',
          }}
        >
          {node.context.runtime === 'electron' ? (
            <div className="profiles__list">
              <Profile node={node.defaultProfile} />
              {profiles.map((profile) => (
                <Profile node={profile} />
              ))}
              <AddProfile node={node.addProfileButton} />
            </div>
          ) : (
            <div>This feature is only available in our desktop app.</div>
          )}
        </div>
      </div>
    </>
  );
}

const AddProfile = ({ node }: { node: VM.AddProfileButton }) => (
  <div className="profiles__list__item" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
    <button className="profiles__list__item__btn profiles__list__item__btn--create">
      <AddCircle />
    </button>
    <p className="profiles__list__item__name">Add profile</p>
  </div>
);
