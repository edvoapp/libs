import { Observable, useObserveValue } from '@edvoapp/util';
import cx from 'classnames';
import { FunctionComponent } from 'preact';
import * as VM from '../../viewmodel';
import { ActiveConversation } from '../../viewmodel';
import { Outline } from '../topic/topic-outline-items-renderer/outline';
import { CloseIcon, DeleteOutline } from '../../';
import { Tooltip } from '../tooltip';
import './styles.scss';
import { trxWrap, TrxRef, trxWrapSync } from '@edvoapp/common';

const ToolTipChild = ({ text }: { text: string }) => <span>{text}</span>;

export interface ConversationModalProps {
  node: VM.ConversationModal;
}

export const activeConversationObs = new Observable<ActiveConversation | null | undefined>(null).leak();

export const ConversationModal: FunctionComponent<ConversationModalProps> = ({ node }) => {
  const { vertex } = node.activeConversation.highlight;
  const modalPosition = useObserveValue(() => node.modalPosition, [node]);
  return (
    <div
      style={{ ...modalPosition }}
      className={cx('highlight_input active', {
        vertex_saved: !!vertex,
      })}
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
    >
      <div className="actions">
        <Tooltip popperConfig={{ placement: 'top' }} tooltipChildren={<ToolTipChild text="Close modal" />}>
          <CloseIcon className="close-icon" onClick={() => node.focusHighlight(null)} />
        </Tooltip>
        <Tooltip popperConfig={{ placement: 'top' }} tooltipChildren={<ToolTipChild text="Delete highlight" />}>
          <DeleteOutline
            className="delete-outline"
            onClick={() => {
              node.focusHighlight(null);
              trxWrapSync((trx: TrxRef) => vertex.archive(trx));
            }}
          />
        </Tooltip>
      </div>
      <Outline node={node.outline} key={node.outline.key} />
    </div>
  );
};
