import { ShareDropmenu } from './share-controls';
import './topic-space-hud.scss';
import { VM } from '../..';
import { useObserveValue } from '@edvoapp/util';
import styled from 'styled-components';

const ShareTrayStyled = styled.div`
  .share-controls {
    width: 90px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .share-button {
      border: solid 1px rgba(0, 0, 0, 0.1);
      font-size: 16px;
      border-radius: 5px;
      height: 40px;
      background: white;
      cursor: pointer;
      text-align: center;
      display: flex;
      justify-content: center;
      align-items: center;
      min-width: 90px;
    }
    .share-controls-tooltip {
      font-size: 12px;
    }

    .dropdown-modal-container {
      margin-top: 5px;
      border-radius: 10px;
      border: solid 1px rgba(0, 0, 0, 0.1);
      box-shadow: none;
      padding: 20px;
      .dropdown-container {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 20px;
        .dropdown-description {
          width: 140px;
        }
        select {
          padding: 5px;
          border: solid 1px rgba(0, 0, 0, 0.1);
          border-radius: 5px;
          box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.07);
        }
      }
      .copy-link-button {
        border-radius: 20px;
        height: 30px;
        padding-inline: 20px;
        text-align: center;
        border-width: 1px;
        border-color: #6431e0;
        color: #6431e0;

        svg {
          & path {
            fill: #6431e0;
          }
        }
      }
      .primary-button {
        background: #6431e0;
        border-radius: 20px;
        height: 30px;
        padding-inline: 20px;
        text-align: center;
        color: white;
        margin-left: auto;
      }
    }
  }
`;

export const ShareTray = ({ node }: { node: VM.ShareTray }) => {
  const isTiling = useObserveValue(() => node.isTiling, [node]);
  if (isTiling) return null;

  return (
    <ShareTrayStyled
      ref={(r: HTMLElement | null) => {
        node.safeBindDomElement(r);
      }}
    >
      <ShareDropmenu vertex={node.vertex} node={node.shareDropmenu} />
    </ShareTrayStyled>
  );
};
