import { trxWrap, Model } from '@edvoapp/common';
import { EdvoObj, Observable, ObservableList, OwnedProperty } from '@edvoapp/util';
import { toast } from 'react-toastify';

interface StorageProvider {
  setStorageValue(key: string, value: any): Promise<void>;
  getStorageValue(key: string): Promise<any | null>;
}

type Args = {
  entity: Observable<Model.Vertex | null>;
  storage: StorageProvider;
};
export class ContextManager extends EdvoObj {
  initialized = false;
  @OwnedProperty
  currentEntity: Model.Vertex | null = null;
  @OwnedProperty
  currentVisit: Model.Vertex | null = null;
  @OwnedProperty
  readonly entity: Observable<Model.Vertex | null>;
  readonly storage: StorageProvider;

  constructor(args: Args) {
    super();
    this.entity = args.entity;
    this.storage = args.storage;

    args.entity.subscribe(() => {
      // change the current entity when the entity awaitable changes
      this.currentEntity = args.entity.value;
      this.logVisit();
    }, true);

    this.init();
  }

  init() {
    this.initialized = true;
    // const currentQuestIds = ((await this.storage.getStorageValue(
    //   'currentQuestIds',
    // )) || []) as string[]
    // this.activeQuests.replaceAll(
    //   currentQuestIds.map((id) => Quest.getById({ id })),
    // )
  }

  logVisit() {
    if (!this.currentEntity) return;

    void trxWrap(async (trx) => {
      // needed to make the TS gods happy -.-
      if (!this.currentEntity) return;
      const visit: Model.Vertex = this.currentVisit || Model.Vertex.create({ trx });
      if (!this.currentVisit) {
        visit.createEdge({
          trx,
          target: this.currentEntity,
          role: ['visit-target'],
          meta: {},
        });
        this.currentVisit = visit;
      }
    }, 'visit');
  }
}
