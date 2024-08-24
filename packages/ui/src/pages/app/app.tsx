import { Analytics, config } from '@edvoapp/common';
import * as VM from '../../viewmodel';

import { useEdvoObj, useObserveValue } from '@edvoapp/util';
import Router from 'preact-router';
import { Match } from 'preact-router/match';
import { useRef } from 'preact/hooks';
// import { wrapGrid } from 'animate-css-grid';
import Modal from 'react-modal';
import cx from 'classnames';
import styled from 'styled-components';
import { createHashHistory } from 'history';

import { TopicSpacePage } from '../topic-space';
import { AuthService, EventNav } from '../../service';
import {
  ChatPanel,
  ContextMenuRenderer,
  DebugPanel,
  Header,
  HelpModalButton,
  Lasso,
  ReportBugsModal,
  ReportLogsButton,
  SearchPanel,
  SyncProfilesModal,
  ToggleChatButton,
  Toolbar,
} from '../../components';
import { HomePage } from '../home';
import { NewTopicPage } from '../new-topic';
import '../../styles/index.scss';
import { Launch } from '../launch';

Modal.setAppElement(document.body);

function logCurrentPage() {
  // TODO: hash any IDs (but not route names)
  const hashedUrl = window.location.pathname;
  Analytics.page();
}

const DesktopPage = styled.div`
  width: ${(props) => '100vw'};
  height: calc(100vh - 60px); // 60px height of header
`;

/**
 * The application rendered on desktop devices.
 */
export function App({ authService, kind }: { authService: AuthService; kind: 'desktop' | 'native' }) {
  const context = VM.globalContext();
  const r = kind === 'native' ? createHashHistory() : undefined;

  const appNode = useEdvoObj(() => {
    // This VM Node is the root of all other nodes
    const rootNode = VM.AppDesktop.new({
      context,
      parentNode: null,
    });

    // globalStore.setRootNode(rootNode);
    context.setRootNode(rootNode);
    (window as any).rootNode = rootNode;
    return rootNode;
  }, [authService]);

  const eventNav = useEdvoObj(() => {
    // Note: unclear to me why this sometimes runs twice
    if (context._eventNav) {
      return context.eventNav;
    }
    const eventNav = new EventNav({
      domRoot: document,
      authService,
      rootNode: appNode,
      selectionState: context.selectionState,
      focusState: context.focusState,
      navigationHistory: context.navigationHistory,
    });
    window.eventNav = eventNav;
    context.setEventNav(eventNav);
    return eventNav;
  }, [appNode, authService]);

  const layoutRef = useRef<HTMLDivElement>();

  const tsPage = useObserveValue(() => appNode.topicSpace, [appNode]);
  const launch = useObserveValue(() => appNode.launch, [appNode]);
  // const dockSouth = useObserveValue(() => appNode.dockSouth, [appNode]);
  const quickAdd = useObserveValue(() => appNode.quickAdding, [appNode]);
  const newTopicPage = useObserveValue(() => appNode.newTopic, [appNode]);
  const debugPanel = useObserveValue(() => appNode.debugPanel, [appNode]);
  const lasso = useObserveValue(() => appNode.lasso, [appNode]);
  const fixedItems = useObserveValue(() => appNode.fixedItems, [appNode]);
  const homePage = useObserveValue(() => appNode.homePage, [appNode]);
  const reportBugsModal = useObserveValue(() => appNode.reportBugsModal, [appNode]);
  const reportBugsButton = useEdvoObj(() => appNode.reportBugsButton, [appNode]);
  const syncProfilesModal = useObserveValue(() => appNode.syncProfilesModal, [appNode]);

  const toggleChatButton = useEdvoObj(() => appNode.toggleChatButton, [appNode]);
  const chatPanel = appNode.chatPanel;

  return (
    <>
      <div
        tabIndex={-1}
        className={cx('desktop-layout', { quickAdd })}
        ref={(ref) => {
          if (ref && !layoutRef.current) {
            layoutRef.current = ref;
            appNode.safeBindDomElement(ref);
            // wrapGrid(ref, { easing: 'backOut' });
          }
        }}
      >
        {/*
        This is required in order to be notified when someone calls preact/Router.route("/whatever")
        TODO: implement viewModelContext.route("/whatever") or similar
      */}
        {/* @ts-ignore */}
        <Router onChange={() => appNode.context.eventNav.onLocationChange('preact')}>
          {/* @ts-ignore */}
          <Match default>{() => {}}</Match>
        </Router>
        {!launch && <Header node={appNode.header} />}
        <div className="desktop-body">
          {!homePage && !launch && (
            <div className="h-full flex flex-col justify-center">
              <Toolbar node={appNode.toolbar} />
            </div>
          )}
          <DesktopPage className="desktop-page">
            {/* @ts-ignore preact */}
            <>
              {homePage ? (
                <HomePage node={homePage} />
              ) : launch ? (
                <Launch node={launch} />
              ) : tsPage ? (
                <TopicSpacePage node={tsPage} key={tsPage.key} />
              ) : newTopicPage ? (
                <NewTopicPage node={newTopicPage} />
              ) : null}
            </>
          </DesktopPage>
        </div>
        {/*{dockSouth && <Dock side={DockSide.South} node={dockSouth} />}*/}
        <ContextMenuRenderer node={appNode.contextMenu} />
        {lasso && <Lasso node={lasso} />}
        {debugPanel && <DebugPanel node={debugPanel} />}
        {syncProfilesModal && <SyncProfilesModal node={syncProfilesModal} />}
        <SearchPanel node={appNode.searchPanel}></SearchPanel>
        {fixedItems.map((i) => {
          const Comp = i.component;
          if (!Comp) return null;
          return <Comp node={i} key={i.key} />;
        })}
        {!launch && chatPanel && <ChatPanel node={chatPanel} />}
        {!launch && <ToggleChatButton node={toggleChatButton} />}
        {!launch && <ReportLogsButton node={reportBugsButton} />}
        {reportBugsModal && <ReportBugsModal node={reportBugsModal} />}
        <HelpModalButton />
      </div>
    </>
  );
}
