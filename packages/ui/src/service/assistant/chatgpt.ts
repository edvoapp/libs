import {
  AsyncFilterMapObservableList,
  EdvoObj,
  MemoizeOwned,
  ObservableList,
  OwnedProperty,
  sleep,
  tryJsonParse,
  WeakProperty,
} from '@edvoapp/util';
import OpenAI from 'openai';
import { AgentCapability } from './capability';
import { TopicSpace, TSPage, ViewModelContext } from '../../viewmodel';
import { FetchMembers } from './capability/fetch_member';
import { TileMode } from './capability/tile_mode';
import { Model, TrxRef, Firebase, trxWrapSync } from '@edvoapp/common';
import { Annotate } from './capability/annotate';
import { AddSticky } from './capability/add_sticky';
import { Agent, AgentInstance, VM } from '../..';

// TODO:
// [X] initialization
// [X] move existing code
// [ ] create outline
// [X] assistant has its own user id

type TaskStatus = 'pending' | 'running' | 'failed' | 'completed';

export function getChatGPTApiKey() {
  let apiKey = localStorage.getItem('openai_apikey') ?? undefined;
  if (!apiKey)
    console.warn(
      "No ChatGPT API Key found, run `localStorage.setItem('openai_apikey', YOUR_API_KEY)` to use this feature",
    );
  return apiKey;
}

export class ChatGPTAgent extends EdvoObj implements Agent {
  apikey: string;
  @WeakProperty
  context: ViewModelContext;
  @OwnedProperty
  user: Model.Vertex;
  client: OpenAI;
  constructor(user: Model.Vertex, apikey: string, context: ViewModelContext) {
    super();
    this.apikey = apikey;
    this.context = context;
    this.user = user;

    this.client = new OpenAI({
      apiKey: this.apikey,
      dangerouslyAllowBrowser: true,
    });
  }
  getInstance(conversationVertex: Model.Vertex) {
    return new ChatGPTAgentInstance(conversationVertex, this);
  }

  async speak(text: string) {
    console.log('speaking ', text);
    let response = await this.client.audio.speech.create(
      { model: 'tts-1', voice: 'alloy', input: text, response_format: 'mp3' },
      // { stream: true },
    );
    console.log('assistant audio response', response);

    // TODO stream the audio so we can play it as it comes in
    // to reduce latency
    const audioBuffer = await response.arrayBuffer();
    // console.log('assistant audioBuffer', audioBuffer);
    await playAudio(audioBuffer);
  }
  transcriber?: TranscriptionStream;
  async listen() {
    if (!this.apikey) {
      console.error('assistant No API key set for OpenAI');
      return;
    }

    try {
      // Request access to the microphone
      console.log('assistant listening');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.transcriber = new TranscriptionStream(stream);
    } catch (error) {
      console.error('assistant error:', error);
    }
  }
  async stopListening(cb: (text: string) => void) {
    // stop recording audio
    console.log('assistant stop listening');

    if (this.transcriber) {
      const transcript = await this.transcriber.finish();

      console.log('assistant transcript', transcript);
      if (transcript?.text) {
        cb(transcript.text);
      }
      delete this.transcriber;
    }
  }
}

export class ChatGPTAgentInstance extends EdvoObj implements AgentInstance {
  @OwnedProperty
  conversationVertex: Model.Vertex;
  @OwnedProperty
  agent: ChatGPTAgent;
  // TODO: maybe this should live on the Agent itself?
  rtdb: Firebase.Database;

  constructor(conversationVertex: Model.Vertex, agent: ChatGPTAgent) {
    super();
    this.rtdb = Firebase.database();
    this.agent = agent;
    this.conversationVertex = conversationVertex;

    this.capabilities = [
      new TileMode(this.agent.context),
      new Annotate(this.agent.context),
      new FetchMembers(this.agent.context),
      // new FetchCards(this.context),
      new AddSticky(this.agent.context),
      // new AddRelation(this.context),
    ];

    this.init();
  }
  capabilities: AgentCapability<any, any>[];
  sending = false;

