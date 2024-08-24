import styled from 'styled-components';
import { RoutableProps } from 'preact-router';
import { capitalize, useObserveValue } from '@edvoapp/util';
import { GlobeIconBold, PlusBoldIcon, SearchIconBold, ShareIcon } from '../../assets';
import * as VM from '../../viewmodel';
import { ActionButton, UploadActionButton, UserAvatar } from '../../components';
import { HomePageList } from '../../components/home-page';
import { ReactNode } from '../../react';

const Root = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  padding: 24px;
  gap: 24px;
  zindex: 200000;
`;

interface HomePageProps extends RoutableProps {
  node: VM.HomePage;
}

export const HomePage = ({ node }: HomePageProps) => {
  // Hack - seems like we might be routing to / and then immediately elsewhere
  if (!node.alive) return null;

  const firstName = useObserveValue(
    () =>
      node.context.authService.currentUserVertexObs.mapObs<string | undefined>((user) =>
        user
          ?.filterProperties({ role: ['full-name'] })
          .firstObs()
          .mapObs<string | undefined>((x) => {
            // Split the full name by spaces and take the first element as the first name
            const firstName = x?.text.value?.split(' ')[0];
            return firstName;
          }),
      ),
    [node],
  );

  const visible = useObserveValue(() => node.visible, [node]);
  const listMode = useObserveValue(() => node.listMode, [node]);

  if (!visible) return null;

  return (
    <Root ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
      <section className="title flex items-center gap-2">
        <UserAvatar node={node.avatar} />
        <h1 className="text-2xl">
          <span className="font-semibold">Hi {firstName && capitalize(firstName)}, </span>
          jump back in!
        </h1>
      </section>
      <section className="action-button-section flex gap-3 w-full">
        <ActionButton node={node.createSpaceButton}>
          <PlusBoldIcon height={24} width={24} fill={'#18181B'} />{' '}
          <div className="flex justify-between items-center w-full">
            <span>Create Space</span>{' '}
            <div className="p-0.5 bg-[#18181B]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
              <span>⌘L</span>
            </div>
          </div>
        </ActionButton>
        <ActionButton node={node.organizeTabsButton}>
          <GlobeIconBold height={24} width={24} fill={'#18181B'} />{' '}
          <div className="flex justify-between items-center w-full">
            <span>Organize Tabs</span>{' '}
            <div className="p-0.5 bg-[#18181B]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
              <span>⌘B</span>
            </div>
          </div>
        </ActionButton>
        <UploadActionButton node={node.uploadFilesButton} />
        <ActionButton node={node.shareButton}>
          <ShareIcon height={24} width={24} fill={'#18181B'} />{' '}
          <div className="flex justify-between items-center w-full">
            <span>Share</span>{' '}
            <div className="p-0.5 bg-[#18181B]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
              <span>⌘E</span>
            </div>
          </div>
        </ActionButton>
        <ActionButton node={node.searchButton}>
          <SearchIconBold height={24} width={24} fill={'#18181B'} />{' '}
          <div className="flex justify-between items-center w-full">
            <span>Search</span>{' '}
            <div className="p-0.5 bg-[#18181B]/60 text-xs leading-3 font-semibold text-white flex items-center justify-center rounded-[3px]">
              <span>⌘K</span>
            </div>
          </div>
        </ActionButton>
      </section>
      <section className="list-section w-full mt-2 flex flex-col gap-6">
        <div className="flex gap-6 items-baseline">
          <ListMenuButton node={node.recentsButton} listMode={listMode} mode="recents">
            Recents
          </ListMenuButton>
          <ListMenuButton node={node.favoritesButton} listMode={listMode} mode="favorites">
            Favorites
          </ListMenuButton>
          <ListMenuButton node={node.sharedButton} listMode={listMode} mode="shared">
            Shared with me
          </ListMenuButton>

          {/* TODO: add get inspired section */}
          {/* <button className="text-[#A1A1AA]">Get inspired</button> */}
        </div>
        <div className="recents-list flex flex-col w-full">
          <div className="flex w-full text-xs p-3 border-b border-[#E4E4E7]">
            <div className="w-1/2">
              <span>Name</span>
            </div>
            <div className="w-1/2">
              <span>{listMode === 'shared' ? 'Shared' : 'Last visited'}</span>
            </div>
          </div>
          <HomePageList node={node.homePageList} />
        </div>
      </section>
    </Root>
  );
};

export const ListMenuButton: React.FC<{
  node: VM.Button<any>;
  listMode: 'shared' | 'recents' | 'favorites';
  children: ReactNode;
  mode: 'shared' | 'recents' | 'favorites';
}> = ({ node, listMode, children, mode }) => {
  return (
    <div
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      className={`py-3 ${
        listMode === mode ? 'border-b-2 border-[#5D34D7] font-semibold text-[#18181B]' : 'font-normal text-[#A1A1AA]'
      } text-base`}
    >
      {children}
    </div>
  );
};
