// may want to move this elsewhere at some point
import { Model, subTrxWrap, TrxRef, trxWrap } from '@edvoapp/common';
import { CloneContext } from '../utils';
import * as VM from '../viewmodel';
import { Guard } from '@edvoapp/util';
import { WebappExtensionBridge } from '..';

export async function testTemplate() {
  await trxWrap(async (trx) => {
    const cloneContext = new CloneContext(trx);
    const vmContext = new VM.ViewModelContext(
      VM.globalContext().authService,
      VM.globalContext().authService.extBridge as WebappExtensionBridge,
      true,
    );
    const vertex = await VM.createTopicSpaceFromTemplateId('jcLrYIeFmFA5fyKwJsxE', vmContext, cloneContext);
    vertex.visit(trx);
    vertex.touch(trx);
  });
}

export async function createTopicSpaceFromTemplateId(
  templateVertexID: string, // <- part 1 of the "template"
  context: VM.ViewModelContext,
  cloneContext: CloneContext,
): Promise<Model.Vertex> {
  const templateNode = VM.TSPage.new({
    // <- this is part 2 of the "template"
    context,
    vertex: Model.Vertex.getById({ id: templateVertexID }),
    parentNode: null,
  });
  // const templateNode = VM.Outline.new({
  //   vertex: Model.Vertex.getById({ id: templateVertexID }),
  //   parentNode: null,
  //   context: context,
  // });

  return Guard.while({ templateNode, cloneContext }, async ({ templateNode, cloneContext }) => {
    const spaceVertex = cloneContext.cloneVertex(templateNode.vertex);
    await templateNode.applyAsTemplate(spaceVertex, cloneContext);
    return spaceVertex;
  });
}

export async function applyTopicSpaceTemplate(
  spaceVertex: Model.Vertex,
  templateVertexID: string, // <- part 1 of the "template"
  context: VM.ViewModelContext,
) {
  // The term "template" is defined as:
  // A vertex PLUS a root Node (which you can read)
  //
  // THis is to which is to be traversed according to the ViewModel rules
  // to use said ViewModel tree to clone all visually descendent DATAMODEL records (recursively) into the target vertex.

  const templateVertex = Model.Vertex.getById({ id: templateVertexID });
  await Guard.while({ templateVertex, spaceVertex }, async ({ templateVertex, spaceVertex }) => {
    return trxWrap(async (trx) => {
      await Guard.while(
        {
          templateNode: VM.TopicSpace.new({
            // <- this is part 2 of the "template"
            context,
            vertex: templateVertex,
            parentNode: null,
          }),
          cloneContext: new CloneContext(trx),
          spaceVertex,
        },
        async ({ templateNode, cloneContext, spaceVertex }) => {
          await templateNode.applyChildrenAsTemplate(
            spaceVertex,
            cloneContext,
            // TODO: I can't remember why this is here
            // (child: Node) => {
            //   return !(
            //     child instanceof PropertyNode && child.property?.role.includes('name')
            //   );
            // },
          );
        },
      );
    });
  });
}
