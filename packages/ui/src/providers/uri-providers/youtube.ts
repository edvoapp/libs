import { wait } from '@edvoapp/util';

const META_ROOT = 'https://www.youtube.com/oembed';

export class YoutubeUriProvider {
  static match(s: string): Boolean {
    return !!s.match(/youtu/gi)?.length;
  }

  static async getEmbedUri(s: string) {
    let resp;
    try {
      resp = (await Promise.race([
        (await fetch(`${META_ROOT}?url=${s}`)).json(),
        wait(500).then(() => {
          throw new Error('timeout');
        }),
      ])) as { html: string };
    } catch (e) {
      return null;
    }

    if (!resp?.html) return null;

    //get src from html response of the iframe
    const [_, uri] = /src="(.*?)"/.exec(resp.html) || [];
    if (!uri) return null;

    return uri;
  }
}
