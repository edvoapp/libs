import styled, { css } from 'styled-components';
import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../../viewmodel';
import './toolbar-panel.scss';
import { TopicItem } from '../../topic/member-body/topic-item';
import { createPortal } from 'preact/compat';

interface Props {
  node: VM.FavoritesPanel;
}

export function FavoritesPanel({ node }: Props) {
  const items = useObserveValue(() => node.pinnedItems, [node]);

  return createPortal(
    <div
      className="toolbar-panel left-[72px] -translate-y-1/2 top-1/2 w-[320px] max-h-[75vh] bg-white/60 backdrop-blur p-3 absolute overflow-y-auto"
      ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
      style={{ zIndex: 100_000 }}
    >
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-[#71717A] uppercase leading-[170%]">
          Favorites ({items.length})
        </span>
        <ItemsList label="Favorites" items={items} />
      </div>
    </div>,
    document.body,
  );
}

const ItemsList = ({ label, items }: { label: string; items: VM.TopicItem[] }) => {
  return (
    <div className="flex flex-col bg-white toolbar-panel-list">
      {items.length ? items.map((node) => <TopicItem node={node} />) : <span className="no-list">No {label}</span>}
    </div>
  );
};
