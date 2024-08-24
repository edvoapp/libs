import { JSONSchema } from 'openai/lib/jsonschema';
import { AgentCapability } from '.';
import * as VM from '../../../viewmodel';
import { sleep } from '@edvoapp/util';

type Request = {
  feature_member_ids?: string[];
  show_topic_space?: true;
};

interface Response {
  status: string;
}

const schema: JSONSchema = {
  type: 'object',
  properties: {
    feature_member_ids: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    show_topic_space: {
      type: 'boolean',
    },
  },
  required: [],
  additionalProperties: false,
};

export class TileMode extends AgentCapability<Request, Response> {
  name = 'display';
  description =
    'Shows the topicspace OR a list of member cards more prominantly. Also known as "show", tile mode, focus, or splitscreen';
  schema = schema;
  async call(spec: Request): Promise<Response> {
    const appDesktop = this.context.rootNode;
    if (!(appDesktop instanceof VM.AppDesktop)) return { status: 'no action' };
    const tileContainer = appDesktop.tileContainer;

    if (spec.show_topic_space) {
      tileContainer.set([]);
      return { status: 'topicspace shown' };
    }

    if (spec.feature_member_ids) {
      const member_ids = spec.feature_member_ids;
      const items = this.currentTopicSpace()!.members.value.filter((member) => member_ids.includes(member.vertex.id));

      tileContainer.set(items);
      return { status: 'members featured' };
    }

    return { status: 'no action' };
  }
}
