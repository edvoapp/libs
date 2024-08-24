import { FunctionComponent } from 'preact';
import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../viewmodel';
import styled from 'styled-components';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { ArrowBackIcon, ArrowForwardIcon, RefreshIcon } from '../../assets';
import { Text } from '../topic/body-content/text';

interface WebView extends HTMLIFrameElement {
  reload: () => void;
  getURL: () => string;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
}

interface WebViewEvent extends Event {
  url: string;
  isInPlace: boolean;
  type: string;
}

interface Props {
  node: VM.UrlBar;
}

const UrlBarContainer = styled.div`
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  // margin-left: 12px;
  flex-grow: 1;
  min-width: 180px;
  max-width: 100%;
`;

const UrlBarInputBlock = styled.div`
  display: flex;
  justify-content: space-between;
  flex-wrap: nowrap;
  align-items: center;
  flex-grow: 1;
  border-radius: 3px;
  padding: 2px 6px;
  border: 1px solid #e5e7eb;
  //max-width: 200px;
  max-width: 100%;
  position: relative;
  background: white;
`;

const UrlBarInputBlockInput = styled.div<{ isElectron: boolean }>`
  padding-left: 2px;
  font-size: 12px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: ${(props) => (props.isElectron ? `calc(100% - 40px)` : `calc(100% - 20px)`)};
`;
const NavBtn = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  position: relative;

  &:disabled {
    pointer-events: none;
    svg > path {
      stroke: #8e9aaf;
    }
  }
`;

const RefreshButton = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  //position: absolute;
  //right: 6px;
`;

// UrlBar is ONLY rendered when in browser mode, and so we can assume that we're in that mode.
export const UrlBar: FunctionComponent<Props> = ({ node }: Props) => {
  const isElectron = node.context.runtime === 'electron';
  const body = node.memberBody;
  if (!body) return null;
  const [webview, setWebview] = useState<null | WebView>(null);
  useEffect(() => {
    void body.waitForDomElement().then((el) => {
      setWebview(el as WebView);
    });

    // counter to determine stability of webview
    let counter = 0;

    const ti = setInterval(() => {
      if (webview && !webview.isConnected) {
        // preact refs like to change it up, so we have to "watch" the dom element
        console.count(`NEW WEBVIEW for body-${body.key}`);
        setWebview(body.domElement! as WebView);
      } else counter++; // if the webview is still connected, increment counter

      if (counter >= 100) clearInterval(ti);
    }, 100);

    return () => {
      // anytime the webview changes, reset counter and interval
      counter = 0;
      clearInterval(ti);
    };
  }, [body, webview]);
  const appearance = useObserveValue(() => body.appearance, [body]);

  // STATES
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);

  const memberNode = useMemo(() => node.findClosest((n) => n instanceof VM.Member && n), [node]);

  if (!memberNode) return null;
  const url = useObserveValue(() => node.url, [node]);
  const handleNav = useCallback(
    (e: WebViewEvent) => {
      const { url: evtUrl, isInPlace, type } = e;
      if (appearance?.type?.indexOf('browser') === -1) return;

      let shouldNav = false;
      const currentWVUrl = webview?.getURL();
      if (isInPlace) {
        // anchor tag clicked
        shouldNav = evtUrl !== url;
      } else {
        // URL changed externally; ie URL bar changed contents
        shouldNav = evtUrl !== url;
      }

      console.debug('NAV', type, isInPlace, evtUrl, currentWVUrl, url, 'SHOULD NAV', shouldNav);
      if (shouldNav && currentWVUrl) {
        node.memberBody?.updateUrl(currentWVUrl);
        node.unsavedUrl.set(null);
      }
    },
    [node, appearance, webview, url],
  );

  const handleDomReady = useCallback(() => {
    if (!webview) return;
    setCanGoBack(webview.canGoBack());
    setCanGoForward(webview.canGoForward());
    // node.unsavedUrl.set((webview as WebView).getURL());
  }, [setCanGoBack, setCanGoForward, webview]);

  if (isElectron) {
    useEffect(() => {
      // const webview = await body.waitForDomElement();
      if (!webview) return;

      // uncommenting this will fix in-page navigation but break URL bar nav
      // webview.addEventListener('did-navigate-in-page', handleNav);
      // @ts-expect-error not sure why it's mad
      webview.addEventListener('did-navigate', handleNav);
      webview.addEventListener('dom-ready', handleDomReady);

      return () => {
        // @ts-expect-error not sure why it's mad
        webview.removeEventListener('did-navigate-in-page', handleNav);
        // @ts-expect-error not sure why it's mad
        webview.removeEventListener('did-navigate', handleNav);
        webview.removeEventListener('dom-ready', handleDomReady);
      };
    }, [webview, handleNav, handleDomReady]);
  }

  return (
    <UrlBarContainer ref={(r: any) => node.safeBindDomElement(r)}>
      <UrlBarInputBlock>
        <UrlBarInputBlockInput isElectron={isElectron}>
          <Text node={node.text} noWrap />
        </UrlBarInputBlockInput>
        {isElectron && (
          <>
            <NavBtn onClick={() => node.goBack()} disabled={!canGoBack}>
              <ArrowBackIcon />
            </NavBtn>
            <NavBtn onClick={() => node.goForward()} disabled={!canGoForward}>
              <ArrowForwardIcon />
            </NavBtn>
          </>
        )}
        {url && (
          <RefreshButton onClick={() => node.refresh()}>
            <RefreshIcon />
          </RefreshButton>
        )}
      </UrlBarInputBlock>
    </UrlBarContainer>
  );
};
