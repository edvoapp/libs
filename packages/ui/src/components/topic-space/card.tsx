import styled, { css } from 'styled-components';
import { LozengeStyle } from '../topic/topic-lozenge';
import { IndicationFlag } from '../../viewmodel';

export const TopicCardRoot = styled.div<{
  backgroundColor?: string;
  color?: string;
}>`
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  max-height: 100%;
`;

export const TopicNameStyle = styled.div<{
  overflow?: boolean;
  hover?: boolean | string;
  readonly?: boolean;
}>`
  display: flex;
  font-weight: 400;
  align-items: center;
  font-size: 14px;
  line-height: 85%;

  ${({ hover, readonly }) =>
    hover &&
    readonly &&
    css`
      color: #4849f3;
    `}
  .input-wrap input {
    max-width: 260px;
    text-overflow: ellipsis;
  }

  & > input,
  & > textarea {
    background: none;
  }
`;

export const TopicListStyle = styled.div<{
  relationshipType?: string;
  reverse?: boolean;
  blank?: boolean;
  focused?: boolean;
}>`
  // background-color: #ddd;
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;

  .topic-search {
    min-width: 40px;
    font-size: 14px;

    .input-wrap {
      margin-bottom: 4px;
    }
  }

  ${LozengeStyle} {
    margin-right: 8px;
    margin-bottom: 0;
  }

  .andmore {
    font-size: 12px;
    margin-right: 4px;
  }

  ${(props) =>
    props.relationshipType === 'member-of' &&
    props.reverse &&
    css`
      ${LozengeStyle} {
        background-color: #c8caff;
        color: #2e32a1;
      }
    `}
`;

