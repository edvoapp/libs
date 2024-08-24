import { VM } from '../../..';
import { TopicSpaceComponent } from '../../../pages/topic-space/topic-space-component';

interface Props {
  node: VM.TopicSpace | VM.InfinityMirror;
}

export const Portal = ({ node }: Props) => {
  if (node instanceof VM.TopicSpace) {
    return (
      <div className="topic-subspace">
        <TopicSpaceComponent node={node} />
      </div>
    );
  }

  if (node instanceof VM.InfinityMirror) {
    return (
      <div className="topic-subspace infinity-mirror">
        I am the Alpha and the Omega
        <br />
        All-knowing, All-seeing
        <br />I am Larry, Lizard of Learning
      </div>
    );
  }
  return null;
};
