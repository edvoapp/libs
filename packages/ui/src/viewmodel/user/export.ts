import { DocumentIterator } from './DocumentIterator';
import { MergedIterator } from './MergedIterator';
import { FileWriter, StreamingFileWriter } from '@edvoapp/util';
import { POSITION, TYPE, updateToast, createToast, dismissToast } from '../../service';
import { Model, globalStore } from '@edvoapp/common';

/**
 * TODO 1: [X] Implement Lexicographic sort for artifactPart and claimPart (individual queries are far too slow/expensive)
 * TODO 2: [x] Paginate these using Firestore "cursors"
 * TODO 3: [x] Figure out how to stream this to the browser
 *    Note: Streamsaver seems dubious https://www.npmjs.com/package/streamsaver
 * TODO 4: [ ] Implement streaming compression
 */
export async function doExport() {
  const vertexQuery = Model.Vertex.rawQuery({
    where: [],
    orderBy: ['id', 'asc'],
    limit: 100,
  });
  const propertyQuery = Model.Property.rawQuery({
    where: [],
    orderBy: ['parentID', 'asc'],
    limit: 100,
  });
  const edgesQuery = Model.Edge.rawQuery({
    where: [],
    orderBy: ['parentID', 'asc'],
    limit: 100,
  });

  const vertexIterator = new DocumentIterator(vertexQuery, 'id');
  const propertyIterator = new DocumentIterator(propertyQuery, 'parentID');
  const edgeIterator = new DocumentIterator(edgesQuery, 'parentID');

  const vertexMerger: VertexIter = new MergedIterator({
    vertex: vertexIterator,
    edges: edgeIterator,
    properties: propertyIterator,
  });

  try {
    const writer = await StreamingFileWriter.create({
      suggestedName: 'edvo-export.ndjson',
      types: [
        {
          description: 'Text file',
          accept: { 'text/plain': ['.txt'] },
        },
      ],
    });
    let toastId: string | number | null = null;
    try {
      toastId = createToast('Export in progress', {
        type: TYPE.INFO,
        autoClose: false,
        hideProgressBar: true,
        pauseOnFocusLoss: false,
        draggable: false,
        pauseOnHover: false,
        position: POSITION.TOP_CENTER,
        handleClick: async () => await writer.close(),
      });
      await writeVertices(writer, vertexMerger, toastId);
      await updateToast(toastId, {
        progress: 1,
        type: TYPE.SUCCESS,
        render: 'Successfully exported',
      });
      dismissToast(toastId, 3000);
    } catch (error) {
      if (toastId) {
        updateToast(toastId, {
          type: TYPE.ERROR,
          render: 'Export failed',
        });
      }

      console.error(error);
    } finally {
      writer.close();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Do nothing, user has closed the File Selector
    } else {
      console.error(error);
    }
  }
}

type VertexIterRecord = {
  vertex: DocumentIterator<Model.data.VertexData, 'id'>;
  edges: DocumentIterator<Model.data.EdgeData, 'parentID'>;
  properties: DocumentIterator<Model.data.PropertyData, 'parentID'>;
};
type VertexIter = MergedIterator<string, VertexIterRecord>;

function formatProperty(property: Model.data.PropertyData) {
  return {
    id: property.id,
    cipher: property.cipher,
    role: property.role,
    keyID: property.keyID,
    userID: property.userID,
    parentID: property.parentID,
    payload: property.payload,
    v: property.v,
    recipientID: property.recipientID,
    contentType: property.contentType,
    status: property.status,
    createdAt: globalStore.timestampToDate(property.createdAt).toISOString(),
    updatedAt: globalStore.timestampToDate(property.updatedAt).toISOString(),
  };
}

async function writeVertices(writer: FileWriter, iter: VertexIter, toastId?: string | number) {
  const linesPayload = [];
  let bytesWritten = 0;

  for (let next = await iter.next(); next && next.value; next = await iter.next()) {
    const { value } = next;
    const { vertex: [vertex] = [], edges, properties } = value;

    if (vertex) {
      const body = {
        ...vertex,
        id: vertex.id,
        edges: edges?.map(formatEdge),
        properties: properties?.map(formatProperty),
        createdAt: globalStore.timestampToDate(vertex.createdAt).toISOString(),
      };
      linesPayload.push({
        body,
        size: computeBodySize(body),
      });
    }
  }
  const totalBytes = linesPayload.reduce((acc, l) => (acc += l.size), 0);

  return Promise.all(
    linesPayload.map(async ({ body, size }) => {
      await writer.addLine(body);
      bytesWritten += size;

      if (toastId) {
        const progress = bytesWritten / totalBytes;
        console.log(progress);
        await updateToast(toastId, {
          progress,
          hideProgressBar: false,
        });
      }

      return body;
    }),
  );
}

function computeBodySize(body: Object) {
  return new TextEncoder().encode(JSON.stringify(body) + '\n').length;
}

function formatEdge(edge: Model.data.EdgeData) {
  return {
    // Better to do these as inclusion list, rather than an exclusion list. Fields gotten from main branch
    id: edge.id,
    cipher: edge.cipher,
    role: edge.role,
    kind: edge.kind,
    keyID: edge.keyID,
    userID: edge.userID,
    payload: edge.payload,
    meta: edge.meta,
    v: edge.v,
    recipientID: edge.recipientID,
    status: edge.status,
    createdAt: globalStore.timestampToDate(edge.createdAt).toISOString(),
    updatedAt: globalStore.timestampToDate(edge.updatedAt).toISOString(),
  };
}
