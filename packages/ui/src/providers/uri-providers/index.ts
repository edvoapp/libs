import { YoutubeUriProvider } from './youtube';

const uriProviders = [YoutubeUriProvider];

export function getEmbedUriProvider(url: string) {
  for (let i = 0, l = uriProviders.length; i < l; i++) {
    const Class = uriProviders[i];
    const matched = Class.match(url);
    if (matched) return Class;
  }
  return null;
}

export async function convertToEmbedUri(url: string): Promise<string | null> {
  const c = getEmbedUriProvider(url);
  if (c) return await c.getEmbedUri(url);
  return null;
}
