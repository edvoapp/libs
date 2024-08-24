import { Button, VM } from '../..';
import { useEffect } from 'preact/hooks';
import { Outline } from '../../components/topic/topic-outline-items-renderer';
import { CloseIcon } from '../../components/icons';
import styled from 'styled-components';
import { useObserveValue } from '@edvoapp/util';

type Props = {
  node: VM.TSSidebar;
};

const TSOutline = styled.div`
  border-radius: 3px;
  background: #fff;
  backdrop-filter: blur(64px);
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
  border: 1px #eee solid;
  position: fixed;
  display: flex;
  align-items: stretch;
  flex-direction: column;

  overflow-y: auto;
  overflow-x: hidden;
`;

export const TopicSpaceSidebar = ({ node }: Props) => {
  useEffect(() => {
    return node.clientRectObs.subscribe((rect) => {
      let el = node.domElement;
      if (el) {
        el.style.top = `${rect.top}px`;
        el.style.left = `${rect.left}px`;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
      }
    });
  }, [node]);
  useEffect(() => {
    return node.zIndex.subscribe((zIndex) => {
      node.domElement?.style.setProperty('z-index', zIndex.toString());
    }, true);
  }, [node]);

  const visible = useObserveValue(() => node.visible, [node]);

  if (!node.alive || !visible) return null;
  const zIndex = node.zIndex.value;
  // Updates are done directly on the DOM element
  const rect = node.clientRectObs.value;

  return (
    <TSOutline
      ref={(r: HTMLDivElement | null) => {
        node.safeBindDomElement(r);
      }}
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex,
      }}
    >
      <div className="flex p-2 w-full justify-end">
        <Button node={node.closeButton} toolTip="Close">
          <CloseIcon />
        </Button>
      </div>
      <Outline node={node.outline} />
    </TSOutline>
  );
};
