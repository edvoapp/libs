import cx from 'classnames';

import { globalStore } from '@edvoapp/common';
import { useObserveList, useObserveValue, useObserveValueMaybe } from '@edvoapp/util';

import { VertexNode } from '../../viewmodel';
import { PinIcon, GlobeIcon, StickyNoteIcon, HighlighterIcon, MoreHorizontalIcon } from '../../assets';

import './topic-avatar.scss';

interface Props {
  viewNode: VertexNode;
}

/**
 * This component provides a compact visual representation of the identity and disposition of a given topic.
 *
 * Used for representing thumbnail image and type of a given topic Vertex in listings, headers, and such.
 *
 * Should not include name/title/tag information
 */
export const TopicAvatar = ({ viewNode }: Props) => {
  // TODO: Should this ONLY be drawn from a view node?
  const vertex = viewNode.vertex;
  if (!vertex) return null;

  const notes = useObserveValue(() => vertex.filterEdges(['category-item']), [vertex]);

  const userId = globalStore.getCurrentUserID();

  const property = useObserveValue(
    () =>
      vertex
        .filterProperties({
          role: ['pin'],
          contentType: 'application/json',
          userID: [userId],
        })
        .filterObs((p) => p.status.value === 'active')
        .firstObs(),
    [vertex],
  );

  const isPinned = useObserveValueMaybe(() => property?.text, [property?.text]);

  const hasNotes = notes.length > 0;
  const highlights = useObserveList(
    () =>
      globalStore.query('vertex', null, {
        where: [
          ['userID', '==', userId],
          ['parentVertexID', '==', vertex.id],
        ],
      }),
    [vertex],
  );
  const hasHighlights = highlights.length > 0;

  const avatar = [];

  const urlPart = useObserveValue(
    () => vertex.filterProperties({ role: ['body'], contentType: 'text/x-uri' }).firstObs(),
    [vertex],
  );
  const title = useObserveValue(
    () =>
      vertex
        .filterProperties({ role: ['titleReference'] })
        .firstObs()
        .mapObs<string | undefined>((t) => t?.text),
    [vertex],
  );
  const img = useObserveValue(
    () =>
      vertex
        .filterProperties({ role: ['imgReference'] })
        .firstObs()
        .mapObs<string | undefined>((t) => t?.text),
    [vertex],
  );

  const imgAltText = `${title || 'Untitled'}`;

  if (urlPart) {
    if (typeof img === 'undefined') {
      // not loaded
      // avatar.push(<Skeleton width={60} height={20} />);
      avatar.push(<StickyNoteIcon className="topic-avatar-default" />);
    } else if (img) {
      // got an image
      avatar.push(<img style={{ maxWidth: 36, maxHeight: 36 }} src={img} alt={imgAltText} />);
    } else {
      // no image
      avatar.push(<GlobeIcon height={36} width={36} alt={imgAltText} className="topic-avatar-default" />);
    }
  } else {
    avatar.push(<StickyNoteIcon className="topic-avatar-default" />);
  }

  return (
    <div className="topic-avatar">
      {isPinned && <PinIcon className="pin-icon" />}
      {avatar}
      {hasNotes && <MoreHorizontalIcon className={cx('topic-avatar-meta', 'topic-avatar-comments-icon')} />}
      {hasHighlights && <HighlighterIcon className={cx('topic-avatar-meta', 'topic-avatar-highlights-icon')} />}
    </div>
  );
};
