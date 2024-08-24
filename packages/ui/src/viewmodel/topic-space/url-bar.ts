import { ConditionalNode, VertexNode, VertexNodeCA } from '../base';
import { MemoizeOwned, Observable } from '@edvoapp/util';
import { TextField } from '../text-field';
import { ActionMenu } from './action-menu';

interface CA extends VertexNodeCA<ConditionalNode<UrlBar, boolean, ActionMenu>> {}

interface WebView extends HTMLIFrameElement {
  reload: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
}

export class UrlBar extends VertexNode<ConditionalNode<UrlBar, boolean, ActionMenu>> {
  static new(args: CA) {
    const me = new UrlBar(args);
    me.init();
    return me;
  }

  get childProps(): (keyof this & string)[] {
    return ['text'];
  }

  @MemoizeOwned()
  get memberBody() {
    // this is kinda goofy
    return this.parentNode.parentNode.parentNode.parentNode.body.value ?? null;
  }

  // Url change which has not yet been saved to the database
  @MemoizeOwned()
  get unsavedUrl(): Observable<string | null> {
    const obs = new Observable<string | null>(null);
    this.onCleanup(
      this.url.subscribe((v) => {
        if (v) {
          // unclear if we want to keep this live or not
          // unsub();
          obs.set(v);
        }
      }, true),
    );

    return obs;
  }

  refresh() {
    const body = this.memberBody?.content;
    if (this.context.runtime === 'electron') {
      // @ts-expect-error stfu ts
      void body?.waitForDomElement().then((e: WebView) => {
        e.reload();
      });
    } else {
      // @ts-expect-error stfu ts
      void body?.waitForDomElement().then((e: HTMLIFrameElement) => {
        // eslint-disable-next-line no-self-assign
        if (e) e.src = e.src;
      });
    }
    this.unsavedUrl.set(null);
  }
  goBack() {
    if (this.context.runtime === 'electron') {
      const webview = this.memberBody?.content.domElement as WebView | null;
      webview?.goBack();
      this.memberBody?.updateUrl(webview?.src ?? '');
    }
  }
  goForward() {
    if (this.context.runtime === 'electron') {
      const webview = this.memberBody?.content.domElement as WebView | null;
      webview?.goForward();
      this.memberBody?.updateUrl(webview?.src ?? '');
    }
  }

  @MemoizeOwned()
  get urlProperty() {
    return this.vertex
      .filterProperties({
        role: ['urlReference', 'body'],
        contentType: 'text/x-uri',
      })
      .firstObs();
  }

  @MemoizeOwned()
  get url() {
    return this.urlProperty.mapObs<string | null>((v) => v?.text ?? null);
  }

  @MemoizeOwned()
  get text() {
    const tf = TextField.singleString({
      parentNode: this,
      fitContentParent: this.parentNode,
      emptyText: 'Search or type a URL',
      onChangeTimeout: 0,
      onChange: (value) => {
        this.unsavedUrl.set(value);
      },
      onSubmit: () => {
        this.handleSaveUrl();
      },
    });

    const cs = this.url;

    this.onCleanup(
      cs.subscribe((val) => {
        const aliveTf = tf.upgrade();
        if (val && aliveTf) {
          aliveTf.replaceContent(val);
        }
      }, true),
    );

    return tf;
  }

  handleSaveUrl() {
    const unsavedUrl = this.unsavedUrl.value;
    if (unsavedUrl === null) return;
    this.memberBody?.updateUrl(unsavedUrl);
    this.unsavedUrl.set(null);
  }
}
