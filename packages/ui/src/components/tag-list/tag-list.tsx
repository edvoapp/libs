import styled, { css } from 'styled-components';
import * as VM from '../../viewmodel';
import { useObserveValue } from '@edvoapp/util';
import { Lozenge, LozengeStyle } from '../topic/topic-lozenge';
import { AddTag } from './add-tag';
import { TagSearchList } from './tag-search-list';
import { Text } from '../topic/body-content/text';
import { Tooltip } from '../tooltip';

interface Props {
  node: VM.TagList;
  hideCaret?: boolean;
}

const Root = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  // padding: 4px 8px;
  flex: 1;

  ${LozengeStyle} {
    margin-right: 8px;
    margin-bottom: 2px;
  }
`;

const AndMore = styled.span`
  font-size: 12px;
  margin-right: 4px;
`;

const StyledLozenge = styled(Lozenge)`
  display: flex;
  align-items: center;
`;

export const TagList = ({ node, hideCaret }: Props) => {
  const tags = useObserveValue(() => node.members, [node]);
  const limit = node.limit ?? tags.length;
  const sliced = tags.slice(0, limit);
  const caretPosition = useObserveValue(() => node.caretPosition, [node]);
  const focused = useObserveValue(() => node.isFocused, [node]);
  const tagSearch = useObserveValue(() => node.tagSearch, [node]);

  return (
    <Root ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {sliced.map((lozenge, index) => (
        <>
          {!hideCaret && caretPosition === index && focused && tagSearch && <TagSearchCaret node={tagSearch} />}
          <StyledLozenge node={lozenge} />
        </>
      ))}
      {!hideCaret && caretPosition === sliced.length && focused && tagSearch && <TagSearchCaret node={tagSearch} />}
      {tags.length > limit && <AndMore>...and {tags.length - limit} more</AndMore>}
      <AddTag node={node.addTagButton} />
    </Root>
  );
};

const CaretRoot = styled.div<{ inline?: boolean }>`
  padding-left: -5px;
  margin-right: 2px;

  ${(props) =>
    props.inline &&
    css`
      display: inline-block;
      margin-left: 0;
      margin-right: 4px;
    `}
`;

export function TagSearchCaret({ node, inline }: { node: VM.TopicSearch; inline?: boolean }) {
  return (
    <CaretRoot ref={(r: HTMLElement | null) => node.safeBindDomElement(r)} inline={inline}>
      <Text node={node.textfield} noWrap caretHeight={18} />
      <TagSearchList node={node.topicSearchList} />
    </CaretRoot>
  );
}
