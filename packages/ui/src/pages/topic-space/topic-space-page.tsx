import { RoutableProps, route } from 'preact-router';
import { useEffect } from 'preact/hooks';
// import 'react-resizable/css/styles.css';
import { Analytics, config, trxWrap } from '@edvoapp/common';
import { Guard, useObserveValue } from '@edvoapp/util';
import {
  Button,
  ConversationModal,
  GuestUserBanner,
  Note,
  TopicSpaceComponent,
  TopicSpaceSidebar,
  TopicSpaceTitleBar,
  VM,
} from '../..';

// for some reason importing from node modules isn't working
// import './resizable-styles.scss';
import './topic-space.scss';
import { TopicSearchCard } from '../../components/topic-space/topic-search-card';
import styled from 'styled-components';

interface TopicSpaceProps extends RoutableProps {
  node: VM.TSPage;
}

export function TopicSpacePage({ node }: TopicSpaceProps) {
  if (!node.alive) return null;
  // useEffect(() => {
  //   let toastId: React.ReactText | null = toast(`Loading...`, {
  //     type: toast.TYPE.INFO,
  //     autoClose: false,
  //     hideProgressBar: true,
  //     closeOnClick: false,
  //     draggable: false,
  //     position: toast.POSITION.BOTTOM_LEFT,
  //   });

  //   void node.load().then(() => {
  //     if (toastId) {
  //       toast.dismiss(toastId);
  //       toastId = null;
  //     }
  //   });

  //   return () => {
  //     if (toastId) {
  //       toast.dismiss(toastId);
  //       toastId = null;
  //     }
  //   };
  // }, [node]);

  const currentUserVertex = useObserveValue(() => node.context.authService.currentUserVertexObs, [node]);

  const vertexUserID = useObserveValue(() => node.vertex.userID, [node]);
  const isShared = useObserveValue(() => node.isShared, [node]);

  // ensure that the topic space gets visited
  useEffect(() => {
    if (!currentUserVertex) throw new Error('sanity - how did you get here without being logged in?');

    if (!vertexUserID) return; // if the vertex user ID hasn't loaded yet, punt
    if (node.destroyed) return;
    void Guard.while(node.vertex, async (vertex) => {
      await trxWrap(async (trx) => {
        vertex.visit(trx);
        vertex.touch(trx);

        // only touch it if this belongs to me
        if (currentUserVertex.id === vertexUserID) {
          vertex.accessTouch(trx);
        }
      });
    });
  }, [node, currentUserVertex, vertexUserID]);

  useEffect(() => {
    Analytics.page({ isShared });
  }, [isShared]);

  // useEffect(() => {
  //   function handleMessage(e: MessageEvent) {
  //     if (!node.context.eventNav) return;
  //     if (e.data.type === 'COMMAND/BLUR') {
  //       console.log('blur!');
  //       // focus on nothing
  //       eventNav.selectionState.blur();
  //     }
  //   }
  //   window.addEventListener('message', handleMessage);
  //   return () => {
  //     window.removeEventListener('message', handleMessage);
  //   };
  // }, [eventNav]);

  const conversationModal = useObserveValue(() => node.conversationModal, [node]);
  const topicSearchCard = useObserveValue(() => node.topicSearchCard, [node]);
  const sidebarToggle = useObserveValue(() => node.sidebarToggle, [node]);
  if (!currentUserVertex || !node) return null;

  return (
    <div className="topic-space-parent" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <div
        style={{
          zIndex: 100_000,

          // zIndex: MIN_OTHER_ZINDEX,
        }}
      >
        <TopicSpaceTitleBar node={node.title} />
        <TopicSpaceSidebar node={node.sidebar} />
        {sidebarToggle && (
          <ToggleNotesButton>
            <Button node={sidebarToggle} toolTip="Open or collapse your notes" width={48} height={48}>
              <Note />
            </Button>
          </ToggleNotesButton>
        )}
      </div>
      <TopicSpaceComponent node={node.topicSpace} />
      <GuestUserBanner />
      {conversationModal && <ConversationModal node={conversationModal} key={conversationModal.key} />}
      {topicSearchCard && <TopicSearchCard topicSpace={node.topicSpace} node={topicSearchCard} />}
    </div>
  );
}

export const ToggleNotesButton = styled.div`
  position: fixed;
  top: 130px;
  right: 12px;
  z-index: 100000;
  border-radius: 3px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);
`;
