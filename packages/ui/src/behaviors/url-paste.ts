import { config, globalStore, Model, subTrxWrap, TrxRef } from '@edvoapp/common';
import { convertToEmbedUri } from '../providers/uri-providers';
import { Behavior, DEFAULT_PORTAL_DIMS, DEFAULT_WEBCARD_DIMS, EventNav, isMetaClick } from '../service';
import { Node, Position, VertexNode } from '../viewmodel';
import { DispatchStatus, VM } from '..';
import { MemberAppearance } from './appearance-type';

export class UrlPaste extends Behavior {
  handlePaste(eventNav: EventNav, e: ClipboardEvent, node: Node): DispatchStatus {
    const plainText = e.clipboardData?.getData('text/plain') || '';

    let url = UrlPaste.urlTidy(plainText);

    if (url === null || !(node instanceof VertexNode)) return 'continue';

    const focused = eventNav.focusState.currentFocus;

    const space = focused?.closestInstance(VM.TopicSpace);

    const position = space?.focusCoordinates.value ?? space?.viewportState.value.center;
    if (!position) return 'decline';
    void addTopicMemberFromUrl(null, node.vertex, url, position);

    return 'continue';
  }

  handleKeyDown(eventNav: EventNav, e: KeyboardEvent, node: Node): DispatchStatus {
    // crucially, we do not execute paste here, because we need a browser paste event to grab clipboard data
    const metaClick = isMetaClick(e);
    if (metaClick && e.key === 'v') return 'native';
    return 'decline';
  }

  static urlTidy(maybeUrl?: string): URL | null {
    if (!maybeUrl) return null;
    try {
      const url = new URL(maybeUrl);
      if (['http:', 'https:'].includes(url.protocol)) return url;
      return null;
    } catch {
      return null;
    }
  }
}

export async function upsertVertex({
  trx,
  name,
  url,
}: {
  trx: TrxRef;
  name: string;
  url: string;
}): Promise<Model.Vertex> {
  const vertex = await Model.Vertex.upsert({
    trx,
    kind: 'resource',
    parent: null,
    name,
    attributes: { url },
    onCreate: (trx: TrxRef, vertex: Model.Vertex) => {
      trx.addOp(vertex, async (trx: TrxRef) => {
        const { contentType } = await globalStore.callServerFunction('getContentTypeFromUrl', { url });

        if (contentType === 'application/pdf') {
          await Model.Property.createAsync({
            trx,
            role: ['body'],
            parent: vertex,
            contentUrl: url,
            contentType,
            // uploadTaskRef: (uploadTask: firebase.storage.UploadTask) => {
            //   uploadTask.on('state_changed', {
            //     next: () => this.onStateChange(uploadTask),
            //     error: (e) => this.onUploadError(e, uploadTask),
            //   });
            // },
          });
        } else {
          vertex.createProperty({
            trx,
            role: ['body'],
            contentType: 'text/x-uri',
            initialString: url,
          });
        }

        if (config.isElectron) {
          await vertex.setJsonPropValues<MemberAppearance>(
            'appearance',
            {
              type: 'browser',
            },
            trx,
          );
        }
      });
    },
  });
  await createEmbedProps(vertex, url, trx);
  return vertex;
}

export function addTopicMemberFromUrl(
  trx: TrxRef | null,
  parentVertex: Model.Vertex,
  url?: URL | null,
  position?: Position,
  title?: string,
) {
  return subTrxWrap(trx, async (trx: TrxRef) => {
    if (!url) return false;
    // TODO - open a new case to load the url in a temporary/hidden iframe
    // and use the extension to fetch content type, title, and canonical url
    // NOTE: This could be an image, in which case we're doing the wrong thing
    const canonical_url = url.toString();
    const name = title ?? `Untitled - ${url.host}`;
    const isEdvoUri = config.webappMatchers.some((u: string) => canonical_url.includes(u));

    if (isEdvoUri) {
      const [, topicId] = url.pathname.split('topic/');
      if (!topicId) return false;
      const vertex = Model.Vertex.getById({ id: topicId });

      if (!vertex) return false;

      vertex.createEdge({
        trx,
        role: ['member-of', 'tag'],
        target: parentVertex,
        meta: {
          x_coordinate: position?.x || null,
          y_coordinate: position?.y || null,
          ...DEFAULT_PORTAL_DIMS,
        },
      });

      return true;
    }

    const vertex = await upsertVertex({ trx, name, url: canonical_url });

    // 6. Determine currently focused screen coordinate by calling evtNav.getCurrentFocusCoordinate()
    // let focusedCoords = this.evtNav.getCurrentFocusCoordinate(); <- TODO
    const { x = 0, y = 0 } = position || {};
    const meta = {
      x_coordinate: x ? x : null,
      y_coordinate: y ? y : null,
      display: 'content' as const,
      ...DEFAULT_WEBCARD_DIMS,
    };
    vertex.createEdge({
      target: parentVertex,
      trx,
      role: ['member-of', 'tag'],
      meta,
    });
    return true;
  });
}

export async function createEmbedProps(vertex: Model.Vertex, url: string, trx: TrxRef) {
  const embedUri = await convertToEmbedUri(url);
  if (!embedUri) return;

  vertex.createProperty({
    trx,
    role: ['body'],
    contentType: 'text/x-embed-uri',
    initialString: embedUri,
  });
  vertex.createProperty({
    trx,
    role: ['content-mode'],
    contentType: 'text/plain',
    //set embed as default
    initialString: 'embed',
  });
}
