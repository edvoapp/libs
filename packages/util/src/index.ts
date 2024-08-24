export * from './destroy';
export * from './observable';
export * from './await_value';
export * from './hooks';
export * from './dom_helpers';
export * from './local-storage';
export * from './wasm_bindings';
export * from './file-writer';
export * from './async_filter';
export * from './filter-map';
export * from './clamp';
export * from './sleep';
export * from './hash';
export * as QueryString from './querystring';

declare global {
  interface Window {
    edvoutil: typeof me;
  }
  var edvoutil: typeof me;
}

import * as me from '.';
globalThis.edvoutil = me;

/**
 * Return a duplicate string with the first char upper-cased.
 *
 * An empty string input yields an empty string output.
 */
export function capitalize(str: string) {
  if (str === '') return '';
  return `${str[0].toUpperCase()}${str.substring(1)}`;
}

export function wait(time = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

export function tryJsonParse<T extends {}>(arg: string | undefined | null): T {
  try {
    if (!arg) return {} as T;
    return JSON.parse(arg);
  } catch (err) {
    console.error(`Error parsing ${arg} into JSON`, err);
    return {} as T;
  }
}

export function tryJsonParseOrNull<T extends {}>(arg: string): T | null {
  try {
    return JSON.parse(arg) as T;
  } catch (err) {
    console.error(`Error parsing ${arg} into JSON`, err);
    return null;
  }
}

// This makes it easy to debug return values of things, and easily turn it off too, without messing too much with the statement itself (ie const foo = 'foo'; /* console.log('foo',foo); */ return foo.
export function debug<T>(val: T, message?: string, disable?: boolean): T {
  if (!disable) {
    console.debug('DEBUG', message, val);
  }

  return val;
}

export function generateKey() {
  return Math.random().toString().substring(2);
}

export type RejectUndefined<T> = {
  [P in keyof T]: T[P] extends undefined ? never : T[P];
};

export function rejectUndefined<T extends {}>(obj: T): RejectUndefined<T> {
  const newObj: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      newObj[key] = value;
    }
  }
  return newObj as RejectUndefined<T>;
}

const common = {};
export default common;
