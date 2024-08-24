import { Model, trxWrap } from '@edvoapp/common';
import { AgentCapability, Position } from '.';
import { Behaviors } from '../../..';
import { TopicSpace, ViewModelContext } from '../../../viewmodel';
import { sleep, WeakProperty } from '@edvoapp/util';
import { JSONSchema } from 'openai/lib/jsonschema';
import { typeMap } from './add_relation';

interface Relation {
  id: string;
  type: 'arrow' | 'blobby';
  reasoning: string;
}
interface Request {
  position: Position;
  content: string;
  relations: Relation[];
}
interface Response {
  status: 'success' | 'failure';
  vertex_id: string;
}

const schema: JSONSchema = {
  type: 'object',
  properties: {
    position: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        height: { type: 'number' },
        width: { type: 'number' },
      },
      required: ['x', 'y', 'height', 'width'],
    },
    content: { type: 'string' },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['arrow', 'blobby'] },
          reasoning: { type: 'string' },
        },
        required: ['id', 'type', 'reason'],
      },
    },
  },
  required: ['position', 'content', 'relations'],
  additionalProperties: false,
};

export class AddSticky extends AgentCapability<Request, Response> {
  name = 'addSticky';
  description = 'add a new stickynote member';
  schema = schema;
  async call(spec: Request): Promise<Response> {
    const { position, content, relations } = spec;
    const { x, y, height, width } = position;

    let newVertex = await trxWrap(async (trx) => {
      const newVertex = Model.Vertex.create({ trx });
      const role = ['member-of'];
      newVertex.createProperty({
        trx,
        role: ['body'],
        contentType: 'text/plain',
        initialString: content,
      });
      await newVertex.setJsonPropValues<Behaviors.MemberAppearance>(
        'appearance',
        {
          color: '#ffffff',
          textColor: '#000000',
          type: 'stickynote',
        },
        trx,
      );

      newVertex.createEdge({
        trx,
        role,
        target: this.currentTopicSpace()!.vertex,
        meta: { x_coordinate: x, y_coordinate: y, height, width },
      });

      relations.forEach((relation) => {
        const { id, type, reasoning: reason } = relation;
        const target = Model.Vertex.getById({ id });
        if (target) {
          newVertex.createEdge({
            trx,
            role: [typeMap[type]],
            target,
            meta: { reason },
          });
        }
      });

      return newVertex;
    });

    return { status: 'success', vertex_id: newVertex.id };
  }
}
