import * as VM from '../../viewmodel';
import { useEdvoObj, useObserveValue } from '@edvoapp/util';
import { Text } from '../topic/body-content/text';

interface Props {
  node: VM.ProfileForm;
}

export function ProfileForm({ node }: Props) {
  const bodyNode = node.parentNode;
  const profileName = useObserveValue(() => bodyNode.profileName, [bodyNode]);
  const profileFormOpen = useObserveValue(() => node.open, [node]);

  // HACK - store a copy so safeBindDomElement can be called on object cleanup
  const profileFormCreateButton = useEdvoObj(() => node.profileFormCreateButton, [node]);
  const profileFormCancelButton = useEdvoObj(() => node.profileFormCancelButton, [node]);

  return (
    <div
      className="profile-form"
      style={{ display: profileFormOpen ? 'block' : 'none' }}
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
    >
      <div className="profile-form__inner">
        <p className="profile-form__heading">Choose profile name</p>
        <p className="profile-form__subheading">You can always change it later.</p>
        <div style={{ flex: 1 }}>
          <Text node={node.profileFormField} noWrap />
        </div>
        <div className="profile-form__btns">
          <button
            className="profile-form__btns__btn profile-form__btns__btn--create"
            ref={(n) => profileFormCreateButton.safeBindDomElement(n)}
            disabled={!profileName}
          >
            Create
          </button>
          <button
            className="profile-form__btns__btn profile-form__btns__btn--cancel"
            ref={(n) => profileFormCancelButton.safeBindDomElement(n)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
