import { JSONSchema } from 'openai/lib/jsonschema';
import { AgentCapability } from '.';
import { sleep } from '@edvoapp/util';
import { Model, TrxRef, trxWrapSync } from '@edvoapp/common';
import { tr } from 'date-fns/locale';
import { max } from 'lodash';
import { VM } from '../../..';

interface Request {
  member_ids: string[];
}
interface Response {
  members: ResponseItem[];
}
interface ResponseItem {
  member_id: string;
  text_content?: string | null;
  notes?: string | null;
  status: 'found' | 'notfound';
}

const schema: JSONSchema = {
  type: 'object',
  properties: {
    member_ids: {
      type: 'array',
      description: 'list of member ids to be fetched',
      items: { type: 'string' },
    },
  },
  required: ['member_ids'],
  additionalProperties: false,
};
export class FetchMembers extends AgentCapability<Request, Response> {
  name = 'fetchMembers';
  description = 'Get additional information about a member';
  schema = schema;
  async call(spec: Request): Promise<Response> {
    console.log('assistant fetchMember start', spec);
    const membersById = this.currentTopicSpace()!.members.value.reduce((acc, member) => {
      acc[member.vertex.id] = member;
      return acc;
    }, {} as Record<string, VM.Member>);

    const response: ResponseItem[] = await Promise.all(
      spec.member_ids.map(async (id) => {
        let member = membersById[id];
        if (!member) return { member_id: id, status: 'notfound' };

        let text = await member.body.value?.content.getFullText();
        let notes = await member.sidecar.value?.outline.toMarkdown();
        return { member_id: id, text_content: text, notes, status: 'found' };
      }),
    );

    console.log('assistant fetchMember done', response);
    return { members: response };
  }
}