  init() {
    this.onCleanup(
      this.messages.subscribe({
        ITEM_LISTENER: (value, op, origin, ctx) => {
          if (!this.sending && origin === 'USER' && op === 'ADD') {
            void this.sendMessages([
              { role: 'system', content: this.getSystemMessagePrompt() },
              ...this.messages.value,
            ]);
          }
        },
      }),
    );
  }

  @MemoizeOwned()
  get messageBackrefs() {
    return this.conversationVertex
      .filterBackrefs({
        role: ['message'],
      })
      .sortObs((a, b) => a.seq.value - b.seq.value);
  }

  @MemoizeOwned()
  get messages(): ObservableList<OpenAI.ChatCompletionMessageParam> {
    let backrefs = this.messageBackrefs;

    // get the message once for each new backref, and maintain that set as an observable
    return new AsyncFilterMapObservableList<Model.Backref, OpenAI.ChatCompletionMessageParam>(backrefs, (backref) =>
      this.getMessageForBackref(backref),
    );
  }

  async getMessageForBackref(backref: Model.Backref): Promise<OpenAI.ChatCompletionMessageParam | undefined> {
    const role = backref.meta.value?.messageRole;
    console.warn('getMessageForBackref', { role });

    if (!role) return undefined;

    let message = { role } as OpenAI.ChatCompletionMessageParam;

    if (role === 'assistant' || role === 'user') {
      let body = await backref.target.getProperty({ role: ['body'] });
      message.content = body?.text.value;
    }

    return message;
    // const raw_message = await backref.target.getProperty({
    //   role: ['openai_raw_message'],
    // });
    // const text = raw_message?.text.value;
    // if (!text) return undefined;
    // try {
    //   return JSON.parse(text) as OpenAI.ChatCompletionMessageParam;
    // } catch (err) {
    //   console.error(`Error parsing ${text} into JSON`, err);
    //   return undefined;
    // }
  }

  getSystemMessagePrompt() {
    const topicSpaceName = this.currentTopicSpace?.name.value ?? 'Unnamed Space';

    const memberList =
      this.currentTopicSpace?.members.value
        .map((member) => {
          return `<member id=${member.vertex.id}>${member.name.value ?? ''}</member>\n`;
        })
        .join('') ?? '';

    return (
      `You are a helpful assistant editing my visual graph database.` +
      `We are looking a topic space called ${topicSpaceName} which contains the following member cards: \n` +
      `${memberList}\n` +
      'You should aggressively call the `annotate` function to convey any salient details or decision factors.\n' +
      `Answer questions **very concisely** or say in one short sentence what you did to edit the graph.\n` +
      `NEVER include a member_id in your text response. If you need to refer to a member, use its name or text\n`
    );
  }

  get currentTopicSpace() {
    return this.agent.context.rootNode?.findChild((n) => n instanceof TSPage && n)?.topicSpace;
  }
  saveMessage(trx: TrxRef, message: OpenAI.ChatCompletionMessageParam) {
    const { role } = message;
    if (!role || role === 'system' || role == 'function') return;

    let vertices: Model.Vertex[] = [];

    if (role === 'assistant' && message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        vertices.push(this.saveToolCall(toolCall, trx));
      }
    } else if (role === 'tool' && message.tool_call_id) {
      this.saveToolCallResponse(message, trx);
    } else if (role === 'assistant' && message.content) {
      const vertex = Model.Vertex.create({
        trx,
        subUserID: role == 'assistant' ? this.agent.user.id : undefined,
      });
      vertices.push(vertex);
      vertex.createBodyTextProperty({
        initialText: message.content,
        trx,
        subUserID: role == 'assistant' ? this.agent.user.id : undefined,
      });
    }

    for (const vertex of vertices) {
      vertex.createEdge({
        role: ['message'],
        origin: 'UNKNOWN',
        subUserID: role == 'assistant' ? this.agent.user.id : undefined,
        meta: { messageRole: role },
        target: this.conversationVertex,
        trx,
        seq: Date.now(),
      });
    }

