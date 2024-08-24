import { EdvoObj, Observable, ObservableList, OwnedProperty, WeakProperty } from '@edvoapp/util';
import { ViewModelContext, globalContext } from '../../viewmodel';
import { Model, trxWrap, trxWrapSync } from '@edvoapp/common';
import { Chat } from 'openai/resources';
import { ChatGPTAgent, getChatGPTApiKey } from './chatgpt';
import { get } from 'lodash';

let agentManager: AgentManger | undefined;
export function getAgentManager() {
  if (!agentManager) {
    agentManager = new AgentManger(globalContext());
  }
  return agentManager;
}

export class AgentManger extends EdvoObj {
  @WeakProperty
  context: ViewModelContext;

  // This will be a list of agents
  @OwnedProperty
  agents = new ObservableList<ChatGPTAgent>();
  constructor(context: ViewModelContext) {
    super();
    this.context = context;
    void this.initAgents();
  }
  async initAgents() {
    let openai_apikey = getChatGPTApiKey();
    if (!openai_apikey) return;

    // check to see if the user has a chatgpt agent vertex by checking the user's backrefs
    const user = await this.context.authService.currentUserVertexObs.awaitHasValue();

    let agentVertex = (await user.filterBackrefs({ role: ['chatgpt-agent'] }).toArray())[0]?.target;

    if (!agentVertex) {
      agentVertex = trxWrapSync((trx) => {
        const agent = Model.Vertex.create({ trx, kind: 'agent' });
        agent.createEdge({
          trx,
          target: user,
          role: ['agent', 'chatgpt-agent'],
          meta: {},
        });
        agent.createProperty({
          role: ['full-name'],
          trx,
          contentType: 'text/plain',
          initialString: 'Edvo Co-Pilot ✨', // TODO gather this on invite
        });
        return agent;
      });
    }
    this.agents.insert(new ChatGPTAgent(agentVertex, openai_apikey, this.context));
  }
  get primaryAgent(): ChatGPTAgent | undefined {
    return this.agents.value?.[0];
  }
  findAgent(agentUser: Model.Vertex) {
    return this.agents.find((agent) => agent.user === agentUser);
  }
}

// export abstract class Agent extends EdvoObj {}
