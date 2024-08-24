import { config, DB, Model } from '@edvoapp/common';
import { MemoizeOwned, OwnedProperty } from '@edvoapp/util';

import { Node, VertexNode, VertexNodeCA } from './base';
import { route } from 'preact-router';
import { Behavior, DispatchStatus, EventNav } from '../service';
import { TopicItem } from './topic-space';

interface CA extends VertexNodeCA {
  raw: Model.TimelineEvent;
}

export class TimelineEvent extends VertexNode {
  overflow = true;
  @OwnedProperty
  raw: Model.TimelineEvent;
  allowHover = true;
  static new(args: CA) {
    const me = new TimelineEvent(args);
    me.init();
    return me;
  }

  constructor({ raw, ...args }: CA) {
    super(args);
    this.raw = raw;
  }

  get cursor() {
    return 'pointer';
  }

  getHeritableBehaviors(): Behavior[] {
    return [new Click()];
  }

  get childProps(): (keyof this & string)[] {
    return ['topicItem'];
  }
  get eventDate(): DB.Timestamp {
    return this.raw.eventDate;
  }

  @MemoizeOwned()
  get topicItem() {
    return TopicItem.new({
      parentNode: this,
      vertex: this.vertex,
      context: this.context,
    });
  }

  goToTopic() {
    const vertex = this.vertex;
    const status = vertex.status.value;
    if (status === 'archived') return;
    const topicID = vertex.id;
    // navigator.track({ category: 'Timeline', action: 'Go to Topic' });
    const centerMemberId = config.hardCodedFocusMembers[topicID];
    const url = centerMemberId ? `/topic/${topicID}?centerMemberId=${centerMemberId}` : `/topic/${topicID}`;
    route(url);
    this.context.setRoute({
      path: ['topic', topicID],
      params: {},
    });
  }
}

export class Click extends Behavior {
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: Node): DispatchStatus {
    const closestEvt = originNode.findClosest((n) => n instanceof TimelineEvent && n);
    if (!closestEvt) return 'decline';
    closestEvt.goToTopic();
    return 'stop';
  }
}
