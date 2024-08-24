import * as VM from '../../../viewmodel';
import { Text } from '../body-content/text';
import { TopicNameStyle } from '../../topic-space/card';
import { useObserveValue } from '@edvoapp/util';

interface TopicNameProps {
  node: VM.Name;
  readonly?: boolean;
  noWrap?: boolean;
}
const ToolTipChild = ({ text }: { text: string | undefined | null }) => <span>{text}</span>;

export const TopicName = ({ node, noWrap }: TopicNameProps) => {
  const hover = useObserveValue(() => node.hover, [node]);
  const readonly = node.readonly;

  return (
    <TopicNameStyle
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      overflow={noWrap}
      // compat
      className="topic-name-container"
      {...{ hover, readonly }}
    >
      <Text node={node.textField} noWrap={noWrap} />
    </TopicNameStyle>
  );
};