export const TopicSpaceCard = styled.div<{
  loading?: boolean;
  readonly?: boolean;
  shared?: boolean;
  changed?: boolean;
  member?: boolean;
  appearance?: string;
  hover?: boolean | string;
  focused?: boolean | string;
  selected?: boolean;
  hasIcon?: boolean;
  isIndicated?: Record<IndicationFlag, boolean>;
  bgColor?: string;
}>`
  outline: none;
  position: absolute;
  display: flex;
  align-items: stretch;
  transition: transform 1s;
  overflow: visible;

  ${(props) =>
    props.appearance !== 'stickynote' &&
    css`
      border-radius: 6px;
    `}
  ${(props) =>
    props.isIndicated?.drag && props.focused
      ? css`
          background: linear-gradient(rgba(157, 80, 255, 0.02), rgba(157, 80, 255, 0.08)), ${props.bgColor || '#fff'};
        `
      : css`
          background: ${props.bgColor || '#fff'};
        `}
    ${(props) =>
    props.hover === 'arrow' &&
    css`
      border: 1px solid #8800ff;
    `}
    ${(props) =>
    props.loading &&
    css`
      background: #4422ff09;
      border-radius: 6px;
    `}
    ${(props) =>
    props.readonly &&
    css`
      &:hover {
        margin: -4px;
        border: #ddd 4px solid;

        &::before {
          content: 'Read-only link';
          position: absolute;
          height: 24px;
          right: 16px;
          top: -24px;
          overflow: hidden;
          background-color: #ddd;
          white-space: nowrap;
          padding: 2px 4px;
          font-size: 12px;
          color: #bbb;
          border-top-right-radius: 6px;
          border-top-left-radius: 6px;
          z-index: 999999;
        }
      }
    `}
    ${(props) =>
    props.appearance === 'clean' &&
    css`
      .member {
        box-shadow: none;
      }
    `}
    ${(props) =>
    props.member &&
    css`
      & {
        > ${TopicControls} {
          opacity: 0;
          transition: opacity 500ms;
          position: absolute;
          margin: 4px;
          top: 0;
          right: 0;
          transform-origin: top right;
          transform: scale(var(--invertedScale)) translate(-10px, 10px);

          &:hover {
            opacity: 1;
            // background-color: blue;
          }
        }

        &.phantom {
          background-color: #cccccc33;
        }

        > .topic-member-outline {
          flex: 1;
          overflow-y: auto;
          display: flex;
          align-items: stretch;
          border-radius: 6px;

          .viewer {
            flex: 1;
            display: flex;
            align-items: stretch;

            .outline {
              flex: 1;
            }
          }
        }

        .unsized {
          min-height: 300px;
          min-width: 300px;
        }

        .topic-card-body {
          display: flex;
          align-items: stretch;
          overflow: hidden;
          flex: 1;
          height: 100%;
          width: 100%;

          > * {
            flex: 1;
          }

          .body {
            display: flex;
            align-items: center;
            flex: 1;
          }

          &--empty-browser {
            background-color: white;

            &__inner {
              // height: 100px;
              width: 100%;

              margin-top: 64px;
              margin-inline: auto;

              svg {
                margin: 25px auto;
              }
            }

            &__search-input {
              &__wrapper {
                display: flex;
                align-items: center;
                gap: 10px;

                width: 365px;
                max-width: 90%;
                height: 42px;

                margin: auto;

                background-color: #ece9f5;
                padding: 2px 16px;
                border-radius: 10px;

                font-size: 13px;

                svg {
                  height: 18px;
                }

                & path:nth-child(2) {
                  fill: #403d39;
                }
              }

              flex-grow: 1;

              display: block;
              background-color: #ece9f5;
            }
          }
        }

        .topic-content {
          flex: 1;

          iframe,
          webview {
            flex: 1;
          }
        }

        .viewer {
          overflow: auto;
        }

        .topic-subspace {
          height: 100%;
          width: 100%;

          &.infinity-mirror {
            background: rgb(231, 231, 231);
            background: radial-gradient(circle, rgba(231, 231, 231, 1) 0%, rgba(61, 23, 71, 0.758140756302521) 100%);
            justify-content: center;
            align-items: center;
            display: flex;
            color: #fff;
          }
        }
      }
    `}
    ${(props) =>
    props.hasIcon &&
    css`
      &,
      ${Chrome}, ${TopicSpaceCardBody} {
        background: none !important;
        box-shadow: none;
        border-color: transparent;
        outline: none;
      }

      ${TopicFooter} {
        display: none;
      }
    `}
    .react-resizable {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .react-resizable-handle {
    opacity: 0.3;
    background: none;
    display: block;
    position: absolute;
    width: calc(18px * var(--invertedScale));
    height: calc(18px * var(--invertedScale));
    z-index: 999999998;
  }

  .react-resizable-handle-n {
    transform: translateY(-50%);
  }

  .react-resizable-handle-s {
    transform: translateY(50%);
  }

  .react-resizable-handle-w {
    transform: translateX(-50%);
  }

  .react-resizable-handle-e {
    transform: translateX(50%);
  }

  .react-resizable-handle-nw {
    transform: translate(-50%, -50%);
  }

  .react-resizable-handle-ne {
    transform: translate(50%, -50%);
  }

  .react-resizable-handle-sw {
    transform: translate(-50%, 50%);
  }

  .react-resizable-handle-se {
    transform: translate(50%, 50%);
  }

  .react-resizable-handle-w,
  .react-resizable-handle-sw,
  .react-resizable-handle-nw {
    left: 0;
  }

  .react-resizable-handle-e,
  .react-resizable-handle-se,
  .react-resizable-handle-ne {
    right: 0;
  }

  .react-resizable-handle-n,
  .react-resizable-handle-ne,
  .react-resizable-handle-nw {
    top: 0;
  }

  .react-resizable-handle-s,
  .react-resizable-handle-se,
  .react-resizable-handle-sw {
    bottom: 0;
  }

  .react-resizable-handle-e,
  .react-resizable-handle-w {
    top: 0;
    height: 100%;
    cursor: ew-resize;
  }

  .react-resizable-handle-n,
  .react-resizable-handle-s {
    left: 0;
    width: 100%;
    cursor: ns-resize;
  }

  .react-resizable-handle-ne,
  .react-resizable-handle-sw {
    cursor: nesw-resize;
  }

  .react-resizable-handle-se,
  .react-resizable-handle-nw {
    cursor: nwse-resize;
  }

  .react-resizable-handle {
    &-ne,
    &-nw,
    &-se,
    &-sw {
      z-index: 999999999;
    }
  }
`;

export const TopicSpaceCardBody = styled.div<{ appearance?: string }>`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
`;

export const TopicSpaceCardInner = styled.div`
  display: flex;
  flex-direction: column;
`;

export const TopicControls = styled.div`
  display: flex;
  align-items: center;
  // position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  background: rgba(240, 240, 240);
  // needs to be bigger than the draggable overlay's 9999

  svg {
    cursor: pointer;
    height: 16px;
    width: 16px;
    margin-left: 4px;
    color: rgba(0, 0, 0, 0.26);

    &:hover {
      color: rgba(0, 0, 0, 1);
    }
  }
`;