    //    {
    //     "role": "assistant",
    //     "content": null,
    //     "tool_calls": [
    //         {
    //             "id": "call_D5RFuXo8hd5KKeS2FSHBjNSK",
    //             "type": "function",
    //             "function": {
    //                 "name": "addSticky",
    //                 "arguments": "{\"position\": {\"x\": 100, \"y\": 100, \"height\": 60, \"width\": 120}, \"content\": \"Red\", \"relations\": []}"
    //             }
    //         },
    //         {
    //             "id": "call_yu8Wq6TS6gfXaiBnAEjrGutI",
    //             "type": "function",
    //             "function": {
    //                 "name": "addSticky",
    //                 "arguments": "{\"position\": {\"x\": 300, \"y\": 100, \"height\": 60, \"width\": 120}, \"content\": \"Blue\", \"relations\": []}"
    //             }
    //         },
    //         {
    //             "id": "call_pP9XtuEESBbZAwxpgAFvlLwP",
    //             "type": "function",
    //             "function": {
    //                 "name": "addSticky",
    //                 "arguments": "{\"position\": {\"x\": 200, \"y\": 200, \"height\": 60, \"width\": 120}, \"content\": \"Yellow\", \"relations\": []}"
    //             }
    //         }
    //     ]
    // }

    // if (content) {
    //   messageVertex.createBodyTextProperty({
    //     // How do we update the property content if we receive a ChatCompletionContentPart?
    //     initialText: content,
    //     subUserID: this.agent.user.id,
    //     trx,
    //   });
    // }
    // if (message.tool_calls?.length) {
    //   for (const toolCall of message.tool_calls) {
    //     this.saveToolCall(toolCall, trx);
    //   }
    // }
    // if (role === 'tool') {
    //   this.saveToolCallResponse(message, trx);
    // } else if (role === 'user') {
    // }
    // messageVertex.createProperty({
    //   trx,
    //   subUserID,
    //   role: ['openai_raw_message'],
    //   contentType: 'application/json',
    //   initialString: JSON.stringify(message),
    // });
    // if (role === 'assistant' && message.function_call) {
    //   messageVertex.createBodyTextProperty({
    //     initialText: `Executing ${message.function_call.name}...`,
    //     trx,
    //     subUserID,
    //   });
    //   messageVertex.createProperty({
    //     trx,
    //     subUserID,
    //     role: ['task-status'],
    //     contentType: 'application/json',
    //     initialString: JSON.stringify({ status: 'executing' }),
    //   });
    // } else if (
    //   content &&
    //   !Array.isArray(content) &&
    //   ['assistant', 'user'].includes(role)
    // ) {
    //   messageVertex.createBodyTextProperty({
    //     initialText: content,
    //     subUserID,
    //     trx,
    //   });
    // }
    // if (matchingMessageProp && matchingMessageVertex && role === 'function') {
    //   const fnName = message.name;
    //   matchingMessageProp.setContent(trx, `Executed ${fnName}`);
    // }
    // if (!matchingMessageVertex) {
    //   messageVertex.createEdge({
    //     role: ['message'],
    //     subUserID,
    //     meta: {},
    //     target: activeConversation,
    //     trx,
    //     seq: Date.now(),
    //   });
    // }
  }

  pendingToolCallsById: Record<string, Model.Property> = {};
  saveToolCall(toolCall: OpenAI.ChatCompletionMessageToolCall, trx: TrxRef) {
    const v = Model.Vertex.create({ trx });
    v.createProperty({
      role: ['tool_call'],
      contentType: 'application/json',
      initialString: JSON.stringify(toolCall),
      trx,
    });
    // set the task status property ( running )
    const status = v.createProperty({
      role: ['task-status'],
      contentType: 'application/json',
      initialString: JSON.stringify({ status: 'running' }),
      trx,
    });
    v.createProperty({
      role: ['body'],
      contentType: 'text/plain',
      initialString: toolCall.function.name,
      trx,
    });

    // save to the pendingToolCallsById
    this.pendingToolCallsById[toolCall.id] = status;
    return v;
  }
  saveToolCallResponse(toolCall: OpenAI.ChatCompletionToolMessageParam, trx: TrxRef) {
    // {
    //     "role": "tool",
    //     "tool_call_id": "call_yN0mHK5YcgCotVkvIgoO95IP",
    //     "content": "{\"members\":[{\"member_id\":\"UaVq0FlZNwLcNdtU9KLQ\",\"text_content\":\"Red\",\"notes\":\"\",\"status\":\"found\"},{\"member_id\":\"UMv9n7hYSZnLMOcPDygE\",\"text_content\":\"Green\",\"notes\":\"\",\"status\":\"found\"},{\"member_id\":\"shgN6B3frd05sXqvLoEm\",\"text_content\":\"Blue\",\"notes\":\"\",\"status\":\"found\"}]}"
    // }

    const toolCallId = toolCall.tool_call_id;
    // find the previous tool call status property
    const status = this.pendingToolCallsById[toolCallId];
    if (!status) return;
    delete this.pendingToolCallsById[toolCallId];

    // changed the status to completed
    status.setContent(trx, JSON.stringify({ status: 'completed' }));

    // record the response on the tool call vertex
    const v = status.parent;
    v.createProperty({
      role: ['tool_call_response'],
      contentType: 'application/json',
      initialString: JSON.stringify(toolCall),
      trx,
    });
  }

  handleMessage(message: OpenAI.ChatCompletionMessageParam) {
    console.info('handleMessage ', message);

    // TODO make this a debounced transaction so we roll multiple messages into one transaction
    trxWrapSync((trx) => {
      this.saveMessage(trx, message);
    });
    if (message.role === 'assistant' && message.content) {
      void this.agent.speak(message.content);
    }
  }

  async sendMessages(messages: OpenAI.ChatCompletionMessageParam[]) {
    console.log('sendMessages', messages);
    // const myName = 'Daniel';
    // this.context.authService.currentUserVertexObs.value?.get ??
    // 'anonymous';
    // const assistantName = 'Bob';

    this.sending = true;

    const completions = this.agent.client.beta.chat.completions
      .runTools({
        model: 'gpt-4-0125-preview', // 'gpt-3.5-turbo-16k-0613',
        messages,
        tools: this.capabilities.map((c) => c.definition),
        stream: true,
      })
      // .on('connect', (...args) => console.debug('connect', args))
      .on('functionCall', (...args) => console.debug('functionCall', args))
      .on('message', (...args) => {
        console.debug('message', args);
        void this.handleMessage(args[0]);
      })
      .on('chatCompletion', (...args) => console.debug('chatCompletion', args))
      .on('finalContent', (...args) => console.debug('finalContent', args))
      .on('finalMessage', (...args) => console.debug('finalMessage', args))
      .on('finalChatCompletion', (...args) => console.debug('finalChatCompletion', args))
      .on('finalFunctionCall', (...args) => console.debug('finalFunctionCall', args))
      .on('functionCallResult', (...args) => console.debug('functionCallResult', args))
      .on('finalFunctionCallResult', (...args) => console.debug('finalFunctionCallResult', args))
      .on('error', (...args) => console.debug('error', args))
      .on('abort', (...args) => console.debug('abort', args))
      .on('end', (...args) => console.debug('end', args))
      .on('totalUsage', (...args) => console.debug('totalUsage', args));

    const currentUserID = this.agent.context.currentUser.value?.id ?? '';
    const agentUserID = this.agent.user.id;
    const userChatRef = this.rtdb.ref(`chat/${this.conversationVertex.id}/user/${currentUserID}`);
    // RTDB doesn't support merging of records, so we need to be atomic, otherwise it will wipe out the `sub` record.
    await userChatRef.child('userID').set(currentUserID);

    const chatRef = userChatRef.child(`sub/${agentUserID}`);
    for await (const chunk of completions) {
      // This is ok to use set because these are the only two fields on this record
      void chatRef.set({
        timestamp: Date.now(),
        userID: agentUserID,
      });
      console.debug('CHUNK', chunk);
      // TODO: stream this into our database; use property.insertString or something
      // console.log(chunk.choices[0].delta.content);
    }
    const c = await completions.finalChatCompletion();
    const cc = await completions.finalContent();
    console.debug('FINAL CHAT', c);
    console.debug('FINAL CONTENT', cc);

    this.sending = false;
  }
}

