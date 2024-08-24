import * as VM from '../../../viewmodel';
import { useCallback, useEffect, useState, useMemo } from 'preact/hooks';
import { Spinner } from '../../../assets';
import { Model, trxWrap } from '@edvoapp/common';
import { Observable, tryJsonParse, useObserveValue } from '@edvoapp/util';
import styled from 'styled-components';
import { Annotator } from '../../../service';
import { Behaviors, WebViewEvent } from '../../..';
import { PositionAndType } from '../../../behaviors';

const LoadingContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  text-align: center;
  background: white;
  justify-content: center;
`;

export const WebView = ({ node }: { node: VM.BodyContent }) => {
  const closestMember = useMemo(() => node.closestInstance(VM.Member), [node]);
  const closestContent = useMemo(() => node.closestInstance(VM.ContentCard), [node]);
  const closestDockItemBody = useMemo(() => node.closestInstance(VM.DockItemBody), [node]);
  const cardNode = closestMember || closestContent || closestDockItemBody;
  if (!cardNode) throw new Error('how did you get here');
  const url = useObserveValue(() => node.url, [node]);
  const partition = useObserveValue(() => cardNode.partition, [cardNode]);
  const [part, setPart] = useState<string | null | undefined>(null); // part: short for partition
  const [noRender, setNoRender] = useState(false);

  const dragStates = useMemo(() => {
    const dragStates: Observable<PositionAndType | null>[] = [];
    let member = node.closestInstance(VM.Member);
    while (member) {
      dragStates.push(member.dragging);
      member = member.parentNode?.closestInstance(VM.Member);
    }
    return dragStates;
  }, [node]);

  // I'm not really in love with this solution, but it works.
  // It's unclear to me why the webview is taking events when the overlay is in place though
  const anyDrag = useObserveValue(() => {
    const obs = new Observable(false);

    function update(val: PositionAndType | null) {
      obs.set(dragStates.some((dragState) => dragState.value));
    }

    for (const dragState of dragStates) {
      obs.onCleanup(dragState.subscribe(update));
    }
    return obs;
  }, [dragStates]);

  const activeProfile = useObserveValue(() => cardNode.activeProfile, [cardNode]);

  useEffect(() => {
    setPart(partition);

    // HACK: Force reload.
    setNoRender(true);
    setTimeout(() => {
      setNoRender(false);
    }, 1000);
  }, [partition]);

  const create_sibling_card = useCallback(
    (event: { url: string }) => {
      const url = Behaviors.UrlPaste.urlTidy(event.url)?.toString();
      // if this item is rendered w/in a dock, this will be undefined.
      const space = node.findClosest((n) => n instanceof VM.TopicSpace && n);
      const parent = space?.vertex;
      if (!url || !parent) return;

      void trxWrap(async (trx) => {
        const name = (await window.electronAPI?.webview.getTitle(url)) ?? '';
        const sibling = await Model.Vertex.upsert({
          trx,
          kind: 'resource',
          parent: null,
          name,
          attributes: { url },
          onCreate: (trx, vertex) => {
            void vertex.createProperty({
              trx,
              role: ['body'],
              contentType: 'text/x-uri',
              initialString: url,
            });
          },
        });

        await Behaviors.createEmbedProps(sibling, url, trx);

        const currentNode = node.findClosest(
          (n) => (n instanceof VM.ContentCard && n) || (n instanceof VM.Member && n),
        );

        const currentMeta = (await currentNode?.meta.get()) || {
          x_coordinate: 0,
          y_coordinate: 0,
        };
        const size = (await currentNode?.getSize()) || { width: 0 };

        const { width } = size;
        const { x_coordinate, y_coordinate, height } = currentMeta;

        const meta = {
          x_coordinate: (x_coordinate ?? 0) + (width ?? 0) + 50,
          y_coordinate: y_coordinate ?? 0,
          width: 810,
          height,
          autoposition: true,
          display: 'content' as const,
        };

        sibling.createEdge({
          target: parent,
          trx,
          role: ['member-of', 'tag'],
          meta,
        });

        node.vertex.createEdge({
          target: sibling,
          trx,
          role: ['sibling-of'],
          meta: {},
        });

        if (activeProfile) {
          sibling.createEdge({
            trx,
            target: activeProfile,
            role: ['using-profile'],
            meta: {},
          });
        }
      });
    },
    [activeProfile, node],
  );

  useEffect(() => {
    return window.electronAPI?.receive(
      'CREATE_SIBLING_CARD',
      ({ url, webContentsId }: { url: string; webContentsId: number }) => {
        const webview = node.domElement;
        try {
          const id = (webview as any).getWebContentsId();
          if (webContentsId !== id) return;
          create_sibling_card({ url });
        } catch (e) {
          node.traceError(e);
        }
      },
    );
  }, [node, create_sibling_card]);

  useEffect(() => {
    const webview = node.domElement;
  }, [node, url]);

  useEffect(() => {
    if (noRender) return;
    void node.waitForDomElement().then((wv: any) => {
      node.highlightManager.bindTransport(new Annotator.Transport.Webview(wv));
      const domReady = async (...args: any) => {
        // console.debug('WebView is ready');
        // If `activeProfile` is `true`, then it means that
        // this webview/iframe uses a non-default profile.
        if (activeProfile) {
          try {
            const webContentsId = wv.getWebContentsId();
            // `encodedJpeg` is a string of JPEG data encoded in Base64.
            const encodedJpeg = (await window.electronAPI?.webview.screenshot.capture(webContentsId)) as string;
            node.createImageCapture(encodedJpeg);
          } catch (e) {
            node.traceError(e);
          }
        }

        // console.debug('URL', wv.getURL(), url, wv.getURL() === url);
        // if (url && wv.getURL() !== url) {
        //   window.electronAPI?.webview.loadURL(url, wv.getWebContentsId());
        // }
      };

      // TODO: I don't think this belongs here -- it should probably go into the transport
      // but the transport has a lot of logic specific to highlight so I don't wanna mess with it right now
      const ipcMessage = (event: any) => {
        const payload = tryJsonParse<any>(event.args[0]);
        console.debug('Received IPC message:', event.channel, payload);
        switch (event.channel) {
          case 'COMMAND/KEYDOWN': {
            const { key, altKey, metaKey, ctrlKey } = payload;
            window.dispatchEvent(new KeyboardEvent('keydown', { key, altKey, metaKey, ctrlKey }));
            break;
          }
          default:
            break;
        }
      };
      wv.addEventListener('dom-ready', domReady);
      wv.addEventListener('ipc-message', ipcMessage);

      return () => {
        wv.removeEventListener('dom-ready', domReady);
        wv.removeEventListener('ipc-message', ipcMessage);
      };
    });
  }, [part, noRender, node]);

  const preload = window.electronAPI?.WEBVIEW_PRELOAD_PATH;
  if (!part)
    return (
      <LoadingContainer>
        Waiting for profile... &nbsp;&nbsp;
        <Spinner className="animate-spin h-10 w-10 text-indigo-600" />
      </LoadingContainer>
    );
  if (noRender) {
    return (
      <LoadingContainer>
        Reloading... &nbsp;&nbsp;
        <Spinner className="animate-spin h-10 w-10 text-indigo-600" />
      </LoadingContainer>
    );
  }

  return (
    <>
      {/* @ts-ignore */}
      <webview
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: anyDrag ? 'none' : 'unset',
        }}
        key={node.key}
        src={url}
        sandbox="allow-forms allow-scripts allow-same-origin"
        partition={part}
        preload={preload ? `file://${preload}` : undefined}
        ref={(ref: any) => {
          node.safeBindDomElement(ref);
        }}
        useragent={navigator.userAgent}
        allowpopups
      />
    </>
  );
};
