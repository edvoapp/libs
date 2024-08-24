import styled, { css } from 'styled-components';
import { config } from '@edvoapp/common';
import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../../viewmodel';
import { Icon } from './icon';
import { OpenInNewIcon } from '../../../assets';
import GoogleChrome from '../../../assets/icons/google-chrome';

const Container = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  flex-direction: column;
  position: relative;
`;

const App = styled.div`
  gap: 24px;
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  padding: 24px;
  overflow: hidden;
  align-items: flex-start;
  flex-shrink: 0;
  flex-direction: column;
  background-color: rgba(255, 255, 255, 1);
`;

const Header = styled.div`
  gap: 12px;
  height: 32px;
  display: flex;
  align-self: stretch;
  align-items: center;
  flex-shrink: 0;
`;

const Logo = styled.div`
  gap: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  border-radius: 500px;
  background-color: rgba(232, 236, 245, 1);
`;

const HeaderCol = styled.div`
  gap: 8px;
  flex: 1;
  width: 32px;
  height: 16px;
  display: flex;
  align-items: center;
  flex-direction: column;
  background-color: rgba(232, 236, 245, 1);
`;

const Body = styled.div`
  gap: 12px;
  flex: 1;
  height: 100%;
  display: flex;
  align-self: stretch;
  align-items: flex-start;
  justify-content: flex-start;
`;

const Col = styled.div`
  gap: 12px;
  flex: 1;
  width: auto;
  display: flex;
  align-self: stretch;
  align-items: flex-start;
  flex-direction: column;
  justify-content: flex-start;
`;

const Item = styled.div<{ size: number }>`
  gap: 8px;
  ${(props) =>
    props.size > 0
      ? css`
          height: ${props.size}%;
        `
      : css`
          flex: 1;
        `}
  display: flex;
  align-self: stretch;
  align-items: flex-start;
  flex-direction: column;
  background-color: rgba(215, 221, 231, 1);
`;

const cols = [[0], [10, 0], [0, 30, 10], [0, 30], [0, 0]];

const Overlay = styled.div`
  position: absolute;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.2) 100%;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CTAHeader = styled.div`
  color: #18181b;
  text-align: center;
  font-family: Inter;
  font-size: 18px;
  font-style: normal;
  font-weight: 600;
  line-height: 100%; /* 18px */
  letter-spacing: 0.18px;
`;

const CTAStyled = styled.div`
  display: flex;
  padding: 24px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 24px;
  width: 308px;
  border-radius: 3px;
  background: #fff;

  img {
    width: 48px;
    height: 48px;
  }
`;

const OpenInNewTabButton = styled.a`
  display: flex;
  height: 40px;
  padding: 8px 12px;
  justify-content: center;
  align-items: center;
  gap: 12px;
  align-self: stretch;
  border-radius: 3px;
  border: 1px solid #e4e4e7;
  background: #fafafa;
  color: #27272a;
  text-align: center;
  leading-trim: both;
  text-edge: cap;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: 150%; /* 21px */
  letter-spacing: 0.14px;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus {
    outline: none;
  }
`;

export const IframeSkeleton = ({ node, kind }: { node: VM.BodyContent; kind: 'extension-cta' | 'not-supported' }) => {
  const snapshot = useObserveValue(() => node.imageCaptureProperty, [node]);
  if (snapshot)
    return (
      <Container ref={(ref: HTMLDivElement | null) => node.safeBindDomElement(ref)}>
        <img
          src={`data:image/jpeg;base64,${snapshot}`}
          alt="some web contents"
          className="contents-not-available__screenshot"
        />
        <CTAWithNode node={node} kind={kind} />
      </Container>
    );

  if (kind === 'not-supported')
    return (
      <Container ref={(ref: HTMLDivElement | null) => node.safeBindDomElement(ref)}>
        <img
          src={`/iframe-bg.jpeg`}
          alt="not available"
          style={{
            opacity: 0.2,
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            right: 0,
          }}
        />
        <CTAWithNode node={node} kind={kind} />
      </Container>
    );

  return (
    <Container ref={(ref: HTMLDivElement | null) => node.safeBindDomElement(ref)}>
      <App>
        <Header>
          <Logo />
          <HeaderCol />
          <HeaderCol />
          <HeaderCol />
        </Header>
        <Body>
          {cols.map((sizes, i) => (
            <Col key={i}>
              {sizes.map((size, j) => (
                <Item size={size} key={j} />
              ))}
            </Col>
          ))}
        </Body>
      </App>
      <CTAWithNode node={node} kind={kind} />
    </Container>
  );
};

export const CTAWithNode = ({ node, kind }: { node: VM.BodyContent; kind: 'extension-cta' | 'not-supported' }) => {
  const url = useObserveValue(() => node.url, [node]);
  // const icon = useObserveValue(() => node.favicon, [node]);
  const icon = node.favicon;
  if (!url) return null; // note that skeleton does not get rendered w/o a url

  return (
    <Overlay ref={(r: HTMLDivElement | null) => node.safeBindDomElement(r)}>
      <CTAStyled>
        {icon && <Icon node={icon} />}
        {kind === 'extension-cta' && <CTAHeader>Install Chrome Extension</CTAHeader>}
        {kind === 'extension-cta'
          ? 'To use all the webpages within this space.'
          : 'This webpage is saved, and full support is coming soon! For now:'}
        {kind === 'extension-cta' && (
          <OpenInNewTabButton href={config.extensionURL} target="_blank">
            <GoogleChrome width={16} height={16} />
            Install Chrome Extension
          </OpenInNewTabButton>
        )}
        <OpenInNewTabButton href={url} target="_blank">
          <OpenInNewIcon />
          Open Link in New Tab
        </OpenInNewTabButton>
      </CTAStyled>
    </Overlay>
  );
};
