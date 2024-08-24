import { Model } from '@edvoapp/common';
import { EdvoObj, OwnedProperty, WeakProperty } from '@edvoapp/util';
import { toast } from 'react-toastify';

import { ViewModelContext } from './context';
import { Node } from './view-model-node';

/**
 * A single `InnerVertex` can be accessed by multiple `Nodes`.
 */
export class ShareHelper extends EdvoObj {
  nodes: Set<Node> = new Set([]);
  @WeakProperty
  context: ViewModelContext;
  @OwnedProperty
  shareState: Model.Priv.VertexShareState;

  static new(vertex: Model.Vertex, context: ViewModelContext) {
    const me = new ShareHelper(vertex, context);
    me.init();
    return me;
  }
  private constructor(readonly vertex: Model.Vertex, context: ViewModelContext) {
    super();
    this.context = context;

    this.shareState = new Model.Priv.VertexShareState(vertex);

    this.onCleanup(
      this.shareState.subscribe((_share, _origin, ctx) => {
        if (_origin === 'USER') {
          // we don't need to reevaluate privs here - the VM Nodes do that on their own now
          // we just need to make sure that the whole tree is looked at to make sure privs are updated
          void (async () => {
            let toastId = toast(`Updating Access`, {
              type: toast.TYPE.INFO,
              autoClose: false,
              hideProgressBar: true,
              closeOnClick: false,
              draggable: false,
              position: toast.POSITION.BOTTOM_LEFT,
            });
            await Promise.all(
              [...this.nodes].map((n) =>
                n.walkTree(undefined, async (walk_node) => {
                  // TODO verify that privileges have been updated
                  // They SHOULD be updated immediately on load, but is that good enough?
                  console.log('Walking tree to ensure priv update', walk_node);
                }),
              ),
            );
            setTimeout(() => toast.dismiss(toastId), 500);
          })();
        }
      }),
    );
  }

  recurseLoad() {}

  init() {}

  protected cleanup() {
    this.context.shareHelperRegistry.remove(this.vertex.id);
    super.cleanup();
  }
  registerNode(node: Node) {
    this.nodes.add(node);
    node.onCleanup(() => {
      this.nodes.delete(node);
    });
  }
}
