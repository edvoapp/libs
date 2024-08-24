import { useEffect, useState } from 'preact/hooks'; // Approved
// import 'react-resizable/css/styles.css';
import { useObserveValue } from '@edvoapp/util';
import {
  ActionButton,
  CartoonGhost,
  GhostIcon,
  GlobeIconBold,
  MiniMap,
  SearchIconBold,
  TopicSpaceAvatars,
  UpArrowFromLine,
  UploadActionButton,
  ViewportCrosshairs,
  VM,
} from '../..';

// for some reason importing from node modules isn't working
// import './resizable-styles.scss';
import { ContentCard } from './topic-content-card';
import { ShareTray } from './share-tray';
import { MemberCard } from './member';
import './topic-space.scss';
import { Cursors } from './UserCursor';
import styled from 'styled-components';
import { ZoomState } from '../../components/topic-space/zoom-state';

// This is the bit that can be nested in other stuff (including the topic space PAGE itself)

interface Props {
  node: VM.TopicSpace;
}

const ShareWrapper = styled.div`
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 100000;
  display: flex;
`;

export const TopicSpaceComponent = ({ node }: Props) => {
  const members = useObserveValue(() => node.members, [node]);

  // May need to dynamically calculate this in the future if memory or performance become a problem
  // for now just hardcode it
  const planeDims = {
    top: -10000,
    left: -10000,
    height: 20000,
    width: 20000,
  };

  const planeOffsets = { x: planeDims.top * -1, y: planeDims.left * -1 };

  const contentCard = useObserveValue(() => node.contentCard, [node]);
  const userPresence = useObserveValue(() => node.userPresence, [node]);

  return (
    <div className="topic-space__container" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <div className="topic-space-root">
        {userPresence && (
          <Cursors
            {...{
              userPresence,
            }}
          />
        )}

        <ShareWrapper>
          {userPresence && <TopicSpaceAvatars node={userPresence} />}
          <ShareTray node={node.shareTray} />
        </ShareWrapper>
        <TopicSpacePlane node={node} />
        <ViewportCrosshairs {...{ planeOffsets, node }} />
        {/*<ViewportHalo {...{ planeOffsets, node }} />*/}

        {/* Cards are portaled to the body. Just rendering them here for ease*/}
        {contentCard && <ContentCard node={contentCard} />}
        {members.map((member) => (
          <MemberCard key={member.backref.id} node={member} />
        ))}
      </div>
      <ZoomState node={node.zoomState} />
      <MiniMap members={members} singles={contentCard ? [contentCard] : []} node={node} />
    </div>
  );
};

const TopicSpacePlane = ({ node }: { node: VM.TopicSpace }) => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void node.members.load().then(() => setLoading(false));
  }, [node]);
  const members = useObserveValue(() => node.members, [node]);
  const contentCard = useObserveValue(() => node.contentCard, [node]);

  return (
    <div className="topic-space-plane">
      {members.length === 0 && !contentCard && (
        <div
          className="topic-space__no-members w-full h-full flex items-center justify-center"
          data-test="empty-state-page"
        >
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-6">
              <CartoonGhost />
              <div className="flex flex-col">
                <span className="text-xl font-bold text-[#71717A]">
                  {loading ? 'Loading...' : 'Looks like this Space is empty.'}
                </span>
                <span className="text-xl text-[#71717A]">
                  {loading ? 'Hang tight while we grab your stuff.' : 'Start by bringing your tabs or files here.'}
                </span>
              </div>
            </div>
            {!loading && (
              <div className="flex justify-center items-center w-full gap-3">
                <ActionButton node={node.organizeTabsButton} width="200px">
                  <GlobeIconBold height={24} width={24} fill={'#18181B'} />{' '}
                  <div className="flex justify-between items-center w-full">
                    <span>Organize Tabs</span>{' '}
                    <div className="p-0.5 bg-[#18181B]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
                      <span>⌘B</span>
                    </div>
                  </div>
                </ActionButton>

                <UploadActionButton node={node.uploadFilesButton} width="200px" />

                <ActionButton node={node.searchButton} width="200px">
                  <SearchIconBold height={24} width={24} fill={'#18181B'} />{' '}
                  <div className="flex justify-between items-center w-full">
                    <span>Add from your Edvo</span>{' '}
                    <div className="p-0.5 bg-[#18181B]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
                      <span>⌘K</span>
                    </div>
                  </div>
                </ActionButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/// \/ These are the backrefs that we want to set the recipientIDs on
// const members = useObserveList(
//   () => vertex.filterBackrefs(['member-of']),
//   [vertex],
// );

// Requirements for this working:
// 1. implement mapObs for ObservableList which returns a derivative ObservableList which is in this case sorted
// 2.
// const members: ObservableList<Node> = useObserveList(() => {
//   const unsortedObsList: ObservableList<Node> =
//     viewNode.getChildren('members');
//   const sortedObsList: ObservableList<Node> =
//     unsortedObsList.filterMapObs((m) => {
//       m.sort((a, b) => a.seq - b.seq);
//     });
//   return sortedObsList;
// }, [viewNode]);

// const backrefs = useComputed(() => {
//   return members.read
//     .map((backref) => ({
//       backref,
//       // Create seq property to only read once
//       seq: backref.seq.read,
//     }))
//     .sort((a, b) => a.seq - b.seq)
//     .map(({ backref }) => backref);
// }, [members]);

// const displayableContent = useObserveValue(
//   () => vertex.filterProperties(['urlReference', 'body']).want().firstObs(),
//   [vertex],
// );
