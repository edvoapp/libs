// import { useDestroyMemo, useObservableList, useObservableValue } from '@edvoapp/util';
// import cx from 'classnames';
// import { Fragment, FunctionComponent } from 'preact';
// import {} from 'preact/hooks';
// import './styles.scss';
// import { HighlightManager } from '../../service/highlight-manager';
// import { WhitespaceManager, WhitespaceReservation } from '../../service/whitespace-manager';
// import { Highlight, HighlightPositionInfo } from '@edvoapp/common';
// import { MarginNoteSet } from '../viewer';

// interface HighlightNotesProps {
//   highlightManager: HighlightManager;
//   whitespaceManager: WhitespaceManager;
// }
// interface HighlightNoteProps {
//   highlight: Highlight<any>;
//   positionInfo: HighlightPositionInfo;
//   whitespaceManager: WhitespaceManager;
//   highlightManager: HighlightManager;
// }

// export const MarginNoteRenderer: FunctionComponent<HighlightNoteProps> = ({
//   highlight,
//   positionInfo,
//   highlightManager,
//   whitespaceManager,
// }) => {
//   // If we're here, the highlight is saved, and there's highlight position info

//   // TODO - figure out how to un-register in future cases where highlights can be removed
//   // TODO: this will eventually become an Obesrvable<WhitespaceReservation>
//   const reservedRect = useDestroyMemo<WhitespaceReservation>(
//     () =>
//       whitespaceManager.reserve({
//         height: 100,
//         top: positionInfo.boundingRect.bottom - 100,
//       }),
//     [positionInfo],
//   );
//   const focusedHighlight = useObservableValue(highlightManager.focusedHighlight);
//   const isFocusedHighlight = focusedHighlight === highlight;

//   const style = {
//     left: reservedRect.rect.left,
//     bottom: reservedRect.rect.bottom,
//     maxWidth: reservedRect.rect.width,
//   };

//   const lineStyle = {
//     left: positionInfo.boundingRect.left,
//     top: positionInfo.boundingRect.bottom,
//     width: positionInfo.boundingRect.width + reservedRect.rect.width,
//   };

//   const component = <MarginNoteSet entity={highlight.vertex.peek_or_throw('highlight should have an vertex')} />;

//   return (
//     <div
//       className={cx('highlight_note_container', {
//         inactive: isFocusedHighlight,
//         active: !isFocusedHighlight,
//       })}
//       onClick={() => highlightManager.focusHighlight(highlight)}
//     >
//       <div className={cx('highlight_note', `center-of-gravity-right`)} style={style}>
//         {component}
//       </div>
//       <div
//         className={cx('highlight_note__underline')}
//         style={{
//           backgroundColor: '#FFD12D',
//           height: 2,
//           ...lineStyle,
//         }}
//       />
//     </div>
//   );
// };

// export const MarginNotes: FunctionComponent<HighlightNotesProps> = ({ highlightManager, whitespaceManager }) => {
//   useObservableList(highlightManager.highlights);

//   return (
//     <Fragment>
//       {highlightManager.highlights.map((highlight) => {
//         const positionInfo = highlight.positionInfo.getValue();
//         if (highlight.isSaved() && positionInfo) {
//           return (
//             <MarginNoteRenderer
//               key={highlight.key}
//               highlight={highlight}
//               whitespaceManager={whitespaceManager}
//               highlightManager={highlightManager}
//               positionInfo={positionInfo}
//             />
//           );
//         } else {
//           return null;
//         }
//       })}
//     </Fragment>
//   );
// };
