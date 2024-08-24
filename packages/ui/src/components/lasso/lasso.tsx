import { useObserveValue } from '@edvoapp/util';
import styled from 'styled-components';
import * as VM from '../../viewmodel';

const LassoBox = styled.div`
  border: solid 1px #2563eb;
  position: fixed;
  z-index: 999999999999999;
`;

interface Props {
  node: VM.Lasso;
}
export const Lasso = ({ node }: Props) => {
  const dimensions = useObserveValue(() => node.rect, [node]);
  const visible = useObserveValue(() => node.visible, [node]);
  if (!visible || !dimensions) return null;
  return <LassoBox style={{ ...dimensions }} />;
};
