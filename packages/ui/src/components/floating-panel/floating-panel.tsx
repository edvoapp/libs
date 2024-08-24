import ReactModal from 'react-modal';
import styled, { css } from 'styled-components';
import { ComponentChild } from 'preact';
import { createPortal } from 'preact/compat';
import * as VM from '../../viewmodel';
import { useObserveValue } from '@edvoapp/util';
import { CloseIcon } from '../icons';

const FloatingPanelRoot = styled.div`
  z-index: 9999999;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;
const OverlayRoot = styled.div`
  z-index: 999999;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: #0008;
`;

const CloseButton = styled.div<{ hover?: boolean | string }>`
  position: absolute;
  right: 12px;
  top: 12px;

  ${(props) =>
    props.hover &&
    css`
      cursor: pointer;
    `}
`;

// Deprecated
export function FloatingPanel({
  node,
  children,
  className,
}: {
  node: VM.FloatingPanel;
  children: ComponentChild;
  className?: string;
}) {
  const visible = useObserveValue(() => node.visible, [node]);
  // const overlay = useObserveValue(() => node.overlay, [node.overlay]);
  const closeButton = node.closeButton;
  const closeButtonHover = useObserveValue(() => closeButton.hover, [closeButton]);
  if (!visible) return null;
  return createPortal(
    <>
      <FloatingPanelRoot className={className} ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
        {children}
        <CloseButton ref={(r: HTMLElement | null) => closeButton.safeBindDomElement(r)} hover={closeButtonHover}>
          <CloseIcon />
        </CloseButton>
      </FloatingPanelRoot>
      {/* {overlay ? (
        <OverlayRoot
          ref={(r: HTMLElement | null) => overlay.safeBindDomElement(r)}
        />
      ) : null} */}
    </>,
    document.body,
  );
}

// DEPRECATED, migrate things to use FloatingPanel

ReactModal.setAppElement(document.body);

const ModalStyle = styled.div``;
const OverlayStyle = styled.div`
  z-index: 9999999;
`;

type Props = ReactModal.Props & {};

export function ModalOld({ className = '_', overlayClassName = '_', ...props }: Props) {
  return (
    // Note that the className properties are required to prevent floating-panel
    // from overriding the styles defined in contentElement and overlayElement
    <ReactModal
      {...props}
      className={className}
      overlayClassName={overlayClassName}
      contentElement={({ as, ...p }, children) => <ModalStyle {...p}>{children}</ModalStyle>}
      overlayElement={({ as, ...p }, contentElement) => <OverlayStyle {...p}>{contentElement}</OverlayStyle>}
    />
  );
}
