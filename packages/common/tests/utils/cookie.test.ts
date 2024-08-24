/**
 * @jest-environment jsdom
 */
import { expect, test, describe, afterAll } from '@jest/globals';
import * as cookie from '../../src/utils/cookie';
import Cookie from 'js-cookie';

describe('getTLD', () => {
  test("getTLD returns null during testing when we're on localhost", () => {
    expect(cookie.getTLD()).toBeNull();
  });
});

describe('cookie set/get/erase', () => {
  // By default, document.cookie is not writeable and so all cookie
  // operations fail.  Override for testing purposes.
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: '',
  });

  test('getCookie returns null for unknown name', () => {
    expect(cookie.getCookie('nope')).toBeNull();
  });

  cookie.setCookie('snickerdoodle', 'delicious');
  test('setCookie/getCookie value', () => {
    expect(document.cookie).toContain('delicious');
    expect(cookie.getCookie('snickerdoodle')).toBe('delicious');
  });
  test('setCookie additional attributes', () => {
    expect(document.cookie).toContain('path=/;');
    expect(document.cookie).toContain('secure;');
    expect(document.cookie).toContain('sameSite=None;');
  });
  test('setCookie defaults to 100 day expiration', () => {
    let date = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 100);
    let expectedExpires = 'expires=' + date.toUTCString().substring(0, 16);
    expect(document.cookie).toContain(expectedExpires);
  });

  test('setCookie specify expiration', () => {
    const NUM_DAYS = 2000;
    cookie.setCookie('macaroon', 'yummy', NUM_DAYS);
    let date = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * NUM_DAYS);
    let expectedExpires = 'expires=' + date.toUTCString().substring(0, 16);
    expect(document.cookie).toContain(expectedExpires);
  });

  test('erase a cookie', () => {
    cookie.setCookie('gingersnap', 'spicy');
    cookie.eraseCookie('gingersnap');
    expect(cookie.getCookie('gingersnap')).toBeNull();
  });
});

describe('firebase auth set/get/erase', () => {
  test('set/get/erase firebase token', () => {
    cookie.setAuthToken('meep');
    expect(cookie.getAuthToken()).toBe('meep');
    cookie.eraseAuthToken();
    expect(cookie.getAuthToken()).toBeNull();
  });
});
