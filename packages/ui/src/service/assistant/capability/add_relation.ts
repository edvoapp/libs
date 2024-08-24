import { Model, trxWrapSync, trxWrap } from '@edvoapp/common';
import { AgentCapability, Position } from '.';
import { Behaviors } from '../../..';
import { TopicSpace, ViewModelContext } from '../../../viewmodel';
import { WeakProperty } from '@edvoapp/util';
import { JSONSchema } from 'openai/lib/jsonschema';

interface Request {
  origin_id: string;
  target_id: string;
  type: 'arrow' | 'blobby';
  reasoning: string;
}
interface Response {
  status: 'success' | 'failure';
  error?: string;
  edge_id?: string;
}

const schema: JSONSchema = {
  type: 'object',
  properties: {
    origin_id: { type: 'string', description: 'vertex id of the origin' },
    target_id: { type: 'string', description: 'vertex id of the target' },
    type: { type: 'string', enum: ['arrow', 'blobby'] },
    reasoning: { type: 'string' },
  },
  required: ['origin', 'target', 'type', 'reasoning'],
  additionalProperties: false,
};
export const typeMap = {
  arrow: 'arrow',
  blobby: 'implicit',
};

export class AddRelation extends AgentCapability<Request, Response> {
  name = 'addRelation';
  description = 'add a new relation between two vertices';
  schema = schema;
  call(spec: Request): Response {
    const { origin_id, target_id, type, reasoning: reason } = spec;

    // Not working
    // let origin = await Model.Vertex.fetchByIdPrefix(origin_id);
    let origin = Model.Vertex.getById({ id: origin_id });
    if (!origin) {
      return { status: 'failure', error: 'invalid origin_id' };
    }
    // let target = await Model.Vertex.fetchByIdPrefix(target_id);
    let target = Model.Vertex.getById({ id: target_id });
    if (!target) {
      return { status: 'failure', error: 'invalid target_id' };
    }

    let newEdge = trxWrapSync((trx) =>
      origin.createEdge({
        trx,
        role: [typeMap[type]],
        target: target,
        meta: { reason },
      }),
    );

    return { status: 'success', edge_id: newEdge.id };
  }
}
