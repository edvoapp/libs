import { publishMessageToInner, useSubscribeOnMount } from './pubsub';

export const useLocation = () => {
  // TODO: also send message to inner if the href changes
  useSubscribeOnMount(
    'POLL_LOCATION',
    () => {
      // this is a very very naive way of stripping any proxy data from the URL
      const url = window.location.href.split(/(3001|8080|com|135)\/(?=http)/).reverse()[0];

      const { title } = document;
      const tags = document.getElementsByTagName('meta');
      let img = '';

      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (tag.getAttribute('property') === 'og:image') {
          img = tag.getAttribute('content') || '';
          break;
        }
      }
      publishMessageToInner('LOCATION_UPDATE', { url, title, img });
    },
    [],
  );
};
