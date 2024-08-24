import { useObserveValue } from '@edvoapp/util';
import { Model } from '@edvoapp/common';
import { GlobeIcon, LockIcon } from '../assets';
import { Tooltip } from './tooltip';
import * as Behaviors from '../behaviors';
import './sharing-status.scss';

const ToolTipChild = ({ text }: { text: string }) => <span>{text}</span>;

export const SharingStatus = ({ vertex }: { vertex: Model.Vertex }) => {
  const shares = useObserveValue(() => vertex.shares, [vertex]);

  const status = Behaviors.getShareStatus(shares);

  // needs to be specified
  if (status === 'read' || status === 'write') {
    return (
      <Tooltip tooltipChildren={<ToolTipChild text="Shared publically" />}>
        <span className="share-icon">
          <GlobeIcon />
        </span>
      </Tooltip>
    );
  } else if (status === 'private') {
    return (
      <Tooltip tooltipChildren={<ToolTipChild text="Private Topic Space" />}>
        <span className="share-icon">
          <LockIcon />
        </span>
      </Tooltip>
    );
  }
  return null;
};
