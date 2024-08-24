import { useObserveValue } from '@edvoapp/util';
import { DomainDisabled } from '../../../assets';
import { Skeleton } from '../../skeleton';
import { DisplayModuleProps } from './body-content';
import { WebView } from './webview';
import { IFrame } from './iframe';
import styled from 'styled-components';

const edvoDomain = new RegExp(/.*app.*\.edvo\.com$/i);

const LoadingContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  text-align: center;
  background: #ffbbbb88;
  justify-content: center;
`;

export const Uri = ({ node }: DisplayModuleProps) => {
  const currentUser = useObserveValue(() => node.context.authService.currentUserVertexObs, [node]);
  if (!currentUser) return null;

  const isElectron = node.context.runtime === 'electron';
  const url = useObserveValue(() => node.url, [node]);

  if (!url) return <Skeleton count={5} />;
  let u: URL | null = null;
  try {
    u = new URL(url);
    // eslint-disable-next-line no-empty
  } catch {}

  const isEdvoUrl = url && edvoDomain.exec(u?.hostname || '') !== null;

  // If the URL contains the Edvo domain or is invalid,
  // then do not render iframe/webview.
  // FIXME: we should probably render a portal if it's an Edvo URL
  if (!url || isEdvoUrl) {
    return (
      <>
        <LoadingContainer>
          {!url ? <>Invalid URL: {{ u }} &nbsp;</> : <>Declining to render Edvo Application URL&nbsp;</>}
          <DomainDisabled />
        </LoadingContainer>
      </>
    );
  }

  return isElectron ? <WebView node={node} /> : <IFrame node={node} />;
};
