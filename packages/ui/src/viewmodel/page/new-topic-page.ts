import { ChildNode, ChildNodeCA, ListNode, Node } from '../base';
import { Model, trxWrap } from '@edvoapp/common';
import { route } from 'preact-router';
import { MemoizeOwned, Observable, ObservableList, ObservableReader } from '@edvoapp/util';
import { MemberBody } from '../topic-space';
import * as Behaviors from '../../behaviors';
import { useNavigator } from '../../service';

interface CA extends ChildNodeCA<any> {
  type: string;
}

export class NewTopicPage extends ChildNode {
  type: string;
  constructor({ type, ...args }: CA) {
    super(args);
    this.type = type;
  }
  static new(args: CA) {
    const me = new NewTopicPage(args);
    me.init();
    return me;
  }

  async createNewTopic() {
    const currentUserVertexObs = this.context.authService.currentUserVertexObs;
    const user = await currentUserVertexObs.get();
    if (!user) return;
    const fullName = await user.getPlainTextPropValue('full-name');
    if (!fullName) return;

    const firstName = fullName.split(' ')[0];
    if (!firstName) return;

    const vertex = await trxWrap(async (trx) => Model.Vertex.create({ trx, name: `${firstName}'s First Space` }));
    const nav = useNavigator();
    nav.openTopic(vertex);
  }

  @MemoizeOwned()
  get dedupedVertices(): ObservableList<Model.Vertex> {
    return Model.TimelineEvent.dedupedEventVerticesListObs();
  }

  @MemoizeOwned()
  get mostRecentTopic(): ObservableReader<Model.Vertex | undefined | null> {
    return this.dedupedVertices.firstObs();
  }
}
