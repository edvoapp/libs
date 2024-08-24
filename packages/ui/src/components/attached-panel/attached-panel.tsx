import styled from 'styled-components';
import * as VM from '../../viewmodel';
import { useObserveValue } from '@edvoapp/util';
import { createPortal } from 'preact/compat';
import { useMemo, useState } from 'preact/hooks';
import { usePopper } from 'react-popper';
import { JSX } from 'preact';

const AttachedPanelRoot = styled.div<{ maxHeight?: number; maxWidth?: number }>`
  display: flex;
  flex-direction: column;
  //flex-flow: row wrap;
  max-height: ${(props) => props.maxHeight ?? 400}px;
  max-width: ${(props) => props.maxWidth ?? 600}px;
  overflow: auto;
  padding: 12px;
  gap: 8px;
  // note: this is not really appropriate, because we should be managing z-index, but we want this to appear above everything else
  z-index: 9999999;
  /* Color/Tooltip/BG80 */

  background: rgba(255, 255, 255, 0.6);

  /* Radial Menu/Global Effect
  
  Combined effects for radial menu
  */
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(17, 24, 39, 0.1);
  backdrop-filter: blur(8px);

  /* Note: backdrop-filter has minimal browser support */
  border-radius: 5px;
`;
export const AttachedPanel = ({
  node,
  children,
}: {
  node: VM.AttachedPanel;
  children: JSX.Element | null | undefined | false;
}) => {
  const maxHeight = node.maxHeight;
  const maxWidth = node.maxWidth;
  const parentRect = useObserveValue(() => node.parentRect, [node]);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);

  const virtualReference = useMemo(
    () => ({
      getBoundingClientRect() {
        if (!parentRect) return new DOMRect(); // realistically this codepath wouldn't matter because this component wont render anyway
        const { x, y, right, bottom } = parentRect;
        return new DOMRect(x, bottom);
      },
    }),
    [parentRect],
  );

  const { styles, attributes } = usePopper(virtualReference, popperElement, {
    placement: 'bottom-start',
  });

  const visible = useObserveValue(() => node.visible, [node]);
  if (!visible) return null;
  // using a portal so we don't have to deal with z-indexing issues
  return createPortal(
    <AttachedPanelRoot
      ref={(r: HTMLDivElement | null) => {
        node.safeBindDomElement(r);
        if (r && !popperElement) setPopperElement(r);
      }}
      maxHeight={maxHeight}
      maxWidth={maxWidth}
      style={{
        ...styles.popper,
      }}
      {...attributes.popper}
    >
      {children}
    </AttachedPanelRoot>,
    document.body,
  );
};
