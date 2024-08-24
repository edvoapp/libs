import { render, h } from 'preact';
import { config, injectAnalytics } from '@edvoapp/common';
import { isProbablyReaderable, Readability } from '@mozilla/readability';

import App from './components/app';
// TODO - reimplement when reader mode is implemented
// import './style/reader-styles.scss';
import './style/index.scss';

// The following export ends up being the default export of the entire module thanks to
// the "exports" key in the package.json file.
console.log('Outer Node ENV!', config);

export function injectStyles() {
  const stylesheetPath = config.injectorStylesUrl;
  const links = document.getElementsByTagName('link');
  let alreadyInjected = false;
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (link.getAttribute('href') === stylesheetPath) {
      alreadyInjected = true;
      break;
    }
  }
  if (!alreadyInjected) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = stylesheetPath;
    document.head.appendChild(link);
  }
}

function activateReaderMode() {
  if (!isProbablyReaderable(document)) return;
  const article = new Readability(document);
  console.log('article!', article);
  const parsed = article.parse();
  console.log('parsed!', parsed);
  if (!parsed) return;
  const body = document.createElement('body');
  body.classList.add('light', 'sans-serif', 'loaded');
  body.id = 'edvo__reader-body';
  const container = document.createElement('div');
  container.classList.add('container');
  container.id = 'edvo__reader-container';
  const header = document.createElement('div');
  header.classList.add('header', 'reader-header', 'reader-show-element');
  const readerTitle = document.createElement('h1');
  readerTitle.classList.add('reader-title');
  readerTitle.innerText = parsed.title;
  const credits = document.createElement('div');
  credits.classList.add('credits', 'reader-credits');
  credits.innerText = parsed.byline;
  const hr = document.createElement('hr');
  const content = document.createElement('div');
  content.classList.add('content');
  const readerContent = document.createElement('div');
  readerContent.classList.add('moz-reader-content', 'reader-show-element');
  readerContent.innerHTML = parsed.content;
  body.appendChild(container);
  container.appendChild(header);
  header.appendChild(readerTitle);
  header.appendChild(credits);
  container.appendChild(hr);
  container.appendChild(content);
  content.appendChild(readerContent);
  document.open();
  document.write(body.outerHTML);
  document.close();
}

/**
 * Injects the annotator into the current the current document.body. This will append a
 * div element with the class 'edvo__root' into the body. Consumers of this function have
 * no guarantees about the contents of the 'edvo__root'; that is an implementation detail.
 */
const ROOT_ID = 'edvo__root';

export default function inject() {
  // if (config.env === 'production') {
  injectAnalytics();
  // }
  const existingRoot = document.getElementById(ROOT_ID);
  if (existingRoot) return; // dont do anything if a root already exists
  // activateReaderMode();
  const root = document.createElement('div');
  root.id = ROOT_ID;
  const iframe = document.createElement('iframe');
  iframe.id = 'edvo-annotator-app-inner';
  iframe.src = config.overlayUrl;
  iframe.classList.add('edvo-annotator-app-inner');
  root.append(iframe);
  document.documentElement.append(root);
  // document.body.append(root);
  if (config.env !== 'development' && config.env !== 'test') {
    // in dev, since we already have an HTML page, styles are already pre-injected by preact-cli
    injectStyles();
  }

  render(<App />, root);
}
