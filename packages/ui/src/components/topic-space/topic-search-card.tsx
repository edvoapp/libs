import * as VM from '../../viewmodel';
import { useObserveValue } from '@edvoapp/util';
import { SearchIcon } from '../../assets';
import { TagSearchCaret } from '../tag-list';

type Props = {
  topicSpace: VM.TopicSpace;
  node: VM.TopicSearchCard;
};

export const TopicSearchCard = ({ node }: Props) => {
  const spaceCoords = useObserveValue(() => node.spaceCoords, [node]);

  const visible = useObserveValue(() => node.visible, [node]);
  if (!visible) return null;

  return (
    <div
      className="topic-search-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        left: spaceCoords.x,
        top: spaceCoords.y,
        // zIndex: ,
        color: '#DDF',
        background: 'none',
        position: 'fixed',
        // margin: '2px',
      }}
    >
      <SearchIcon />
      <div
        className="search-box"
        style={{
          flex: 1,
          margin: 4,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 8,
          padding: '0px 10px',
          background: 'white',
          color: '#555',
          position: 'relative',
        }}
      >
        <TagSearchCaret node={node.topicSearch} />
      </div>
    </div>
  );
};
