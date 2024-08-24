import { Model } from '@edvoapp/common';
import { NodeCA, Node } from './../base';

interface LaunchCA extends NodeCA<Node> {
  vertex: Model.Vertex | null;
}

export class Launch extends Node {
  vertex: Model.Vertex | null;
  constructor(args: LaunchCA) {
    super(args);
    this.vertex = args.vertex;
  }
  static new(args: LaunchCA) {
    const me = new Launch(args);
    me.init();
    return me;
  }
  async getLaunchUrl() {
    const token = await this.context.authService.generateAuthToken();
    if (!token) return null;
    const welcomeSpaceVertex = await this.context.authService.getWelcomeSpaceVertex();
    const url = new URL('edvo://open');
    const sp = new URLSearchParams(url.search);

    if (welcomeSpaceVertex && !(await welcomeSpaceVertex.getLastVisitEvent())) {
      sp.set('topicId', welcomeSpaceVertex.id);
    } else if (this.vertex) {
      sp.set('topicId', this.vertex.id);
    }
    sp.set('token', token);

    url.search = sp.toString();
    return url.toString();
  }
}
