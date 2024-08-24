import styled, { css } from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// @ts-ignore
import { byPrefixAndName } from '@awesome.me/kit-687bab9fd2/icons';
import { ChromeStore } from '../../assets';

export const Container = styled.div`
  font-family: 'Roboto', sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0) 0%, #fff 100%);
  color: #333;
`;
export const Card = styled.div`
  display: flex;
  width: 495px;
  padding: var(--H1, 48px);
  flex-direction: column;
  align-items: flex-start;
  border-radius: 3px;
  border: 1px solid var(--Black-50, rgba(0, 0, 0, 0.05));
  background: var(--White-1000, #fff);
  box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.1);
`;
export const Title = styled.h1`
  align-self: stretch;
  color: var(--Zinc-950, #09090b);
  /* Desktop/Text/H4/Bold */
  font-family: Inter;
  font-size: 24px;
  font-style: normal;
  font-weight: 700;
  line-height: 150%; /* 36px */
`;
export const Subtitle = styled.h1`
  align-self: stretch;
  color: var(--Zinc-900, #18181b);

  /* Desktop/Text/H6/Regular */
  font-family: Inter;
  font-size: 18px;
  font-style: normal;
  font-weight: 400;
  line-height: 135%; /* 24.3px */

  margin-bottom: 72px;
`;
export const StepsList = styled.ol`
  list-style: none;
  padding: 0;
  text-align: left;
`;
export const StepItem = styled.li`
  display: flex;
  flex-direction: column;
  position: relative;
`;
export const StepItemHeader = styled.div`
  display: flex;
  align-items: center;
  height: 16px;
`;
export const StepItemHeaderText = styled.div<{ complete: boolean }>`
  margin-left: 24px;

  color: #18181b;
  ${(props) =>
    props.complete &&
    css`
      text-decoration-line: line-through;
    `} /* Desktop/Text/H6/Medium */ font-family: Inter;
  font-size: 18px;
  font-style: normal;
  font-weight: 500;
  line-height: 135%; /* 24.3px */
`;
export const StepItemBody = styled.div<{ isLastStep?: boolean }>`
  padding-top: 16px;
  display: flex;
  margin-left: 7px;
  padding-left: 31px;
  border-left: ${(props) => (props.isLastStep ? 'none' : 'solid 2px #e4e4e4')};
  padding-bottom: ${(props) => (props.isLastStep ? '0' : '48px')};

  color: var(--Zinc-800, #27272a);
  text-align: center;

  /* Desktop/Text/Body/Semi Bold */
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: 115%; /* 16.1px */
`;
export const InstallChromeButton = styled.button`
  display: flex;
  padding: 12px;
  justify-content: center;
  align-items: center;
  gap: 12px;
  border-radius: 3px;
  border: 1px solid var(--Black-100, rgba(0, 0, 0, 0.1));
  background: var(--Zinc-50, #fafafa);
`;
export const InstallChromeButtonBody = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 4px;
  align-self: stretch;
`;
export const InstallChromeText = styled.button`
  color: var(--Zinc-800, #27272a);
  text-align: center;

  /* Desktop/Text/Small/Regular */
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 100%; /* 12px */
`;
export const InstallChromeSubtext = styled.button`
  color: var(--Zinc-800, #27272a);
  text-align: center;

  /* Desktop/Text/Body/Semi Bold */
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: 115%; /* 16.1px */
`;
export const InstallEdvoButton = styled.a`
  display: flex;
  padding: 8px 12px;
  justify-content: center;
  align-items: center;
  gap: 12px;

  border-radius: 3px;
  border: 1px solid var(--Black-100, rgba(0, 0, 0, 0.1));
  background: var(--Zinc-50, #fafafa);
`;
export const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
`;
export const CheckboxInput = styled.input`
  margin-right: 10px;
`;
export const RadioButtonLabel = styled.label`
  display: flex;
  align-items: center;
  margin-right: 20px;
`;
export const RadioButtonInput = styled.input`
  margin-right: 10px;
`;
export const BgRoot = styled.div`
  flex: none;
  inset: -192px;
  overflow: hidden;
  position: absolute;
  z-index: -1;
`;
export const VideoWrapper = styled.div`
  flex: none;
  inset: 0;
  position: absolute;
  z-index: -1;
`;
export const Video = styled.video`
  cursor: auto;
  width: 100%;
  height: 100%;
  border-radius: 0px;
  display: block;
  object-fit: cover;
  background-color: rgba(0, 0, 0, 0);
  object-position: 50% 50%;
`;
export const VideoOpacity = styled.div`
  flex: none;
  inset: 0;
  overflow: hidden;
  position: absolute;
  z-index: -1;
  background: radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0) 0%, rgb(255, 255, 255) 100%);
  opacity: 1;
`;

type StepProps = {
  complete: boolean;
  index: number;
  headerText: string;
  Body: () => JSX.Element;
};

export const Step = ({ complete, index, headerText, Body }: StepProps) => {
  return (
    <StepItem>
      <StepItemHeader>
        {complete ? (
          <FontAwesomeIcon icon={byPrefixAndName.fas['circle-check']} color="#65A30D" />
        ) : (
          <FontAwesomeIcon icon={byPrefixAndName.far[`circle-${index + 1}`]} />
        )}
        <StepItemHeaderText complete={complete}>{headerText}</StepItemHeaderText>
      </StepItemHeader>
      <StepItemBody isLastStep={index === 3}>
        <Body />
      </StepItemBody>
    </StepItem>
  );
};
