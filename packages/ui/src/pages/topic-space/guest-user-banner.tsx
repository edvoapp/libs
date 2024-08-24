import { Observable, useObserve, useObserveValue } from '@edvoapp/util';
import './guest-user-banner.scss';
import { globalStore } from '@edvoapp/common';

type Props = {};

export const GuestUserBanner = (props: Props) => {
  const isVisible = useObserve(() => new Observable(true), []);
  const show = useObserveValue(() => isVisible, [isVisible]);

  const currentUser = globalStore.getCurrentUser();

  if (!show || !currentUser?.isAnonymous) return null;

  return (
    <div className="guest-user-banner-root">
      <span className="label">Create your own thought sculpture in Edvo</span>
      <a className="banner-btn primary" href="https://app.edvo.com/signup?invite=BETA9268" target="_blank">
        Get Early Access
      </a>
      <button
        className="banner-btn secondary"
        onClick={() => {
          isVisible.set(false);
        }}
      >
        Dismiss
      </button>
    </div>
  );
};
