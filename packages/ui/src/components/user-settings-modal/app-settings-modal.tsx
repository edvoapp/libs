import { useObserveValue } from '@edvoapp/util';
import './user-settings-modal.scss';
import * as VM from '../../viewmodel';
import { config } from '@edvoapp/common';
import { DownloadIcon } from '../../assets';
import { DropdownBody, DropdownItem, Icon, ModalHeader } from './common';
import { createPortal } from 'preact/compat';
import { MODAL_PANEL_Z } from '../../constants';

interface Props {
  node: VM.AppSettingsModal;
}

export const AppSettingsModal = ({ node }: Props) => {
  const generalSettings = useObserveValue(() => node.generalSettingsButtons, [node]);
  const canvasSettings = useObserveValue(() => node.canvasPreferencesButtons, [node]);
  const betaFeatures = useObserveValue(() => node.betaFeaturesButtons, [node]);

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
          <ModalHeader>App Settings ({config.appVersion})</ModalHeader>
          <DropdownBody>
            {generalSettings.map((node) => (
              <DropdownButton node={node} key={node.key} />
            ))}
            <div
              style={{
                marginBottom: 6,
                marginTop: 6,
                fontWeight: 'bold',
                marginLeft: -6,
              }}
            >
              Canvas Settings
            </div>
            {canvasSettings.map((node) => (
              <DropdownButton node={node} key={node.key} />
            ))}
            <div
              style={{
                marginBottom: 6,
                marginTop: 6,
                fontWeight: 'bold',
                marginLeft: -6,
              }}
            >
              Beta Features
            </div>
            {betaFeatures.map((node) => (
              <DropdownButton node={node} key={node.key} />
            ))}
          </DropdownBody>
        </div>
      </div>
    </>,
    document.body,
  );
};

const DropdownButton = ({ node }: { node: VM.AppSettingButton }) => {
  const label = useObserveValue(() => node.buttonLabel, [node]);
  return (
    <DropdownItem ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {node.type === 'export-graph' && (
        <Icon>
          <DownloadIcon />
        </Icon>
      )}
      {label}
    </DropdownItem>
  );
};
