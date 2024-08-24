import { useEdvoObj } from '@edvoapp/util';
import { useEffect, useMemo } from 'preact/hooks';
import { Annotator } from '../../../service';
import { TopicSpace } from '../../../viewmodel';
import { PdfDom } from '../../pdf-view/pdf-dom';
import { PdfView } from '../../pdf-view/pdf-view';
import { DisplayModuleProps } from './body-content';

export const Pdf = ({ node }: DisplayModuleProps) => {
  const highlightAgent = useEdvoObj(() => new Annotator.HighlightAgent(), []);
  const pdfDom = useEdvoObj(() => new PdfDom(), []);
  const topicSpace = useMemo(() => node.closest((n) => n instanceof TopicSpace) as TopicSpace | undefined, [node]);

  if (!topicSpace) throw 'must have a TopicSpace parent';

  const highlighter = useEdvoObj(
    () =>
      new Annotator.Highlighter.Pdf({
        highlightAgent,
        pdfDom,
        viewport: topicSpace.viewportState.value,
      }),
    [highlightAgent, pdfDom, topicSpace],
  );

  useEffect(() => {
    void node.waitForDomElement().then((channelNode) => {
      const transport = new Annotator.Transport.DOM(channelNode);
      node.highlightManager.bindTransport(transport);
      highlightAgent.bindTransport(transport);
    });
  }, [node]);

  return (
    <PdfView
      vertex={node.vertex}
      node={node}
      highlighter={highlighter}
      pdfDom={pdfDom}
      ref={(r: any) => {
        node.safeBindDomElement(r);
        if (r) {
          pdfDom.establishOuterContainer(r);
        }
      }}
    />
  );
};
