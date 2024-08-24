import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import cx from 'classnames';

import { Lozenge, LozengeStyle, LozengeText } from '../topic-lozenge';
import * as VM from '../../../viewmodel';
import styled, { css } from 'styled-components';
import './text_styles.scss';
import { useSharedProperty } from '../../../hooks/useSharedState';
import { CaretAndTextHighlights } from './caret-and-text-highlights';
import { TagSearchCaret } from '../../tag-list/tag-list';
import { Tooltip } from '../..';
import { useMemo } from 'preact/hooks';

type Props = {
  node: VM.TextField;
  noWrap?: boolean;
  caretHeight?: number | string;
};

const TextDiv = styled.div<{
  readonly?: boolean;
  fitContent?: boolean | null;
  noWrap?: boolean;
}>`
  .vertex-component.appearance-highlight > .main > .body > & {
    background-color: #6e1fe947;
  }
  //user-select: text;
  flex: unset !important;
  justify-content: flex-start;
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
  resize: none;
  outline: none;
  //height: 100%;
  // width: unset !important;
  white-space: pre-wrap;
  position: relative;
  overflow-wrap: anywhere;

  .lozenge-inline-block {
    display: inline-block;
  }

  ${(props) => !props.readonly && css``}

  ${(props) =>
    props.fitContent &&
    css`
      height: fit-content;
      width: 100%;
      display: block;
    `}
  
  ${(props) =>
    props.noWrap &&
    css`
      white-space: pre;
      display: flex;
      align-items: center;
    `}

  &::placeholder {
    color: #8f8f92;
  }
`;

const TextChunkSpan = styled.span`
  vertical-align: top;
  display: inline;
`;

const EmptyText = styled.span`
  color: #8f8f92;
`;

export function Text({ node, noWrap, caretHeight }: Props) {
  const readonly = !useObserveValue(() => node.editable, [node]);
  // TODO - detangle parent fitContent vs child fitContent
  const fitContent = useObserveValueMaybe(() => node.fitContentParent?.fitContentObs, [node]);
  const myCaretRange = useObserveValueMaybe(() => node.myTextRange, [node]);
  const property = useObserveValueMaybe(() => node.propertyConfig?.obs, [node]);
  const { sharedCx } = useSharedProperty(property);
  const lip = useObserveValue(() => node.lip, [node]);
  const lic = useObserveValue(() => node.topicSearch, [node]);

  // TODO pass these properies through the TextDiv:
  // id="full-name"
  // name="full-name"
  // type="text"
  // autoComplete="full-name"
  // required
  // className="form-input appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:z-10 sm:text-sm"
  // placeholder="Full Name"

  const contentItems = useObserveValue(() => node.contentItems, [node]);
  const isEmpty = node.isEmpty();

  const allItems = () => {
    const items = [];
    const n = contentItems.length;
    for (let i = 0; i < n; i++) {
      if (i === lip) {
        lic && items.push(<LozengeInsertionCaret node={lic} />);
      }
      items.push(<Chunk node={contentItems[i]} />);
    }
    if (n === lip) {
      lic && items.push(<LozengeInsertionCaret node={lic} />);
    }
    return items;
  };

  return (
    <TextDiv
      fitContent={fitContent}
      noWrap={noWrap}
      readonly={readonly}
      tabIndex={0}
      className={cx('body', { readonly, fitContent }, sharedCx)}
      style={{ fontSize: node.fontSize }}
      ref={(el: HTMLElement | null) => node.safeBindDomElement(el)}
    >
      {allItems()}
      {isEmpty && <EmptyText>{node.emptyText}</EmptyText>}
      {myCaretRange && <CaretAndTextHighlights node={myCaretRange} caretHeight={caretHeight} />}
    </TextDiv>
  );
}
function TextEmbed({ node, builder }: { node: VM.TextEmbed; builder: (child: VM.TextEmbeddedNode) => JSX.Element }) {
  const child = useObserveValue(() => node, [node]);
  return (
    <TextChunkSpan className="text" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      {/*  HACK: adds a focusable text */}
      &nbsp;
      {child ? builder(child) : <UnknownEmbed />}
      {/*  HACK: adds a focusable text */}
      &nbsp;
    </TextChunkSpan>
  );
}

export function UnknownEmbed() {
  return (
    <div style="display: inline-block">
      <Tooltip usePortal popperConfig={{ placement: 'top' }} tooltipChildren={<span>Unknown text item</span>}>
        <LozengeStyle background="#CCC">
          <LozengeText>?</LozengeText>
        </LozengeStyle>
      </Tooltip>
    </div>
  );
}

function Chunk({ node }: { node: VM.VMChunk }) {
  if (node instanceof VM.TextChunk) {
    return (
      <TextChunkSpan className="text" ref={(e: HTMLElement | null) => node.safeBindDomElement(e)}>
        {node.text.length !== 0 ? node.text : <>&nbsp;</>}
      </TextChunkSpan>
    );
  }
  return <TextEmbed node={node} builder={(child) => (child ? <Lozenge node={child} /> : <UnknownEmbed />)} />;
}
function LozengeInsertionCaret({ node }: { node: VM.TopicSearch }) {
  return (
    <TextChunkSpan className="text">
      <TagSearchCaret node={node} inline />
    </TextChunkSpan>
  );
}
