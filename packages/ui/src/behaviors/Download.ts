import { Model, globalStore } from '@edvoapp/common';

import { ActionGroup, Behavior } from '../service';
import * as VM from '../viewmodel';
import { raiseError } from '../utils';

export async function handleDownload(property: Model.Property, vertex: Model.Vertex) {
  const url = await property.contentUrl();
  if (!url) return raiseError('Could not generate contentUrl for item');

  const fileName = vertex.name.value ?? 'Untitled';

  const xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.onload = function (event) {
    const blob = xhr.response;
    const url = window.URL.createObjectURL(blob);
    triggerDownload(url, fileName);
    window.URL.revokeObjectURL(url);
  };
  xhr.open('GET', url);
  xhr.send();
}

export class Download extends Behavior {
  getActions(originNode: VM.Node): ActionGroup[] {
    const member = originNode.closestInstance(VM.Member);
    const card = originNode.closestInstance(VM.MemberBody);
    const item = originNode.closestInstance(VM.TopicItem);
    const content = item
      ? { property: item.bodyProperty, vertex: item.vertex }
      : member
      ? member.body.value?.content
      : card
      ? card.content
      : null;

    if (!content || !member) return [];

    const { property: obs, vertex } = content;
    const property = obs.value;
    if (!property) return [];
    // const { contentType } = property;

    return [
      {
        label: item ? 'Item' : 'Card',
        actions: [
          {
            label: 'Download',
            apply: async () => {
              await handleDownload(property, vertex);
            },
          },
        ],
      },
    ];
  }
}

function getNameProperty(vertex: Model.Vertex) {
  return vertex
    .filterProperties({
      role: ['name'],
      contentType: 'text/plain',
      userID: [globalStore.getCurrentUserID()],
    })
    .filterObs((p: Model.Property) => p.status.value === 'active')
    .idx(0);
}

function triggerDownload(url: string, name: string) {
  const element = document.createElement('a');
  element.href = url;
  element.setAttribute('download', name);
  element.click();
}
