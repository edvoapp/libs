import { useObserveValue } from '@edvoapp/util';
import { ActionMenu, BodyContent, VM } from '../..';
import { SpaceCard } from './topic-space-card';
import styled, { css } from 'styled-components';
import { MemberAppearance } from '../../behaviors';

interface Props {
  node: VM.ContentCard;
}

const MemberBodyR = styled.div<{
  backgroundColor?: string;
  color?: string;
  appearance?: MemberAppearance | null | undefined;
  indicated?: boolean;
}>`
  flex: 1 1 0%;
  overflow: auto;
  width: 100%;
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: center;
`;

export const ContentCard = ({ node }: Props) => {
  const actionMenu = useObserveValue(() => node.actionMenu, [node]);
  return (
    <>
      {actionMenu && <ActionMenu node={actionMenu} />}
      <SpaceCard node={node}>
        <MemberBodyR>
          <BodyContent
            {...{
              metaContainer: node.vertex,
              node: node.content,
            }}
          />
        </MemberBodyR>
      </SpaceCard>
    </>
  );
};
