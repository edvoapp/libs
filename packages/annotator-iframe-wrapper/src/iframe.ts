import { AnnotatorApp } from '../../extension/src/content/ShadowRoot';

export class AnnotatorIFrameWrapper {
  bind(app: AnnotatorApp) {
    const iframe = document.createElement('iframe');
    iframe.id = 'edvo-annotator-app-inner';
    iframe.src = 'https://example.com'; // config.overlayUrl;
    iframe.width = '400px';
    iframe.height = '200px';

    // iframe.classList.add('edvo-annotator-app-inner');
    app.shadowRoot!.append(iframe);
  }
  // All the machinery to set up and talk to the iframe would go in here

  private sendMessageToInner(msg: any) {
    if (!this.injected) return;

    const iframe = document.getElementById('edvo-annotator-app-inner') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe?.contentWindow?.postMessage(msg, '*');
    } else {
      console.warn('Iframe was injected, but not detected');
    }
  }

  // TODO - QUESTION: Can we just listen to iframe? window.parent.sendMessage window.sendMessage
  // async handleWindowMessage(event: MessageEvent) {
  //     const msg = event.data;

  // TODO determine if we can say iframe.addEventListener instead
  //     //        window.addEventListener('message', (event) => this.handleWindowMessage(event))

  //     console.log('ContentScript: window message', msg.type, msg.payload)
  //     if (msg.type === 'NOTIFY/INNER_READY') {
  //         const extensionID = this.extensionID;
  //         this.sendMessageToInner({ type: 'NOTIFY/EXTENSION_ID', payload: { id: extensionID } })

  //         const activeQuestID = await this.getValue('currentQuestId') || null
  //         this.sendMessageToInner({
  //             type: 'SET_ACTIVE_QUEST',
  //             payload: { activeQuestID },
  //         })
  //     }
  // }

  addHighlight() {}
}
