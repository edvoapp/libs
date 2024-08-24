import { Model, trxWrap } from '@edvoapp/common';
import { FileChooser } from '../file-chooser';
import { UserAvatar } from '../user-avatar';
import './user-settings-modal.scss';
import * as VM from '../../viewmodel';

// TODO move Text to somewhere more general
import { Text } from '../topic/body-content/text';
import { ModalHeader } from './common';
import { useObserveValue } from '@edvoapp/util';
import { MODAL_PANEL_Z } from '../../constants';
import { createPortal } from 'preact/compat';

interface Props {
  node: VM.UserSettingsModal;
}

export const UserSettingsModal = ({ node }: Props) => {
  const user = useObserveValue(() => node.context.authService.currentUserVertexObs, [node]);
  const uploadFile = (file: File | null) => {
    if (!user) return;
    if (file) {
      // TODO: handle in VM
      void trxWrap(async (trx) => {
        // const imgVertex = Model.Vertex.create({
        //   trx,
        //   parent: null,
        //   kind: 'media',
        // });
        (await user.filterProperties({ role: ['avatar-image'] }).toArray()).map((x) => x.archive(trx));
        const imgPart = await Model.Property.createAsync({
          parent: user,
          role: ['avatar-image'],
          contentHandle: file,
          trx,
          contentType: 'img',
          privs: Model.Priv.PrivState.defaultPublicReadonly(),
        });
        // (await user.filterEdges(['avatar-image']).toArray()).map((x) => x.archive(trx));
        // (await user.filterEdges(['avatar-image']).toArray()).map((x) => x.archive(trx));
        // user.createEdge({
        //   trx, role: ['avatar-image'], target: imgVertex, meta: {}, recipientID: ['PUBLIC']
        // });
      });
    }
  };

  if (!user) return null;

  return createPortal(
    <>
      <div
        className="overlay top-0 left-0 w-screen h-screen pointer-events-none bg-black/40 fixed"
        style={{ zIndex: MODAL_PANEL_Z[0] - 1 }}
      ></div>
      <div
        className="user-settings-modal"
        ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
        style={{ zIndex: MODAL_PANEL_Z[0] }}
      >
        <div className=" ReactModal__Content">
          <ModalHeader>User Settings</ModalHeader>
          <label for="email-address" className="sr-only">
            Full Name
          </label>

          <Text node={node.userNameInput} />

          <div className="avatar-row">
            <UserAvatar node={node.avatar} />
            <div style="flex:1">
              <FileChooser
                id="avatar-choose"
                //accept="image/*"
                chooseFileCallback={uploadFile}
              />
            </div>
          </div>

          <button class="bg-blue-600 text-white" onClick={() => (node.root as VM.AppDesktop).syncProfilesModal.open()}>
            Sync Browser Data
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
};
