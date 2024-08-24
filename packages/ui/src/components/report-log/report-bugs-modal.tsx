import * as VM from '../../viewmodel';
import { createPortal } from 'preact/compat';
import styled from 'styled-components';
import { Button } from '../button/button';
import { CloseIcon } from '../icons';
import { MODAL_PANEL_Z } from '../../constants';
import { TextButton } from '../button';
import { Text } from '../topic/body-content/text';

interface Props {
  node: VM.ReportBugsModal;
}

export const ReportBugsModalRoot = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: ${MODAL_PANEL_Z[0]};
  width: 400px;
  // height: 560px;
  transform: translateX(-50%) translateY(-50%);

  display: flex;
  flex-direction: column;
  // justify-content: center;
  align-items: center;
  // font-size: 2rem;

  border-radius: 3px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: white;
  background-blend-mode: overlay, normal;

  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);
`;

export const ReportBugsModal = ({ node }: Props) => {
  return createPortal(
    <>
      <div
        className="overlay top-0 left-0 w-screen h-screen pointer-events-none bg-black/40 fixed"
        style={{ zIndex: MODAL_PANEL_Z[0] - 1 }}
      ></div>
      <ReportBugsModalRoot className="help-modal" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
        <div className="flex items-center px-3 py-2 w-full justify-between">
          <h1 className="font-semibold uppercase text-[#71717A] text-xs">Report a bug</h1>
          <Button node={node.closeButton} toolTip="Close">
            <CloseIcon />
          </Button>
        </div>
        <div className="horizontal-line h-px bg-[#E4E4E7] w-full"></div>
        <div className="w-full flex flex-col p-6">
          <p className="font-medium text-sm mb-3">Describe your issue</p>
          <TextInput>
            <TextWrapperSC>
              <Text node={node.textfield} />
            </TextWrapperSC>
          </TextInput>
          <TextButton node={node.sendReportButton} fullWidth={true}>
            <span>Send report</span>
          </TextButton>
        </div>
      </ReportBugsModalRoot>
    </>,
    document.body,
  );
};

const TextInput = styled.div`
  border-radius: 3px;
  border: 1px solid #e4e4e7;
  background: #fff;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`;
const TextWrapperSC = styled.div`
  flex: 1;
`;
