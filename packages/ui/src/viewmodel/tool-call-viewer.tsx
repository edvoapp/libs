import { Model } from '@edvoapp/common';
import { FloatingPanel, FloatingPanelCA, PositionType } from './floating-panel';
import { globalContext } from './base';
import { MemoizeOwned, OwnedProperty, WeakProperty, useAwait, useObserveValue, useEdvoObj } from '@edvoapp/util';
import { FunctionComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import ReactJson from 'react-json-view';

interface CA {
  vertex: Model.Vertex;
}

export class ToolCallViewer extends FloatingPanel {
  @OwnedProperty
  vertex: Model.Vertex;

  constructor({ vertex }: CA) {
    super({
      parentNode: globalContext().rootNode!,
    });
    this.vertex = vertex;
  }

  position: PositionType = 'center';
  closable = true;

  /** Spawn a new ToolCallViewer */
  static spawn(args: CA) {
    const me = new ToolCallViewer(args);
    me.init();
    return me;
  }

  @MemoizeOwned()
  get name() {
    return this.vertex
      .filterProperties({
        role: ['body'],
        contentType: 'text/plain',
        userID: this.visibleUserIDsForDescendants,
      })
      .firstObs()
      .mapObs((p) => p && p.text);
  }

  async get_request_json() {
    return this.vertex.getJsonPropValues('tool_call');
  }

  async get_response_json() {
    return this.vertex.getJsonPropValues('tool_call_response');
  }

  get header() {
    return Header;
  }

  get panelInner(): FunctionComponent<{ node: ToolCallViewer }> {
    return Inner;
  }
}

function Header({ node }: { node: ToolCallViewer }) {
  const name = useObserveValue(() => node.name, [node]);
  return (
    <h1 className="font-semibold">
      Tool Call Viewer - {name} / {node.vertex.id}
    </h1>
  );
}

interface PropertyType {
  function?: {
    name: string;
    arguments: string;
  };
  content?: string;
}

function Inner({ node }: { node: ToolCallViewer }) {
  useEdvoObj(() => node, [node]);

  const request = useAwait(() => node.get_request_json(), [node]);
  const response = useAwait(() => node.get_response_json(), [node]);

  const [requestJson, setRequestJson] = useState<PropertyType | null>(null);
  const [responseJson, setResponseJson] = useState<PropertyType | null>(null);

  useEffect(() => {
    if (request && (request as PropertyType).function?.arguments) {
      try {
        const parsedRequestJson = JSON.parse((request as PropertyType).function!.arguments);
        setRequestJson(parsedRequestJson);
      } catch (error) {
        console.error('Error parsing request JSON:', error);
      }
    }
    if (response && (response as PropertyType).content) {
      try {
        const parsedResponseJson = JSON.parse((response as PropertyType).content!);
        setResponseJson(parsedResponseJson);
      } catch (error) {
        console.error('Error parsing response JSON:', error);
      }
    }
  }, [request, response]);

  if (!requestJson || !responseJson) return null;

  return (
    <div className="flex flex-col justify-center gap-1 p-4 max-w-full">
      <b>Request</b>
      <ReactJson src={requestJson} />
      <b>Response</b>
      <ReactJson src={responseJson} />
    </div>
  );
}
