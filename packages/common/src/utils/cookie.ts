// import Cookie from 'js-cookie';

// /**
//  * @file Provide cookie functionality for edvo domains.
//  *
//  * This implementation wraps js-cookie, so all of its behaviors apply to this
//  * module as well.  Notably, js-cookie's functions are silent no-ops when
//  * there is no DOM — they do not throw noisy errors.
//  */

// /**
//  * The name of the cookie used to store the Firebase auth token.
//  */
// export const FIREBASE_AUTH_TOKEN_KEY = 'edvo-firebase-auth-token';

// /**
//  * Return the top level domain or null, depending on environment.
//  */

// /**
//  * Set a cookie scoped to Edvo.
//  *
//  * The cookie will have the following characteristics:
//  *
//  * - `domain` set to value returned by `getTLD`
//  * - `sameSite` set to 'None`
//  * - `secure` set to true
//  * - `path` set to `/`
//  *
//  * @param name the cookie's name
//  * @param value the cookie's value
//  * @param expires time-to-live in days
//  */
// export function setCookie(name: string, value: string, expires = 100) {
//   const domain = getTLD();
//   const cookieOpts: Cookie.CookieAttributes = {
//     path: '/',
//     sameSite: 'None',
//     secure: true,
//     expires,
//   };
//   if (domain) {
//     cookieOpts.domain = domain;
//   }
//   Cookie.set(name, value, cookieOpts);
// }

// /**
//  * Set the Firebase auth token cookie.
//  *
//  * @param token auth token value
//  */
// export function setAuthToken(token: string) {
//   setCookie(FIREBASE_AUTH_TOKEN_KEY, token);
// }

// /**
//  * Return the cookie's value, or `null` if it can't be retrieved.
//  *
//  * @param name cookie name
//  */
// export function getCookie(name: string) {
//   return Cookie.get(name) || null;
// }

// /**
//  * Return the Firebase auth token value, or null.
//  */
// export function getAuthToken() {
//   return getCookie(FIREBASE_AUTH_TOKEN_KEY);
// }

// /**
//  * Invalidate a cookie using js-cookie's `remove` function.
//  *
//  * @param name cookie name
//  */
// export function eraseCookie(name: string, expires = 100) {
//   const domain = getTLD();
//   const cookieOpts: Cookie.CookieAttributes = {
//     path: '/',
//     sameSite: 'None',
//     secure: true,
//     expires,
//   };
//   if (domain) {
//     cookieOpts.domain = domain;
//   }
//   Cookie.remove(name, cookieOpts);
// }

// /**
//  * Invalidate the Firebase auth token.
//  */
// export function eraseAuthToken() {
//   eraseCookie(FIREBASE_AUTH_TOKEN_KEY);
// }
