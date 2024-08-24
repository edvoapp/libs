import cx from 'classnames';
import styled from 'styled-components';
import { useObserveValue } from '@edvoapp/util';

import * as VM from '../../../viewmodel';

import { OutlineItem } from '../../viewer';
import { Text } from '../body-content/text';

interface TopicItemProps {
  node: VM.Outline;
}

const OutlineStyles = styled.div<{ blank?: boolean }>`
  flex: 1;
`;

export function Outline({ node }: TopicItemProps) {
  const childrenNodes = useObserveValue(() => node.items, [node]);
  const emptyBulletNode = useObserveValue(() => node.emptyBullet, [node]);

  let out = childrenNodes?.map((child, i) => (
    <OutlineItem key={`${child.vertex.id}_${i}`} node={child} backref={child.backref} />
  ));
  let body;
  if (out?.length) {
    body = <div className={'relation-category'}>{out}</div>;
  } else if (emptyBulletNode) {
    body = <EmptyOutlineItem node={emptyBulletNode} />;
  } else {
    body = null;
  }

  return (
    <OutlineStyles blank={!!emptyBulletNode} ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {body}
    </OutlineStyles>
  );
}

function EmptyOutlineItem({ node }: { node: VM.EmptyBullet }) {
  return (
    <div ref={(el) => node.safeBindDomElement(el)} className={cx('relation-category', 'blank')}>
      <div className="vertex-component is-active">
        <div className="main">
          <div className="controls">
            <div className="handle" />
          </div>
          <div className="body">
            <Text node={node.textfield} noWrap />
          </div>
        </div>
      </div>
    </div>
  );
}
