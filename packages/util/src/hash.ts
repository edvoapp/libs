import CryptoJS from 'crypto-js';

export function generateSHA256Hash(input: string) {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex);
}

/**
 * Normalizes a given URL by trimming leading and trailing whitespaces,
 * and lowercasing the protocol and host from the URL string.
 *
 * @param {string} url - The URL to be normalized.
 * @return {string} - The normalized URL string.
 *
 * examples:
 *
 * normalize('http://localhost:4100/firestore/default/data/vertex/E28GkqOQ1hOrRkcsoQVA/property/5yV8xesB2bxL4VurjuM9') ===
 * normalize('HTTP://localhost:4100/firestore/default/data/vertex/E28GkqOQ1hOrRkcsoQVA/property/5yV8xesB2bxL4VurjuM9') // true
 *
 * normalize('http://localhost:4100/firestore/default/data/vertex/E28GkqOQ1hOrRkcsoQVA/property/5yV8xesB2bxL4VurjuM9') ===
 * normalize('HTTP://localhost:4100/firestore/default/data/vertex/e28gkqOQ1hOrrkcsoqva/property/5yV8xesB2bxL4VurjuM9') // false
 */
export function normalizeUrl(url: string) {
  try {
    url = url.trim();
    const u = new URL(url);
    const parsedUrl = new URL(url.toLowerCase());
    u.protocol = parsedUrl.protocol;
    u.host = parsedUrl.host;
    return u.toString();
  } catch (err) {
    console.error('Invalid URL', url, err);
  }
}
