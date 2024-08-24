import { MatchEntity, Model, TrxRef, trxWrap, globalStore } from '@edvoapp/common';
import { Behaviors } from '@edvoapp/ui';

// The responsibility of WebEntityMatcher is to scan the Document/DOM and identify things which are prospective entities
// and retrieve the s for those which are already memorialized in the database

// At present, HighlightManager is reponsible for applying highlight s back to the pagegit
// Those are entities too, but they require matching using parent entity + selectors rather than entity_matching_rules.
// As such we have decided for at least the time being that WebEntityMatcher will NOT have responsibility for this
// There is however an argument that maybe it should. We are deferring this consideration to a later date

// These are the last rules to be evaluated:
const defaultMatchers: MatchEntity.Matcher[] = [
  {
    type: 'document', // document is a singleton entity
    // type: 'node' // there could be multiple nodes in a document which are entities (IE embedded tweets, youtube videos, etc)
    rule: 'allow',
    selectors: {},
  },
];

// TODO - load entity_matching_rules and prefix this list
const entityMatchRulesFromDb: MatchEntity.Matcher[] = [];
export const matchers = [...entityMatchRulesFromDb, ...defaultMatchers];

// what's the plan?
// iterate over matchers in order, and take the first matching rule per entity
// If that rule is an allow, then include it in the ObservableList of matched entities within the WebEntityMatcher
// If that rule is a deny, then do not include it in the list and ignore that entity for the remaining rules in the list
export interface DocumentAttrs {
  url: string;
  title: string;
  img: string;
}

export class WebEntityMatcher {
  static async findVertexByUrl(url: string): Promise<Model.Vertex | null> {
    const kind = 'resource';
    let query = await globalStore
      .createQuery<Model.data.VertexData>('vertex')
      .where('kind', '==', kind)
      .where('parentVertexID', '==', null)
      .where(`attributes.url`, '==', url)
      .get();
    const [snapshot] = query.docs;
    if (snapshot) return Model.Vertex.hydrate({ snapshot });
    return null;
  }

  static getAttributes() {
    const url = WebEntityMatcher.getDocumentUrl();
    const title = WebEntityMatcher.getDocumentTitle() || 'Untitled Page';
    const img = WebEntityMatcher.getDocumentThumbnail();
    return { url, title, img };
  }

  async findDocument() {
    const url = WebEntityMatcher.getDocumentUrl();
    return WebEntityMatcher.findVertexByUrl(url);
  }

  static upsertDocument(attrs: DocumentAttrs): Promise<string> {
    return new Promise((resolve, reject) => {
      void trxWrap(async (trx: TrxRef) => {
        const { url, title } = attrs;
        const name = title || url;
        try {
          const doc = await Behaviors.upsertVertex({ trx, name, url });
          const id = doc.docRef.id;
          console.log(`WebEntityMatcher: Current page is ${id}`);
          resolve(id);
        } catch (e) {
          reject(e);
        }
      });
    });
  }
  static getOgProperty(type: string) {
    const tags = document.getElementsByTagName('meta');
    let res = '';

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      if (tag.getAttribute('property') === `og:${type}`) {
        res = tag.getAttribute('content') || '';
        break;
      }
    }
    return res;
  }
  static getDocumentThumbnail() {
    return WebEntityMatcher.getOgProperty('image');
  }
  static getDocumentTitle() {
    const { title } = document;
    return title;
  }
  static getDocumentUrl() {
    const windowUrl = window.location.href.split(/(3001|8080|com|135)\/(?=http)/).reverse()[0];
    return windowUrl;
  }

  static addDocumentProperties(trx: TrxRef, vertex: Model.Vertex, attrs: DocumentAttrs) {
    const { url, title, img } = attrs;
    const pdf = url.includes('.pdf') ? url : '';
    const documentAttributes = { url: pdf ? '' : url, title, img, pdf };
    Object.entries(documentAttributes).forEach(([key, content]: string[]) => {
      if (!content) return;
      const contentType = (() => {
        switch (key) {
          case 'url':
            return 'text/x-uri';
          case 'pdf':
            return 'application/pdf';
          case 'img':
            return 'image';
          case 'title':
          case 'highlightSelectorSet':
          default:
            return 'text/plain';
        }
      })();
      let role: string[] = [];
      if (['url', 'pdf'].includes(key)) role.push('body');

      if (key === 'pdf') {
        trx.addOp(vertex, async (tx: TrxRef) => {
          const contentArrayBuffer = await (await fetch(url)).arrayBuffer();
          await Model.Property.createAsync({
            trx: tx,
            parent: vertex,
            contentArrayBuffer,
            contentType,
            role,
          });
        });
      } else {
        role = role.concat(['reference', `${key}Reference`]);
        vertex.createProperty({
          trx,
          role,
          contentType,
          initialString: content,
        });
      }
    });
  }
}