async function playAudio(arrayBuffer: ArrayBuffer) {
  try {
    // Create a new AudioContext
    const audioContext = new AudioContext();

    // Decode the audio file data
    await audioContext.decodeAudioData(
      arrayBuffer,
      (buffer) => {
        // Create an audio source
        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        // Connect the source to the context's destination (the speakers)
        source.connect(audioContext.destination);

        // Play the audio
        source.start(0);
      },
      (e) => {
        console.log('Error with decoding audio data', e);
      },
    );
  } catch (error) {
    console.error('Error fetching and playing audio:', error);
  }
}

interface TranscriptionResponse {
  text: string;
}
/** Starts a new transcription stream immediately upon construction
 * and sends audio data to the OpenAI API in real-time.
 * The API seems to take more time for longer audio streams, so it's not obvious if streaming is actually
 * faster than sending the entire audio file at once. At least this gets the handshaking out of the way,
 * and prepares us for the future.
 * */
export class TranscriptionStream {
  model: string;
  stream: MediaStream;
  recorder: MediaRecorder;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
  response?: Promise<Response>;
  constructor(mediaStream: MediaStream, model = 'whisper-1') {
    let apiKey = getChatGPTApiKey();

    this.model = model;
    this.stream = mediaStream;
    // Initialize the MediaRecorder with the provided MediaStream
    this.recorder = new MediaRecorder(mediaStream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    if (apiKey)
      this.response = fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        //@ts-ignore
        duplex: 'half',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${this.boundary}`,
        },
        body: readable,
      });
    // Setup the multipart form data headers
    this.prepareFormDataHeaders(writer);

    // Handle the ondataavailable event to stream audio chunks
    this.recorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const arrayBuffer = await event.data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        // is this efficient?
        await writer.write(uint8Array);
      }
      if (this.recorder.state === 'inactive') {
        const finalBoundary = `\r\n--${this.boundary}--`;
        await writer.write(new TextEncoder().encode(finalBoundary));
        await writer.close();
      }
    };

    // Start the MediaRecorder
    this.recorder.start(100); // Adjust timeslice as needed

    this.recorder.onstop = async () => {
      //
    };

    this.writer = writer;
  }

  prepareFormDataHeaders(writer: WritableStreamDefaultWriter<Uint8Array>) {
    const initialFormData =
      `--${this.boundary}\r\n` + `Content-Disposition: form-data; name="model"\r\n\r\n` + `${this.model}\r\n`;
    writer?.write(new TextEncoder().encode(initialFormData));

    const filePartHeader =
      `--${this.boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="recording.webm"\r\n` +
      `Content-Type: audio/webm;codecs=opus\r\n\r\n`;
    void writer.write(new TextEncoder().encode(filePartHeader));
  }

  async finish() {
    // TODO: I was running into issues with the timing of the onstop and the last ondataavailable event, so I put the writer close in
    // the ondataavailable event. I assume that it could theoretically could stop perfectly at the end of the last ondataavailable event
    // with a recording.state of recording, and thus fail to close the writer. I'm not sure if this is actually possible though.

    this.recorder?.stop();
    this.stream.getTracks().forEach((track) => track.stop());

    const response = await this.response;
    if (response) return (await response.json()) as TranscriptionResponse;
  }
}
