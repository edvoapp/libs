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

export class JsonViewer extends FloatingPanel {
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

  /** Spawn a new JsonViewer */
  static spawn(args: CA) {
    const me = new JsonViewer(args);
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

  async get_debug_json() {
    return this.vertex.getJsonPropValues('debug_logs');
  }

  get header() {
    return Header;
  }

  get panelInner(): FunctionComponent<{ node: JsonViewer }> {
    return Inner;
  }
}

function Header({ node }: { node: JsonViewer }) {
  const name = useObserveValue(() => node.name, [node]);
  return (
    <h1 className="font-semibold">
      JSON Viewer - {name} / {node.vertex.id}
    </h1>
  );
}

function Inner({ node }: { node: JsonViewer }) {
  useEdvoObj(() => node, [node]);

  const debugLogs = useAwait(() => node.get_debug_json(), [node]);

  return (
    <div className="flex flex-col justify-center gap-1 p-4">
      <b>JSON</b>
      <ReactJson
        src={debugLogs}
        collapsed={false}
        shouldCollapse={(field: any) => {
          return field.name === 'behaviors';
        }}
      />
    </div>
  );
}
