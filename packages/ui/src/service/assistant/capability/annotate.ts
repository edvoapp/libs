import { JSONSchema } from 'openai/lib/jsonschema';
import { AgentCapability } from '.';
import { sleep } from '@edvoapp/util';
import { Model, TrxRef, trxWrapSync } from '@edvoapp/common';
import { tr } from 'date-fns/locale';
import { max } from 'lodash';

interface Request {
  member_id: string;
  subject: string;
  notes: string[]; // minimum length: 1
}
interface Response {
  status: 'success' | 'notfound';
}

const schema: JSONSchema = {
  type: 'object',
  properties: {
    member_id: {
      type: 'string',
      description: 'member id to be annotated',
    },
    subject: {
      type: 'string',
      description: 'subject of the notes',
    },
    notes: {
      type: 'array',
      description: 'list of notes to be added to the member',
      items: { type: 'string' },
      minItems: 1,
    },
  },
  required: ['member_id', 'subject', 'notes'],
  additionalProperties: false,
};

export class Annotate extends AgentCapability<Request, Response> {
  name = 'annotate';
  description = 'Add notes members';
  schema = schema;
  async call(spec: Request): Promise<Response> {
    const member = this.currentTopicSpace()!.members.value.find((member) => member.vertex.id == spec.member_id);
    if (!member) return { status: 'notfound' };
    if (!spec.notes.length) return { status: 'success' };

    member.setSidecarExpanded(null, true);

    let existingItems = await member.vertex.filterBackrefs({ role: ['category-item'] }).toArray();

    // determine what seq to use for the new notes
    let seq = Math.max(...existingItems.map((item) => item.seq.value), 0);
    trxWrapSync((trx) => {
      let seqRef = { seq };
      const top = this.addItem(trx, member.vertex, spec.subject, seqRef);

      seqRef.seq = 1;
      // iterate over the notes and add them to the member
      spec.notes.forEach((note) => {
        this.addItem(trx, top, note, seqRef);
      });
    });

    return { status: 'success' };
  }
  addItem(trx: TrxRef, target: Model.Vertex, text: string, seqRef: { seq: number }) {
    const vertex = Model.Vertex.create({ trx });
    vertex.createProperty({
      trx,
      role: ['body'],
      contentType: 'text/plain',
      initialString: text,
    });
    vertex.createEdge({
      trx,
      target,
      role: ['category-item'],
      seq: seqRef.seq++,
      meta: {},
    });
    return vertex;
  }
}
