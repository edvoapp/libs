const env = process.env.NODE_ENV;

const webappUrlProduction = 'https://app.edvo.com';
const webappUrlStaging = 'https://app-staging.edvo.com';
const webappUrlNightly = 'https://app-nightly.edvo.com';
const webappUrlDev = 'http://localhost:4000';

const apiEndpointUrlProduction = 'https://app.edvo.com';
const apiEndpointUrlStaging = 'https://app-staging.edvo.com';
const apiEndpointUrlNightly = 'https://app-nightly.edvo.com';
const apiEndpointUrlDev = 'http://localhost:4103';

const serverUrlProduction = 'https://api.edvo.com';
// const serverUrlStaging = 'https://api.edvo.com';
// const serverUrlNightly = 'https://app-nightly.edvo.com';
const serverUrlDev = 'http://localhost:3000';

const extensionIDProduction = 'mlcafhmppgdgmjgjdlecfoodkajhllbo';
const extensionIDNightly = 'imaabbellfaodedgjkeffhgdleelbfph';
const extensionIDStaging = 'cfhkglnoegjhcdpcchfobobdjnfcaieg';

const baseExtensionURL = 'https://chrome.google.com/webstore/detail/personal-learning-by-edvo';

function getExtensionID() {
  switch (env) {
    case 'staging':
      return extensionIDStaging;
    case 'production':
      return extensionIDProduction;
    case 'nightly':
    case 'development':
    case 'test':
    default:
      return extensionIDNightly;
  }
}

function getWebappUrl() {
  switch (env) {
    case 'staging':
      return webappUrlStaging;
    case 'production':
      return webappUrlProduction;
    case 'nightly':
      return webappUrlNightly;
    case 'development':
    case 'test':
    default:
      return webappUrlDev;
  }
}

function getApiEndpoint() {
  switch (env) {
    case 'staging':
      return apiEndpointUrlStaging;
    case 'production':
      return apiEndpointUrlProduction;
    case 'nightly':
      return apiEndpointUrlNightly;
    case 'development':
    case 'test':
    default:
      return apiEndpointUrlDev;
  }
}

function getServerUrl() {
  switch (env) {
    case 'staging':
    case 'nightly':
    case 'production':
      return serverUrlProduction;
    case 'development':
    case 'test':
    default:
      return serverUrlDev;
  }
}

const CAS_BUCKET = 'edvo-cas-1';

function getCasBucket() {
  return CAS_BUCKET;
}

function getWelcomeTopicId() {
  switch (env) {
    //TODO replace for local testing
    case 'development':
      // pick a random topic and hard code it here, leave it committed as null though
      return null;
    case 'nightly':
    case 'staging':
    case 'production':
      return 'OC2wLQY1sGEaHsoAEtm0';
    default:
      return null;
  }
}

function getWelcomeTemplateIds() {
  switch (env) {
    case 'development':
    case 'test':
      return {
        getStarted: '4vr60inFXmee9dBPaUnf',
        others: ['0WAUZzgHsgJ6Qy7f3wb0', '8IhAGI2SUKYKvdfziMQH'],
      };
    default:
      return {
        getStarted: 'fdmTYT7aJrCoGzyHQTy4',
        others: [
          '99tx1rYjD7NXa0swX3p0', // trip planning
          'rfNjdhYcGcNCMde8bfjN', // good morning
          '2KrPpPDWN1vrHIQKFQIW', // health and wellness
          '5VqTVz4cQowXFF6aSZaJ', // reading list
          'HAnyrYkSwXB1RisFH7b5', // angel investments
          'IxQoizqRbtchvKH1pj4c', // get inspired
        ],
      };
  }
}

// HACK: this will go away
function getHardCodedFocusMembers(): Record<string, string> {
  switch (env) {
    case 'nightly':
    case 'staging':
    case 'production':
      return {
        OC2wLQY1sGEaHsoAEtm0: 'JcmTjmsBmWLDLa30Cqcb',
        '9MD38DYsYYRPW4RA5lVt': '2eZVnweRAVYJkJIHfztk',
        FaNUvLBEYjEuezXxnCAt: 'F1kqd4fdJEKP5cWv4Lc0',
        '72InyM5n89TNR7VIjdyr': 'redrtAhsqJsJaX4qgLzv',
      };
    default:
      return {};
  }
}

function getWebappMatchers() {
  return [
    'http://localhost:4000',
    'http://localhost:4103',
    'https://app-nightly.edvo.com',
    'https://app-staging.edvo.com',
    'https://app.edvo.com',
  ];
}

function testWebApp(input?: string) {
  if (!input) return false;
  return getWebappMatchers().some((url) => input.includes(url));
}

function isElectron() {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.indexOf(' electron/') > -1;
}

export const config = {
  env,
  appVersion: process.env.APP_VERSION as string,
  webappUrl: getWebappUrl(),
  apiEndpointUrl: getApiEndpoint(),
  serverUrl: getServerUrl(),
  casBucket: getCasBucket(),
  extensionID: getExtensionID(),
  extensionURL: `${baseExtensionURL}/${getExtensionID()}`,
  webappMatchers: getWebappMatchers(),
  testWebApp,
  isElectron: isElectron(),
  welcomeTemplateIds: getWelcomeTemplateIds(),
  // HACK: the following two will go away
  welcomeTopicId: getWelcomeTopicId(),
  hardCodedFocusMembers: getHardCodedFocusMembers(),
};
