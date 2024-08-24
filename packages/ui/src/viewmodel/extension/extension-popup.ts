import { ConditionalNode, Node, NodeCA } from '../base';
import { MemoizeOwned, Observable, OwnedProperty } from '@edvoapp/util';
import { Model, TrxRef, subTrxWrap, subTrxWrapSync, trxWrap, trxWrapSync } from '@edvoapp/common';
import { upsertVertex } from '../../behaviors';
import { TopicSearch } from '../topic-search';
import { AppExtension } from './app-extension';
import { AppDesktop } from '../app-desktop';
import { TagList } from '../tag-list';
import { raiseError } from '../../utils';
import { getCurrentTab } from '../../service/extension';
import { OpenEdvoButton } from './open-edvo-button';
import { DEFAULT_WEBCARD_DIMS } from '../../service';

interface CA extends NodeCA<ConditionalNode<ExtensionPopup, boolean, AppDesktop> | AppExtension> {}

export class ExtensionPopup extends Node<ConditionalNode<ExtensionPopup, boolean, AppDesktop> | AppExtension> {
  constructor(args: CA) {
    super(args);

    void this.checkIfInEdvo();
  }

  static new(args: CA) {
    const me = new ExtensionPopup(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['topicSearch', 'tagList', 'openEdvoButton'];
  }

  @OwnedProperty
  vertexObs = new Observable<Model.Vertex | null>(null);

  async checkIfInEdvo() {
    const currentTab = await getCurrentTab();
    const url = currentTab?.url;
    if (!url) return;
    const existingVertex = await Model.Vertex.findVertexByAttributes({
      parent: null,
      kind: 'resource',
      attributes: { url },
    });
    if (existingVertex) this.vertexObs.set(existingVertex);
  }

  @MemoizeOwned()
  get topicSearch(): TopicSearch {
    const ts = TopicSearch.new({
      parentNode: this,
      fitContentParent: null,
      emptyText: 'Add this page to a space',
      showRecents: true,
      listMaxHeight: 200,
      limitMaxWidthToSearchBoxWidth: true,
      handleBlur: () => {
        throw 'unimplemented - see PLM-2298';
        // ts.hideTopicSearchList();
      },
      onSelect: (targetVertex, trx) => {
        throw 'unimplemented - see PLM-2298';
        // ts.hideTopicSearchList();

        void subTrxWrap(trx, async (trx) => {
          targetVertex.touch(trx);
          let pageVertex = await this.vertexObs.get();
          if (!pageVertex) {
            const currentTab = await getCurrentTab();
            const url = currentTab?.url;
            const name = currentTab?.title;
            if (url && name) {
              pageVertex = await upsertVertex({ trx, url, name });
              this.vertexObs.set(pageVertex);
            }
          }
          if (!pageVertex) return raiseError('Unable to save page');
          pageVertex.createEdge({
            trx,
            role: ['tag', 'member-of'],
            target: targetVertex,
            meta: { ...DEFAULT_WEBCARD_DIMS, autoposition: true },
          });
        });
      },
    });
    return ts;
  }

  @MemoizeOwned()
  get tagList(): ConditionalNode<TagList, Model.Vertex | null, ExtensionPopup> {
    const precursor = this.vertexObs;
    return ConditionalNode.new<TagList, Model.Vertex | null, ExtensionPopup>({
      parentNode: this,
      precursor,
      factory: (vertex, parentNode) =>
        vertex &&
        TagList.new({
          parentNode,
          vertex,
          relationshipType: 'tag',
          label: 'NameTagFieldTagList',
          readonly: true,
          alwaysShowAddTagButton: false,
        }),
    });
  }

  @MemoizeOwned()
  get openEdvoButton() {
    return OpenEdvoButton.new({
      parentNode: this,
    });
  }
}
