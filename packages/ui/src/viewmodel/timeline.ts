import { DB, Model, globalStore } from '@edvoapp/common';
import { asyncFilter, MemoizeOwned, Observable, ObservableList, OwnedProperty } from '@edvoapp/util';

import { ChildNode, ChildNodeCA, ListNode } from './base';

import { MyUniverse } from './page';
import { TimelineEvent } from './timeline-event';

export class Timeline extends ChildNode<MyUniverse> {
  lastEvent: DB.Timestamp | null = null;
  loadedRef = false;

  allEvents: Model.TimelineEvent[] = [];
  @OwnedProperty
  allFilteredEvents: ObservableList<Model.TimelineEvent> = new ObservableList<Model.TimelineEvent>([]);
  @OwnedProperty
  filterState = new Observable<EVENT_FILTER>(EVENT_FILTER.ALL);

  static new(args: ChildNodeCA<MyUniverse>) {
    const me = new Timeline(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['events'];
  }

  @MemoizeOwned()
  get events(): ListNode<Timeline, TimelineEvent, Model.TimelineEvent> {
    return ListNode.new<Timeline, TimelineEvent, Model.TimelineEvent>({
      parentNode: this,
      precursor: this.allFilteredEvents,
      iterateChildrenForwards: true,
      factory: (evt, parentNode) => {
        const vertex = evt.parent;
        return TimelineEvent.new({
          vertex,
          context: this.context,
          parentNode,
          raw: evt,
        });
      },
    });
  }

  setAllFilteredEvents(evts: Model.TimelineEvent[]) {
    this.allFilteredEvents.replaceAll(evts);
  }

  async loadMore(force?: boolean) {
    if (!(this.lastEvent || force)) return;
    const startAfter = this.lastEvent;
    this.lastEvent = null; // don't load unless forced signal
    const chunk = await loadEvents(startAfter, EVENT_LIMIT);
    this.allEvents.push(...chunk);
    if (chunk.length) {
      this.lastEvent = chunk[chunk.length - 1].eventDate;
    } else {
      this.lastEvent = null; // Stop loading more
    }
    this.loadedRef = true;
    this.setAllFilteredEvents(await getFilteredEvents(this.allEvents));
  }
}

export enum EVENT_FILTER {
  ALL = 'all',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

const MAX_TIME_BETWEEN_EVENTS = 3600;
const EVENT_LIMIT = 50;

const getFilteredEvents = async (
  allEvents: Model.TimelineEvent[],
  // startAfterEventDate: firebase.firestore.Timestamp | undefined,
  // startAfterClaimId: string | undefined,
) => {
  const eventMap = new Map<string, number>();
  // const startAfterSeconds = startAfterEventDate?.seconds;

  return await asyncFilter(allEvents, async (e: Model.TimelineEvent, arrI: number) => {
    const currentTime = globalStore.timestampToDate(e.eventDate).getSeconds();
    const claim = e.parent;
    const claimId = claim.id;

    // NOTE: This code might be useful if we want to filter the chunks one day
    // if (startAfterClaimId && startAfterSeconds && arrI === 0 && startAfterClaimId === claimId) {
    //   eventMap.set(claimId, currentTime);
    //   return currentTime - startAfterSeconds > maxTimeBetweenSameEvents ? true : false;
    // }

    // if (e.eventType === 'created') return true;

    if (eventMap.has(claimId)) {
      const precedingTime = eventMap.get(claimId);
      if (precedingTime && precedingTime - currentTime > MAX_TIME_BETWEEN_EVENTS) {
        eventMap.set(claimId, currentTime);
        return true;
      }
      return false;
    }
    eventMap.set(claimId, currentTime);
    return true;
  });
};

async function loadEvents(startAfter: DB.Timestamp | null, limit: number) {
  let query = Model.TimelineEvent.rawQuery({
    limit,
    where: [
      ['eventType', 'in', ['visited', 'created']],
      ['status', '==', 'active'],
    ],
    orderBy: ['eventDate', 'desc'],
  });

  if (startAfter) query = query.startAfter(startAfter);

  const querySnapshot = await query.get();

  const events = querySnapshot.docs.map((snapshot: any) => Model.TimelineEvent.hydrate({ snapshot }));

  return events;
}
