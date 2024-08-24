import * as VM from '../../../viewmodel';
import { useEffect, useMemo } from 'preact/hooks';
import { useObserveValue, useObserveValueMaybe } from '@edvoapp/util';
import { DomainDisabled } from '../../../assets';
import styled from 'styled-components';
import { Annotator } from '../../../service';
import { IframeSkeleton } from './iframe-skeleton';

const LoadingContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  text-align: center;
  background: #ffbbbb88;
  justify-content: center;
`;

// https://airtable.com/appLN00r6MbImfUzV/tblJwZMoZxVLkVcXR/viwAarz4WrPaynWrk/recqKkHJTDUuYrmcy?blocks=hide
const domainDenyList = [
  'https://calendar.google.com',
  'https://mail.google.com',
  'https://web.whatsapp.com',
  'https://www.reddit.com',
  'https://www.instagram.com',
  'https://onedrive.live.com',
  'https://console.firebase.google.com',
  'https://www.facebook.com',
  'https://framer.com',
  'https://zapier.com',
  'https://search.google.com',
];

const HeaderContainer = styled.div`
  background: #eff6ff;

  color: #18181b;
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: 100%; /* 14px */
  letter-spacing: 0.14px;

  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HeaderText = styled.span`
  // Add any specific styles for the text here
`;

const OpenLinkButton = styled.a`
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  leading-trim: both;
  text-edge: cap;
  font-weight: 600;
  line-height: 150%; /* 21px */
  letter-spacing: 0.14px;

  padding: 6px 12px;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus {
    outline: none;
  }
`;

const IframeWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  height: 100%;
  background: white;
`;

const BestExperienceHeader = ({ url }: { url: string }) => {
  return (
    <HeaderContainer>
      <HeaderText>For the best experience</HeaderText>
      <OpenLinkButton href={url} target="_blank">
        Open Link in New Tab
      </OpenLinkButton>
    </HeaderContainer>
  );
};

export const IFrame = ({ node }: { node: VM.BodyContent }) => {
  const closestMember = useMemo(() => node.closestInstance(VM.Member), [node]);
  const closestContent = useMemo(() => node.closestInstance(VM.ContentCard), [node]);
  const closestDockItemBody = useMemo(() => node.closestInstance(VM.DockItemBody), [node]);
  const cardNode = closestMember || closestContent || closestDockItemBody;
  const url = useObserveValue(() => node.url, [node]);
  const icon = useObserveValue(() => node.icon, [node]);
  const missingExt = useObserveValue(() => node.missingExt, [node]);
  const blockIframeRender = useMemo(() => {
    if (!url) return false;
    const u = new URL(url);
    return domainDenyList.includes(u.origin);
  }, [url]);

  if (!cardNode) throw new Error('how did you get here');

  const activeProfile = useObserveValue(() => cardNode.activeProfile, [cardNode]);

  useEffect(() => {
    void node.waitForDomElement().then((wv) => {
      node.highlightManager.bindTransport(new Annotator.Transport.Iframe(wv as HTMLIFrameElement));
    });
  }, [node]);

  const encodedJpeg = useObserveValue(() => node.imageCaptureProperty, [node]);
  const isFocused = useObserveValue(() => node.isFocused, [node]);

  return url ? (
    <>
      {activeProfile && encodedJpeg ? (
        <div className="contents-not-available">
          <img
            src={`data:image/jpeg;base64,${encodedJpeg}`}
            alt="some web contents"
            className="contents-not-available__screenshot"
          />
          <div className="contents-not-available__message__container">
            <p className="contents-not-available__message">
              This card uses the profile feature, which is not available in the web experience.
              <br />
              <br />
              Please use the Edvo app to view this card.
            </p>
          </div>
        </div>
      ) : missingExt ? (
        <IframeSkeleton node={node} kind="extension-cta" />
      ) : blockIframeRender ? (
        <IframeSkeleton node={node} kind="not-supported" />
      ) : (
        <IframeWrapper data-pw="iframe-wrapper">
          <BestExperienceHeader url={url} />
          <iframe
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              pointerEvents: `${isFocused === 'leaf' ? 'auto' : 'none'}`,
              background: 'white',
            }}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            allow="autoplay 'none'; accelerometer; ambient-light-sensor; camera *; gamepad; gyroscope; microphone *; midi; speaker-selection"
            referrerpolicy="no-referrer"
            loading="lazy"
            src={url}
            data-private
            ref={(ref: any) => {
              node.safeBindDomElement(ref);
            }}
          />
        </IframeWrapper>
      )}
    </>
  ) : (
    <>
      <LoadingContainer>
        <DomainDisabled />
      </LoadingContainer>
    </>
  );
};
