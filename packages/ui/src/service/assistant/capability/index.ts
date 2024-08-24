import { EdvoObj, WeakProperty } from '@edvoapp/util';
import { TopicSpace, ViewModelContext } from '../../../viewmodel';
import { JSONSchema } from 'openai/lib/jsonschema';
import { RunnableToolFunction } from 'openai/lib/RunnableFunction';

export abstract class AgentCapability<Req extends {}, Res> extends EdvoObj {
  abstract name: string;
  abstract call(spec: Req): Promise<Res> | Res;
  abstract schema: JSONSchema;
  abstract description: string;
  parse = JSON.parse;
  @WeakProperty
  context: ViewModelContext;
  constructor(context: ViewModelContext) {
    super();
    this.context = context;
  }

  get definition(): RunnableToolFunction<Req> {
    // lowercase the first letter of the class name to get the function name
    let functionName = this.constructor.name[0].toLowerCase() + this.constructor.name.slice(1);
    let foo = {
      [functionName]: (req: Req) => {
        console.log(`assistant calling ${functionName} with `, req);
        return this.call(req);
      },
    };

    // @ts-expect-error not sure what it is mad about
    return {
      type: 'function',
      function: {
        name: functionName,
        // provide a parameter "function" which calls this.call with the arguments
        function: foo[functionName],
        parameters: this.schema,
        parse: this.parse,
        description: this.description,
      },
    };
  }
  currentTopicSpace() {
    return this.context.rootNode!.findChild((n) => n instanceof TopicSpace && n);
  }
}

export interface Position {
  x: number;
  y: number;
  height: number;
  width: number;
}
