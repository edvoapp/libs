import { MemoizeOwned, Observable, ObservableReader } from '@edvoapp/util';
import { ConditionalNode, VertexNode, VertexNodeCA } from '../base';
import { Model, globalStore } from '@edvoapp/common';
import { ContextMenuButton } from '.';
import { TSPage } from '../page';
import { DEPTH_MASK_Z } from '../../constants';
import { CloneContext } from '../../utils';
import { NameTagField } from '../name-tag-field';
import { FileIcon } from '../file-icon';

interface CA extends VertexNodeCA<TSPage> {
  vertex: Model.Vertex;
}

export class TopicSpaceTitle extends VertexNode<TSPage> {
  // readonly name = 'topic-space-title';
  hasDepthMask = true;
  _depthMaskZ = DEPTH_MASK_Z;
  zIndexed = true;
  allowHover = true;

  constructor({ ...args }: CA) {
    super(args);
  }

  static new(args: CA) {
    const me = new TopicSpaceTitle(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['nameTagField', 'icon', 'contextMenuButton'];
  }

  @MemoizeOwned()
  get visible() {
    return new Observable(true);
  }

  @MemoizeOwned()
  get nameTagField(): NameTagField {
    const isUniverse = this.parentNode?.label === 'my-universe';
    return NameTagField.new({
      parentNode: this,
      vertex: this.vertex,
      nameReadonly: isUniverse,
      allowHover: false,
      cursor: this.cursor,
      alwaysShowAddTagButton: true,
      disableAddTag: false,
      showTooltip: true,
    });
  }

  @MemoizeOwned()
  get bodyProperty() {
    return this.vertex
      .filterProperties({
        role: ['urlReference', 'body'],
        userID: this.parentNode.visibleUserIDsForDescendants,
      })
      .chooseObs((list) => list.find((i) => i.contentType !== 'text/x-embed-uri'), []);
  }

  @MemoizeOwned()
  get icon(): FileIcon {
    const faviconProperty = this.vertex
      .filterProperties({
        role: ['favicon'],
        userID: this.parentNode.visibleUserIDsForDescendants,
      })
      .firstObs();

    const fileExtensionProperty = this.vertex
      .filterProperties({
        role: ['file-extension'],
        contentType: 'text/x-file-extension',
        userID: this.parentNode.visibleUserIDsForDescendants,
      })
      .firstObs();
    return FileIcon.new({
      parentNode: this,
      property: this.bodyProperty,
      fileExtensionProperty,
      faviconProperty,
      cursor: this.cursor,
    });
  }

  @MemoizeOwned()
  get pinProperty(): ObservableReader<Model.Property | null | undefined> {
    return this.vertex
      .filterProperties({
        role: ['pin'],
        contentType: 'application/json',
        userID: [globalStore.getCurrentUserID()],
      })
      .filterObs((p) => p.status.value === 'active')
      .firstObs();
  }

  @MemoizeOwned()
  get contextMenuButton(): ConditionalNode<ContextMenuButton, boolean> {
    const precursor = this.hover.mapObs(Boolean);
    return ConditionalNode.new<ContextMenuButton, boolean>({
      parentNode: this,
      precursor,
      factory: (want, parentNode) =>
        want
          ? ContextMenuButton.new({
              parentNode,
            })
          : null,
    });
  }

  /**
   * overwriting VMNode.shallowClone because we want to ensure we traverse this node's tree, and TopicSpaceTitle is not a VertexNode.
   */
  shallowClone(targetParentVertex: Model.Vertex, cloneContext: CloneContext): Promise<Model.Vertex | null> {
    return Promise.resolve(targetParentVertex);
  }
}
