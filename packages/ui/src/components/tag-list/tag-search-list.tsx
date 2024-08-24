import * as VM from '../../viewmodel';
import { useObserveValue } from '@edvoapp/util';
import { AttachedPanel } from '../attached-panel';
import { ItemsList } from '../search-panel/search-panel';

export const TagSearchList = ({ node }: { node: VM.TopicSearchList }) => {
  const visible = useObserveValue(() => node.visible, [node, node.visible]);
  const searchResults = useObserveValue(
    () => node.searchResultsPanel.searchItems,
    // FIXME: this doesn't belong here; compute in VM
    [node, node.searchResultsPanel, node.searchResultsPanel.searchItems],
  );
  const searchTerm = useObserveValue(
    () => node.searchResultsPanel.queryTextDebounced,
    // FIXME: this doesn't belong here; compute in VM
    [node, node.searchResultsPanel, node.searchResultsPanel.queryTextDebounced],
  );

  if (!visible) return null;
  return (
    <AttachedPanel node={node}>
      <div className="w-[400px] flex flex-col gap-1">
        {!searchTerm.length ? (
          <>
            <span className="text-xs font-semibold text-[#71717A] uppercase leading-[170%]">Recent</span>
            <ItemsList show="recents" node={node.searchResultsPanel} label="Recents" type="tag" />
          </>
        ) : (
          <>
            <span className="text-xs font-semibold text-[#71717A] uppercase leading-[170%]">
              Search results for "{searchTerm}" ({searchResults.length})
            </span>
            <ItemsList show="search" label="Search Results" node={node.searchResultsPanel} type="tag" />
          </>
        )}
      </div>
    </AttachedPanel>
  );
};
