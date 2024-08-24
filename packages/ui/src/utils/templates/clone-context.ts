import { Model, TrxRef } from '@edvoapp/common';
import { EdvoObj } from '@edvoapp/util';

export class CloneContext extends EdvoObj {
  // These registries are to ensure that a single record only ever gets cloned exactly once
  // the "key" of the record is the record ID of the template (the source of the clone)
  // and the value is the newly created one that IS the clone
  clonedVertexMapping: Record<string, Model.Vertex> = {};
  clonedEdgeMapping: Record<string, Model.Edge> = {};
  clonedPropertyMapping: Record<string, Model.Property> = {};

  constructor(readonly trx: TrxRef) {
    super();
  }

  // each of these cloneX methods need to be idempotent -- if called twice,
  cloneVertex(templateVertex: Model.Vertex): Model.Vertex {
    // this keeps transclusions
    let clonedVertex = this.clonedVertexMapping[templateVertex.id];
    if (clonedVertex) return clonedVertex;

    clonedVertex = Model.Vertex.create({ trx: this.trx });
    // TODO: enabling this causes the Edge + Backref QOs to be prematurely considered loaded
    // Before we can reenable this, we will have to figure out how to determine whether the snapshot is from this or the from the server
    // And that's a big problem, because even if we are looking at the from cache flag on the snapshot, we don't get a second snapshot
    // with an empty list of changes in the case that the data from the snapshot *happened* to be representative of the current DB state.
    //
    // clonedVertex.createEdge({
    //   trx: this.trx,
    //   role: ['clone-of'],
    //   target: templateVertex,
    //   meta: {},
    // });
    this.managedReference(clonedVertex, 'cloned-vertex');
    this.clonedVertexMapping[templateVertex.id] = clonedVertex;
    return clonedVertex;
  }
  cloneProperty(
    parentVertex: Model.Vertex, // We assume that you won't give us the same property twice with different parentVertices
    templateProperty: Model.Property,
  ): Model.Property {
    let clonedProperty = this.clonedPropertyMapping[templateProperty.id];
    if (clonedProperty) return clonedProperty;
    const { role, contentType, text, contentId } = templateProperty;

    clonedProperty = parentVertex.createProperty({
      role,
      contentType,
      initialString: text.value,
      contentId: contentId || undefined,
      trx: this.trx,
    });
    this.managedReference(clonedProperty, 'cloned-property');
    this.clonedPropertyMapping[templateProperty.id] = clonedProperty;
    return clonedProperty;
  }

  cloneBackref(parentVertex: Model.Vertex, targetVertex: Model.Vertex, templateBackref: Model.Backref) {
    let existing = this.clonedEdgeMapping[templateBackref.edgeID];
    if (existing) return existing;

    const meta = templateBackref.meta.value || {};
    const role = templateBackref.role;
    const seq = templateBackref.seq.value;

    const clonedEdge = parentVertex.createEdge({
      target: targetVertex,
      meta,
      role,
      trx: this.trx,
      seq,
    });

    this.managedReference(clonedEdge, 'cloned-edge');
    this.clonedEdgeMapping[templateBackref.edgeID] = clonedEdge;
    return clonedEdge;
  }

  cloneEdge(targetVertex: Model.Vertex, parentVertex: Model.Vertex, templateEdge: Model.Edge): Model.Edge {
    let existing = this.clonedEdgeMapping[templateEdge.id];
    if (existing) return existing;

    const meta = templateEdge.meta.value || {};
    const role = templateEdge.role;
    const seq = templateEdge.seq.value;

    const clonedEdge = parentVertex.createEdge({
      target: targetVertex,
      meta,
      role,
      trx: this.trx,
      seq,
    });

    this.managedReference(clonedEdge, 'cloned-edge');
    this.clonedEdgeMapping[templateEdge.id] = clonedEdge;
    return clonedEdge;
  }
}
