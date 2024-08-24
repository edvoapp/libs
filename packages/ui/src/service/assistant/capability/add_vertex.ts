import { Model, trxWrap } from '@edvoapp/common';
import { AgentCapability, Position } from '.';
import { Behaviors } from '../../..';
import { TopicSpace, ViewModelContext } from '../../../viewmodel';
import { WeakProperty } from '@edvoapp/util';

interface Request {
  name: string;
  position: Position;
  content: Content;
}
interface Response {
  status: 'success' | 'failure';
  id: string;
}

interface Content {
  contentType: string;
  content: string;
}

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    id: { type: 'string' },
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
    content: {
      type: 'object',
      properties: {
        contentType: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['contentType', 'content'],
    },
  },
  required: ['id', 'position', 'content'],
  additionalProperties: false,
};

export class AddVertex extends AgentCapability<Request, Response> {
  name = 'addCard';
  description = 'add a new member to this space';
  schema = schema;
  async call(spec: Request): Promise<Response> {
    console.log('MARK ADDMEMBER', spec);
    const { name, position, content } = spec;
    const { x, y, height, width } = position;
    const { contentType, content: contentStr } = content;

    let newVertex = await trxWrap(async (trx) => {
      const newVertex = Model.Vertex.create({ trx });
      const role = ['member-of'];
      if (contentType === 'text/plain' || contentType === 'text/x-uri') {
        newVertex.createProperty({
          trx,
          role: ['body'],
          contentType,
          initialString: contentStr,
        });
        await newVertex.setJsonPropValues<Behaviors.MemberAppearance>(
          'appearance',
          {
            color: 'white',
            textColor: 'black',
            type: contentType === 'text/x-uri' ? 'browser' : 'stickynote',
          },
          trx,
        );
      }

      newVertex.createEdge({
        trx,
        role,
        target: this.currentTopicSpace()!.vertex,
        meta: { x_coordinate: x, y_coordinate: y, height, width },
      });
      return newVertex;
    });

    return { status: 'success', id: newVertex.id };
  }
}