export const SidecarStyles = styled.div<{}>`
  position: absolute;
  left: 100%;
  margin-left: 12px;
  background: #fff;
  width: 300px;
  display: flex;
  flex-direction: column;
  /* Color/Tooltip/BG80 */
  background: rgba(255, 255, 255, 0.8);
  /* Radial Menu/Global Effect
      Combined effects for radial menu
      */

  backdrop-filter: blur(15px);
  /* Note: backdrop-filter has minimal browser support */

  border-radius: 10px;
`;

export const SidecarHeader = styled.div`
  border-bottom: 1px solid #eae7ea;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const SidecarTitle = styled.span`
  font-weight: 500;
  font-size: 14px;
  line-height: 120%;
`;

export const SidecarHeaderButtons = styled.div`
  display: flex;
  align-items: center;
`;

export const SidecarBody = styled.div`
  overflow: auto;
  padding: 12px;
`;

export const ArrowOriginTarget = styled.div<{ side: 'n' | 'e' | 's' | 'w' }>`
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d4baf3;

  ${(props) => {
    switch (props.side) {
      case 'n':
        return css`
          top: -22px;
          left: 50%;
          pointer-events: auto;
        `;
      case 'e':
        return css`
          right: -22px;
          top: 50%;
          pointer-events: auto;
        `;
      case 's':
        return css`
          bottom: -22px;
          left: 50%;
          pointer-events: auto;
        `;
      case 'w':
        return css`
          left: -22px;
          top: 50%;
          pointer-events: auto;
        `;
      default:
        return css``;
    }
  }}
`;

const Chrome = styled.div<{
  appearance?: string;
  browsable?: boolean;
  browser?: boolean;
}>`
  width: 100%;
  display: flex;
  align-items: stretch;
  //overflow-x: auto;
  //overflow-y: hidden;
  overflow: visible;
  height: 48px;
  min-height: 48px;

  &:hover {
    .topic-list.blank {
      opacity: 1;
    }
  }

  .topic-list.blank {
    opacity: 0;
  }

  .topic-list.focused {
    opacity: 1;
  }
`;

export const TopicHeader = styled(Chrome)`
  display: flex;
  z-index: 1; // TODO: figure out why the heck this needs a z-index

  ${(props) =>
    props.browsable &&
    css`
      ${TopicHeaderInner} {
        padding-inline: 10px;
      }
    `}
  ${(props) =>
    props.browser &&
    css`
      ${TopicHeaderInner} {
        border-radius: 5px;
        background-color: #ecdbff;

        .input-wrap {
          margin-bottom: 0;
        }
      }
    `}
    ${TopicListStyle} {
    padding: 4px 12px;
  }
`;

export const TopicHeaderInner = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  padding: 8px 20px;
  width: 100%;

  > * {
    flex: 1 1 0;
    width: 0;
    overflow: auto;
    /* Hide scrollbar for Chrome, Safari and Opera */

    &::-webkit-scrollbar {
      display: none;
      //width: 5px; // this doesn't seem to actually work
    }

    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }
`;

const TopicHeaderInnerButton = styled.button`
  width: 11px;
  height: 11px;
  border-radius: 50%;
  margin-right: 6px;

  display: flex;
  align-items: center;
  justify-content: center;
`;
export const BrowserModeButton = styled(TopicHeaderInnerButton)`
  background-color: #bf5af2;
`;
export const ProfileSelectorButton = styled(TopicHeaderInnerButton)`
  background-color: #30d158;

  svg {
    height: 11px;
    margin-bottom: 1.5px;
    opacity: 0;

    &:hover {
      opacity: 1;
    }

    path {
      fill: #403d39;
    }
  }
`;

export const TopicFooter = styled(Chrome)`
  padding: 12px;
  overflow: auto;
  /* Hide scrollbar for Chrome, Safari and Opera */

  &::-webkit-scrollbar {
    display: none;
    //width: 5px; // this doesn't seem to actually work
  }

  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
`;

const OVERLAY_MARGIN = 5;

export const Overlay = styled.div<{
  focused?: boolean | string;
  isIndicated?: boolean;
}>`
  pointer-events: auto;
  position: absolute;
  z-index: 1;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;

  // note: items that are selected should have an overlay to allow drag

  ${(props) =>
    props.focused &&
    css`
      pointer-events: none;
      cursor: unset;
      background-color: rgba(0, 0, 0, 0);
    `}
  ${(props) =>
    !props.focused &&
    props.isIndicated &&
    css`
      background: linear-gradient(rgba(157, 80, 255, 0.02), rgba(157, 80, 255, 0.08));
    `}
    body.global-drag & {
    pointer-events: none;
  }

  .drag-container & {
    // silly css specificity error...
    pointer-events: none !important;
  }
`;
