import { Model, Search, TrxRef, globalStore } from '@edvoapp/common';
import { Node, VertexNode, VertexNodeCA } from './base';
import { MemoizeOwned, Observable } from '@edvoapp/util';
import { PropertyConfig, TextField } from './text-field';
import equals from 'fast-deep-equal';

interface CA extends VertexNodeCA {
  parentNode: Node;
  readonly?: boolean;
}

// TODO: does this really buy us much? It may make sense for us to create a helper function that creates a new TextField node,
// instead of having an explicit name VM node
export class Name extends VertexNode {
  readonly: boolean;

  constructor({ readonly = false, ...args }: CA) {
    super(args);
    this.readonly = readonly;
  }

  static new(args: CA) {
    const me = new Name(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['textField'];
  }

  @MemoizeOwned()
  get textField() {
    const vertex = this.vertex;
    return TextField.singleString({
      propertyConfig: PropertyConfig.fromVertex({
        vertex,
        role: ['name'],
        contentType: 'text/plain',
        onBeforeSaveString: (trx, text) => {
          Name.updateKeyword(vertex, text, trx);
        },
        visibleUserIDsForDescendants: this.visibleUserIDsForDescendants,
      }),
      parentNode: this,
      fitContentParent: this.parentNode,
      emptyText: 'Enter a name',
      readonly: new Observable(this.readonly),
      allowHover: this.allowHover,
      cursor: this.cursor,
    });
  }

  @MemoizeOwned()
  get text() {
    return this.textField.propertyConfig!.obs.mapObs((p) => p?.text);
  }

  // TODO: remove this once we run the migration and write queries
  static updateKeyword(vertex: Model.Vertex, text: string, trx: TrxRef) {
    // this is kind of a hack...
    const currentUserID = globalStore.getCurrentUserID();
    const userID = vertex.userID.value;
    // only let the trx get created if this person owns the vertex
    if (!userID || !currentUserID || userID !== currentUserID) return;
    // debugger;
    const oldKeywords = vertex.hydratedKeywords;
    const keywords = Search.stringToTokens(text);
    if (equals(oldKeywords, keywords)) return;
    const isTopic = keywords.length > 0;
    const dataToSet = {
      isTopic,
      keywords,
    };

    trx.update(vertex, dataToSet);
    Model.TimelineEvent.create({
      trx,
      parent: vertex,
      eventType: 'renamed',
    });
  }
}
