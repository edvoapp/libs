import { ConditionalNode, Node, VertexNode, VertexNodeCA } from '../base';
import { MemoizeOwned, Observable, ObservableReader, OwnedProperty } from '@edvoapp/util';
import { Outline } from '../outline/outline';
import { Member } from './member';

interface CA extends VertexNodeCA<ConditionalNode<Sidecar, any, Member>> {}

export class Sidecar extends VertexNode<ConditionalNode<Sidecar, any, Member>> {
  static new(args: CA) {
    const me = new Sidecar(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get visible() {
    return Observable.calculated(({ expanded, items, pristine }) => (pristine ? items.length > 0 : expanded), {
      expanded: this.parentNode.parentNode.sidecarExpanded,
      pristine: this.parentNode.parentNode.pristine,
      items: this.outlineBackrefs,
    });
  }

  get childProps(): (keyof this & string)[] {
    return ['outline'];
  }

  @MemoizeOwned()
  get outline() {
    return Outline.new({
      parentNode: this,
      context: this.context,
      vertex: this.vertex,
    });
  }
  @MemoizeOwned()
  get outlineBackrefs() {
    const itemRoles = ['category-item'];
    return (
      this.vertex
        .filterBackrefs({
          role: itemRoles,
          userID: this.parentNode?.visibleUserIDsForDescendants,
        })
        // TODO: Handle 0 and negative seq numbers
        .sortObs((a, b) => a.seq.value - b.seq.value)
    );
  }
}
