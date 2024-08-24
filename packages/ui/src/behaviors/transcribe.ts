import { Behavior, DispatchStatus, equalsAny, EventNav } from '..';
import * as VM from '../viewmodel';
import { Model, trxWrapSync } from '@edvoapp/common';
import OpenAI from 'openai';
import { getChatGPTApiKey, TranscriptionStream } from '../service/assistant/chatgpt';

export class Transcribe extends Behavior {
  transcriber?: TranscriptionStream;
  agent?: OpenAI;
  constructor() {
    super();
    let apiKey = getChatGPTApiKey();
    if (apiKey) {
      this.agent = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
      });
    }
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    if (equalsAny('alt-meta')) {
      eventNav.setGlobalBehaviorOverrides(this, ['handleKeyUp']);
      return this.start(originNode);
    }
    return 'decline';
  }

  handleKeyUp(eventNav: EventNav, e: KeyboardEvent, originNode: VM.Node): DispatchStatus {
    if (!this.transcriber) return 'decline';
    eventNav.unsetGlobalBehaviorOverrides(this);
    return this.stop(originNode);
  }
  handleMouseDown(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    const closestBtn = originNode.closestInstance(VM.SpeakButton);
    if (!closestBtn) return 'decline';
    eventNav.setGlobalBehaviorOverrides(this, ['handleMouseUp']);
    closestBtn.active.set(true);

    return this.start(closestBtn);
  }
  handleMouseUp(eventNav: EventNav, e: MouseEvent, originNode: VM.Node): DispatchStatus {
    if (!this.transcriber) return 'decline';
    eventNav.unsetGlobalBehaviorOverrides(this);
    const closestBtn = originNode.closestInstance(VM.SpeakButton);
    if (!closestBtn) return 'decline';

    closestBtn.active.set(false);
    return this.stop(closestBtn);
  }

  start(_node: VM.Node): DispatchStatus {
    void (async () => {
      try {
        // Request access to the microphone
        // TODO: need UX for the first time, because the event will be stuck in the key/mousedown state after they grant permissions
        console.log('assistant listening');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        this.transcriber = new TranscriptionStream(stream);
      } catch (error) {
        console.error('assistant error:', error);
      }
    })();
    return 'stop';
  }
  stop(node: VM.Node): DispatchStatus {
    const closestChat = node.closestInstance(VM.Chat);
    if (!closestChat) return 'decline';

    console.log('assistant stop listening');
    void (async () => {
      if (this.transcriber) {
        const transcript = await this.transcriber.finish();

        console.log('assistant transcript', transcript);
        if (transcript?.text) {
          trxWrapSync((trx) => {
            const message = Model.Vertex.create({ trx });
            message.createEdge({
              trx,
              target: closestChat.vertex,
              role: ['message'],
              meta: { messageRole: 'user' },
              seq: Date.now(),
            });
            message.createBodyTextProperty({
              trx,
              initialText: transcript.text,
            });
          });
        }
        delete this.transcriber;
      }
    })();

    return 'stop';
  }
}
