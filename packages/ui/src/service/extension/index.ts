export async function getTabById(tabId: number): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      resolve(tab);
    });
  });
}

export async function queryTabs(query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(query, (tabs) => {
      resolve(tabs);
    });
  });
}

export async function getAllWindows(): Promise<chrome.windows.Window[]> {
  return new Promise<chrome.windows.Window[]>((resolve) => {
    chrome.windows.getAll((windows) => resolve(windows));
  });
}

export async function sendMessageToTab(tabId: number, msg: { type: string; payload?: any }) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      resolve(res);
    });
  });
}

export function createTab(tabConfig: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve) => {
    chrome.tabs.create(tabConfig, (res) => resolve(res));
  });
}

export async function updateTab(
  tabId: number,
  tabConfig: chrome.tabs.UpdateProperties,
): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, tabConfig, (res) => {
      resolve(res);
    });
  });
}

export async function removeTab(tabId?: number) {
  return new Promise((resolve, reject) => {
    if (!tabId) return reject('no tabId');

    chrome.tabs.remove(tabId, () => {
      resolve(true);
    });
  });
}

export async function getCurrentTab() {
  const [tab] = await queryTabs({ active: true, currentWindow: true });
  return tab;
}

export async function getCurrentWindow() {
  return new Promise<chrome.windows.Window>((resolve) => chrome.windows.getCurrent((w) => resolve(w)));
}

const edvoDomain = new RegExp(/.*app.*\.edvo\.com$/i);

export async function getEdvoTabs(windowId?: number) {
  if (!windowId) windowId = (await getCurrentWindow()).id;
  return (
    await queryTabs({
      windowId,
      url: ['*://localhost/*', '*://*.edvo.com/*'],
    })
  ).filter((tab) => {
    const url = tab.url;
    if (!url) return false;
    const u = new URL(url);
    return edvoDomain.exec(u.hostname) !== null;
  });
}

export async function isEdvoTab(tabId: number, windowId: number) {
  const tabs = await getEdvoTabs(windowId);
  return tabs.filter((t) => t.id === tabId).length !== 0;
}

export async function getEdvoTab(windowId: number) {
  const tabs = await getEdvoTabs(windowId);
  return tabs.find((t) => t.windowId === windowId);
}
