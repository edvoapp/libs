import { Model, config, Analytics } from '@edvoapp/common';
import { EdvoObj } from '@edvoapp/util';
import { BaseExtensionBridge } from './base-extension-bridge';
import { route } from 'preact-router';
import { createTab, getCurrentTab, getEdvoTabs, updateTab } from './extension';
import * as VM from '../viewmodel';
import { globalContext } from '../viewmodel';

/* TODO: this class is kind of messy. I think we need to get rid of all the messaging and
   replace it with either window.open/route or chrome.tabs
   In whatever context we are using the Navigator, we should have access to at least one of these.
 */

export class Navigator extends EdvoObj {
  constructor(private extBridge: BaseExtensionBridge) {
    super();
  }

  async openVertexInTab({ vertex, newTab }: { vertex: Model.Vertex; newTab?: boolean }): Promise<void> {
    // this.track({
    //   category: 'Navigation',
    //   action: 'Open Topic in New Tab',
    // });
    const properties = await vertex.properties.get();
    const uriPart = properties.find((part) => part.contentType === 'text/x-uri');
    const pdfPart = properties.find((part) => part.contentType === 'application/pdf');
    // console.log('open vertex in new tab', vertex.id, uriPart, pdfPart);

    if (uriPart) {
      let uri = await uriPart.text.get();
      if (uri) {
        const args = { uri };
        if (newTab) return this.openUriNewTab(args);
        return this.openUri(args);
      }
    }
    if (pdfPart) {
      this.openWebappPathInCurrentTab(`/pdf?vertexId=${vertex.id}`);
      return;
    }

    // TODO - handle cached pages and PDFs
    alert('Unhandled link in navigator service -- do you have the extension installed?');
  }

  async openVertexInNewTab({ vertex }: { vertex: Model.Vertex }): Promise<void> {
    this.openVertexInTab({ vertex, newTab: true });
  }
  async openUriNewTab({ uri }: { uri: string }) {
    this.extBridge.sendExtensionMessage(
      'NAVIGATE_NEW_TAB',
      {
        uri,
      },
      () => {},
      () => {
        if (window.electronAPI) {
          // window.electronAPI.openUrlInBrowser(uri);
          window.electronAPI.send('OPEN_URL_IN_BROWSER', { uri });
        } else {
          const win = window.open(uri, '_blank');
          win?.focus(); // preventScroll audited
        }
      },
    );
  }
  openUri({ uri }: { uri: string }, newTab?: boolean) {
    const context = this.extBridge.context;
    if (context === 'popup') {
      const url = `${config.webappUrl}${uri}`;
      if (newTab) {
        void chrome.tabs.create({
          url,
          active: true,
        });
      } else {
        chrome.tabs.query(
          {
            active: true,
            currentWindow: true,
          },
          ([{ id }]) => {
            if (id) void chrome.tabs.update(id, { url });
          },
        );
      }
    } else if (context === 'browser') {
      route(uri);
    } else {
      // TODO: determine if we want to handle opening in current tab in other extension/browser contexts
      // my intuition is no
    }
  }
  openInCurrentTab(uri: string) {
    window.location.href = uri;
  }

  openWebappPathInCurrentTab(webappPath: string) {
    const isBrowserContext = this.extBridge.context === 'browser';
    const isPopupContext = this.extBridge.context === 'popup';
    const uri = `${config.webappUrl}${webappPath}`;
    if (config.testWebApp(window?.location?.href) || config.isElectron) {
      route(webappPath);
    } else if (isBrowserContext) {
      // we only want to do this if we are NOT in the webapp
      this.openInCurrentTab(uri);
    } else if (isPopupContext) {
      this.openUrlInEdvoTab(uri);
    } else {
      this.extBridge.sendCurrentTabMessage('COMMAND/OPEN_URI_IN_CURRENT_TAB', {
        uri,
      });
    }
  }

  async openUrlInEdvoTab(url: string, newTab?: boolean) {
    if (this.extBridge.context !== 'popup') return;
    const [edvoTab] = await getEdvoTabs();
    const myTab = await getCurrentTab();
    if (edvoTab?.id) {
      return await updateTab(edvoTab.id, { url, active: true });
    }
    if (newTab) {
      return await createTab({ url, active: true });
    }
    const tabId = myTab.id;
    if (!tabId) return;
    await updateTab(tabId, { url, active: true });
  }

  async openWebapp(pinned?: boolean, path = '', newTab?: boolean) {
    if (this.extBridge.context !== 'popup') return;
    const [edvoTab] = await getEdvoTabs();
    let edvoTabId = edvoTab?.id;
    const url = `${config.webappUrl}${path}`;
    if (edvoTabId) {
      if (path) {
        return await updateTab(edvoTabId, { active: true, pinned, url });
      } else return await updateTab(edvoTabId, { active: true, pinned });
    }
    const myTab = await getCurrentTab();
    if (newTab) {
      const newIndex = myTab.index + 1;
      return await createTab({
        pinned,
        url,
        active: true,
        index: newIndex,
      });
    }
    const myTabId = myTab.id;
    if (!myTabId) return;
    await updateTab(myTabId, { active: true, url, pinned });
  }

  openTopic(topic: Model.Vertex, focusMember?: Model.Vertex, params?: Record<string, string>) {
    const topicID = topic.id;
    const memberID = config.hardCodedFocusMembers[topicID] || focusMember?.id;
    const p = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => p.set(key, value));
    const webappPath =
      `/topic/${topicID}` + (memberID ? `?centerMemberId=${memberID}` : '') + (p.toString() ? `?${p.toString()}` : '');
    VM.globalContext().focusState.setPendingFocus({
      match: (x) => x instanceof VM.TopicSpace && x.vertex === topic,
      context: {},
    });
    this.openWebappPathInCurrentTab(webappPath);
  }
  openLogin() {
    const uri = `${config.webappUrl}/auth/login?returnToPreviousTab=true`;
    void this.openUriNewTab({ uri });
  }
}

let globalNav: Navigator | null = null;

export function globalNavigator(): Navigator {
  if (!globalNav) throw 'Global navigator not initialized';
  return globalNav;
}
export function setGlobalNavigator(nav: Navigator) {
  globalNav = nav;
}
export function unsetGlobalNavigator() {
  globalNav = null;
}

export function useNavigator(): Navigator {
  if (!globalNav) throw 'Global navigator not initialized';
  return globalNav;
}
