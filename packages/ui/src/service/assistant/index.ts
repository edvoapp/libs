import { Model } from '@edvoapp/common';
import { EdvoObj } from '@edvoapp/util';

export * from './manager';

export interface Agent extends EdvoObj {
  getInstance: (conversationVertex: Model.Vertex) => AgentInstance;
  user: Model.Vertex;
}

export interface AgentInstance extends EdvoObj {
  agent: Agent;
}
