import 'preact/debug';
// The index.ts file is used by preact to inject the App into the document somehow. That
// injection process has been moved to the default export function from inject.js.
//
// All this file needs to do is import that function and call it.

import inject from './inject';

const env = process.env.NODE_ENV;
console.log('OUTER ENV!', env);

function docReady(fn) {
  // see if DOM is already available
  if (['complete', 'interactive'].includes(document.readyState)) {
    // call on next available tick
    setTimeout(fn, 1);
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

docReady(inject);
export default null;
