import { Model, trxWrap, trxWrapSync } from '@edvoapp/common';

import { Behavior, DEFAULT_PDF_DIMS, DispatchStatus, EventNav, useNavigator } from '../service';
import * as VM from '../viewmodel';
import { Position, isClosable } from '../viewmodel';
import { Upload } from './upload';
import { OwnedProperty } from '@edvoapp/util';

const imageTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'];

export class FileDrop extends Behavior {
  @OwnedProperty
  uploadHandler = new Upload();
  constructor() {
    super();
  }

  handleDragOver(eventNav: EventNav, e: DragEvent, node: VM.Node): DispatchStatus {
    const items = filterEligibleItems(e.dataTransfer?.items);
    if (items.length === 0) return 'continue';
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return 'stop';
  }
  handleDragEnter(eventNav: EventNav, e: DragEvent, node: VM.Node): DispatchStatus {
    const items = filterEligibleItems(e.dataTransfer?.items);
    if (items.length === 0) return 'continue';

    const target = e.target as HTMLElement;
    toggleDragEnterClass(target);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return 'stop';
  }
  handleDragLeave(eventNav: EventNav, e: DragEvent, node: VM.Node): DispatchStatus {
    const target = e.target as HTMLElement;
    toggleDragEnterClass(target);
    return 'stop';
  }
  handleDrop(eventNav: EventNav, e: DragEvent, node: VM.Node): DispatchStatus {
    this.trace(1, () => ['File(s) dropped', e]);
    const target = e.target as HTMLElement;
    toggleDragEnterClass(target);
    const space = node.closestInstance(VM.TopicSpace);
    if (!space) return 'decline';
    const position = space.clientCoordsToSpaceCoords({
      x: e.clientX,
      y: e.clientY,
    });
    return this.uploadFiles(e.dataTransfer?.items, node, position);
  }
  handleChange(eventNav: EventNav, e: Event, node: VM.Node): DispatchStatus {
    const desktop = node.closestInstance(VM.AppDesktop);
    // Handles the case where the origin node is a child of appdesktop but not of topicspace, i.e. toolbar
    const space = node.closestInstance(VM.TopicSpace) || desktop?.topicSpace.value?.topicSpace;
    // ||
    // desktop?.myUniverse.value?.topicSpace;

    // If we're uploading from the toolbar, we need to update the styles of the toolbar as this behavior will have priority over toolbar button.
    const toolbar = desktop?.toolbar;
    if (toolbar) {
      toolbar.pinnedItems.close();
      toolbar.tabsPanel.close();
      desktop.setSearchMode('hidden');
      desktop.quickAdding.set(false);
    }
    const targetEl = e.target as HTMLInputElement | null;
    // If we're opening file picker from home page, we need to create a new topic space and upload files there. Then navigate to that topic space.
    if (!space) {
      const files = targetEl?.files;
      if (!files) return 'decline';
      let x = 100;
      let y = 100;
      const target = trxWrapSync((trx) => Model.Vertex.create({ name: 'Untitled', trx }));
      void trxWrap(async (trx) => {
        for (const file of files) {
          if (!file) return;
          const vertex = await this.uploadHandler.uploadFile(trx, file);
          if (imageTypes.includes(file.type.toLowerCase())) {
            vertex.createProperty({
              trx,
              role: ['appearance'],
              contentType: 'application/json',
              initialString: JSON.stringify({ type: 'clean' }),
            });
          }
          vertex.createEdge({
            trx,
            role: ['member-of', 'tag'],
            target,
            meta: {
              x_coordinate: x,
              y_coordinate: y,
              ...DEFAULT_PDF_DIMS,
            },
          });
          x += 30;
          y += 30;
        }
      }).then(() => {
        // unset
        if (targetEl) targetEl.value = '';
        useNavigator().openTopic(target);
      });
      return 'stop';
    }
    const position = space.focusCoordinates.value ?? space.viewportState.value.center;
    const files = targetEl?.files;
    if (!files) return 'decline';
    const res = this.uploadFiles(files, space, position);
    if (targetEl) targetEl.value = '';
    return res;
  }
  handlePaste(eventNav: EventNav, e: ClipboardEvent, node: VM.Node): DispatchStatus {
    this.trace(1, () => ['File(s) pasted', e]);

    const focused = eventNav.focusState.currentFocus;
    const space = focused?.closestInstance(VM.TopicSpace);
    if (!space) return 'decline';
    const position = space.focusCoordinates.value ?? space.viewportState.value.center;
    return this.uploadFiles(e.clipboardData?.items, node, position);
  }

  private uploadFiles(items: DataTransferItemList | FileList | undefined, node: VM.Node, pos: Position) {
    const files = items instanceof FileList ? items : filterEligibleItems(items).map((i) => i.getAsFile());

    if (files.length === 0) return 'continue';

    let { x, y } = pos;
    if (!(node instanceof VM.VertexNode)) return 'continue';
    const { vertex: target } = node;

    void trxWrap(async (trx) => {
      for (const file of files) {
        if (!file) return;
        const vertex = await this.uploadHandler.uploadFile(trx, file);
        if (imageTypes.includes(file.type.toLowerCase())) {
          vertex.createProperty({
            trx,
            role: ['appearance'],
            contentType: 'application/json',
            initialString: JSON.stringify({ type: 'clean' }),
          });
        }
        vertex.createEdge({
          trx,
          role: ['member-of', 'tag'],
          target,
          meta: {
            x_coordinate: x,
            y_coordinate: y,
            ...DEFAULT_PDF_DIMS,
          },
        });
        x += 30;
        y += 30;
      }
    });
    return 'stop';
  }
}

function filterEligibleItems(list: DataTransferItemList | undefined) {
  if (!list) return [];
  const out: DataTransferItem[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];

    if (item.kind === 'file') {
      out.push(item);
    }
  }
  return out;
}

function toggleDragEnterClass(target: HTMLElement) {
  if (!target) return;
  if (target.classList.contains('drag-enter')) {
    return target.classList.remove('drag-enter');
  }
  target.classList.add('drag-enter');
}
