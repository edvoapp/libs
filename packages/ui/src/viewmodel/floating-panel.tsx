import { BoundingBox, ChildNode, ChildNodeCA, ConditionalNode, Node, Point, Position, globalContext } from './base';
import { MemoizeOwned, Observable, ObservableReader, useEdvoObj } from '@edvoapp/util';
import { useState, useEffect } from 'preact/hooks';
import { ComponentType } from 'preact';
import { Behavior, DispatchStatus, EventNav } from '../service';
import { AppDesktop } from './app-desktop';
import * as ButtonNode from './button';
import { Button } from '../components';
import { FunctionComponent, createPortal } from 'preact/compat';
import { MODAL_PANEL_Z } from '../constants';
import styled from 'styled-components';
import { CloseIcon } from '../assets';

export type PositionType = 'center';
export interface FloatingPanelCA<ParentNode extends Node> extends ChildNodeCA<ParentNode> {
  closable?: boolean;
  resizable?: boolean;
  onRequestClose?: () => void;
  position?: 'center';
  // could provide height and width and optional position this way, but it seems a little weird?
  // initialBoundingBox? : OverrideBoundingBox;
  // or:
  height?: number;
  width?: number;
  overlay?: boolean;
}

export abstract class FloatingPanel<ParentNode extends Node = Node> extends ChildNode<ParentNode> {
  overflow = true; // for the overlay
  hasDepthMask = true;
  onRequestClose?: () => void;
  position?: 'center';

  overlay: boolean;
  width?: number;
  height?: number;
  closable = true;

  constructor({ overlay, onRequestClose, position, ...args }: FloatingPanelCA<ParentNode>) {
    super(args);

    this.overlay = overlay ?? false;
    const root = globalContext().rootNode;
    if (root instanceof AppDesktop) {
      root.addFixedItem(this);
    }
    this.onRequestClose = onRequestClose;
    this.position = position;
  }
  // init() {
  //   // init centering logic
  //   if (this.position === 'center') {
  //   }
  // }

  close() {
    if (!this.closable) return;
    const root = globalContext().rootNode;
    if (root instanceof AppDesktop) {
      root.removeFixedItem(this);
    }

    // Give the parent (if any) the opportunity to remove its reference and cause this to be closed
    this.onRequestClose?.();
  }

  get childProps(): (keyof this & string)[] {
    return ['closeButton'];
  }

  @MemoizeOwned()
  get closeButton() {
    return ButtonNode.Button.new({
      parentNode: this,
      onClick: () => {
        this.close();
      },
    });
  }

  abstract panelInner: FunctionComponent<{ node: any }> | null;
  abstract header: FunctionComponent<{ node: any }> | null;

  get component() {
    return FloatingPanelComp;
  }
}

export function FloatingPanelComp({ node }: { node: FloatingPanel }) {
  useEdvoObj(() => node, [node]);

  const Inner = node.panelInner;
  const Header = node.header;

  return createPortal(
    <>
      {node.overlay && (
        <div
          className="overlay top-0 left-0 w-screen h-screen pointer-events-none bg-black/40 fixed"
          style={{ zIndex: MODAL_PANEL_Z[0] - 1 }}
        ></div>
      )}
      <FloatingPanelRoot
        className="floating-panel"
        ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}
        style={{
          width: node.width ?? '800px',
          height: node.height ?? '600px',
        }}
      >
        <div className="flex items-center px-6 py-4 w-full justify-between">
          {Header && <Header node={node} />}
          <Button node={node.closeButton} toolTip="Close">
            <CloseIcon />
          </Button>
        </div>
        <div className="horizontal-line h-px bg-[#E4E4E7] w-[750px] mb-6"></div>
        <div className="overflow-auto">{Inner && <Inner node={node} />}</div>
      </FloatingPanelRoot>
    </>,
    document.body,
  );
}

const FloatingPanelRoot = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: ${MODAL_PANEL_Z[0]};
  // width: 800px;
  // height: 560px;
  transform: translateX(-50%) translateY(-50%);

  display: flex;
  flex-direction: column;
  // justify-content: center;
  align-items: center;
  // font-size: 2rem;

  border-radius: 3px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: white;
  background-blend-mode: overlay, normal;

  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);
`;

// class EscKey extends Behavior {
//   handleKeyDown(
//     eventNav: EventNav,
//     e: KeyboardEvent,
//     originNode: Node,
//   ): DispatchStatus {
//     const panel = originNode.findClosest(
//       (n) => n instanceof FloatingPanel && n,
//     );
//     if (!panel) return 'decline';
//     const key = e.key.toLowerCase();
//     if (['escape', 'esc'].includes(key)) {
//       panel.hide();
//       return 'stop';
//     }
//     return 'decline';
//   }
// }
