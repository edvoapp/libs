import { Observable, useObserve } from '@edvoapp/util';
import { JSX } from 'preact';
import Modal from 'react-modal';
import './invite-modal.scss';
import { config, globalStore } from '@edvoapp/common';

interface InviteModalProps {
  isOpen: boolean;
  onRequestClose?: Modal.Props['onRequestClose'];
}

export const InviteModal = ({ isOpen, onRequestClose }: InviteModalProps) => {
  const fullName = useObserve(() => new Observable(''), []);
  const email = useObserve(() => new Observable(''), []);
  const inviteLink = useObserve(() => new Observable(''), []);
  const copied = useObserve(() => new Observable(false), []);

  const generateInviteCode = (e: JSX.TargetedEvent) => {
    e.preventDefault();
    const invitingUserID = globalStore.getCurrentUserID();
    const data = {
      invitingUserID,
      fullName: fullName.value,
      email: email.value,
    };
    const encoded = btoa(JSON.stringify(data));
    inviteLink.set(`${config.webappUrl}/invite?c=${encoded}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Invite a Friend"
      portalClassName="ReactModalPortal"
      overlayClassName="ReactModal__Body--open"
      className="invite-modal"
      bodyOpenClassName="body-open"
      htmlOpenClassName="html-open"
      shouldCloseOnEsc
      shouldCloseOnOverlayClick
    >
      <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">Invite a Friend!</h2>
      {inviteLink.value ? (
        <div>
          <div className="mb-4">{copied.value ? 'Copied!' : 'Click to copy!'}</div>
          <input
            readOnly
            className="form-input appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm mb-2"
            value={inviteLink.value}
            onClick={(e) => {
              const input = e.target as HTMLInputElement;
              input.select();
              input.setSelectionRange(0, 99999);
              void navigator.clipboard.writeText(input.value);
              copied.set(true);
            }}
          />
          <button
            className="invite-button group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
            onClick={() => {
              inviteLink.set('');
              email.set('');
              fullName.set('');
              copied.set(false);
            }}
          >
            Invite someone else?
          </button>
        </div>
      ) : (
        <form className="mt-6 space-y-6" action="#" method="POST" onSubmit={generateInviteCode}>
          <div className="rounded-md shadow-sm">
            <div>
              <label htmlFor="full-name" className="sr-only">
                Full Name
              </label>
              <input
                id="full-name"
                name="full-name"
                type="text"
                autoComplete="full-name"
                required
                className="form-input appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Full Name"
                value={fullName.value}
                onInput={(e) => fullName.set(e.currentTarget.value)}
              />
            </div>
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="form-input appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email.value}
                onInput={(e) => email.set(e.currentTarget.value)}
              />
            </div>
            <div className="mt-4">
              <button
                disabled={!(email.value && fullName.value)}
                type="submit"
                className="invite-button group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
              >
                Invite!
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
