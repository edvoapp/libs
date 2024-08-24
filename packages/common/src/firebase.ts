// RULE: This file can only import things from the firebase npm package

import firebase from 'firebase/compat/app';
// import 'firebase/compat/analytics';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import 'firebase/compat/storage';
import 'firebase/compat/database';
import { useState, useEffect } from 'preact/hooks';
import { globalStore } from './dataset';

export type Database = firebase.database.Database;
export const database = firebase.database;

export const firebaseNow = () => firebase.firestore.Timestamp.now();

// ANCHOR: Env

/**
 * This enum describes the environment that the API is being consumed in. Right now, we
 * have three different firebase projects (dev, staging, prod), and two different clients
 * which will be using them (webapp and extension). This gives six different init
 * environments we can use. In the future, there may be more, or there may be less; as we
 * add or remove various instances of the application, we should update this enum and the
 * init function.
 */
export enum Env {
  Dev = 'dev',
  Test = 'test',
  Staging = 'staging',
  Nightly = 'nightly',
  Prod = 'prod',
}

// ANCHOR: init

/**
 * Arguments for the init function.
 */
export interface InitArgs {
  /**
   * Indicates the environment that the API will be operating in. This translates to the
   * firebase config to use when initializing the app. Each type is associated with a
   * different config.
   */
  env: Env;

  /**
   * Indicates whether or not to use emulators after initializing the application.
   * Emulators are used when you want to test out functionality without using remote
   * backends, be they production, staging, or whatever. The assumed default is false.
   */
  useEmulators?: boolean;
  hideAnalytics?: boolean;
}

/**
 * Initializes the firebase app. This must be run before any other API functions which use
 * firebase, which is pretty much all of them, so run it first before using any API
 * functions.
 *
 * TODO: The default storage buckets have been changed to the CAS buckets because
 * at this time, firebase has a bug which prevents accessing anything other than
 * the default bucket.  This means we can only use Firebase Storage for the CAS.
 */

const commonProdConfig = {
  apiKey: 'AIzaSyAXGT5h3y2VPBVqRKQzmFXdG5t8cFPe31c',
  authDomain: 'edvo-plm.firebaseapp.com',
  databaseURL: 'https://edvo-plm.firebaseio.com',
  projectId: 'edvo-plm',
  //storageBucket: 'edvo-plm.appspot.com',
  storageBucket: 'edvo-cas-1',
  messagingSenderId: '648498933456',
  appId: '1:648498933456:web:65734b78781a3015fcb8d5',
};

function getConfig(env: Env | string) {
  switch (env) {
    case Env.Dev:
    case Env.Test:
      // this actually doesn't matter if we're using emulators
      return {
        ...commonProdConfig,
        measurementId: 'G-9R842E8FYV',
      };
    case Env.Staging:
      return {
        ...commonProdConfig,
        measurementId: 'G-9R842E8FYV',
      };
    case Env.Prod:
    case Env.Nightly:
      return {
        ...commonProdConfig,
        measurementId: 'G-9R842E8FYV',
      };
    default:
      throw new Error(`Invalid env: ${env}`);
  }
}

export function getEnv(nodeEnv: string): Env {
  switch (nodeEnv) {
    case 'staging':
      return Env.Staging;
    case 'production':
      return Env.Prod;
    case 'nightly':
      return Env.Nightly;
    case 'test':
      return Env.Test;
    case 'development':
    default:
      return Env.Dev;
  }
}

export { firebase };
export const auth = () => firebase.auth();

export function init({ env, useEmulators, hideAnalytics }: InitArgs) {
  let _ = hideAnalytics;
  // Select the config to initialize with
  const config = getConfig(env);

  // Initialize the application
  firebase.initializeApp(config);

  // If using emulators, set those up
  if (useEmulators) {
    // firebase.setLogLevel('debug');
    // The ports used here should match those listed in the firebase.json config in
    // the root of the api package
    if (env === Env.Dev) {
      // This setting allows Firebase to work in Cypress.  Create env=test profile.
      console.log('Turning on `experimentalForceLongPolling`');
      firebase.firestore().settings({
        // experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
        host: '127.0.0.1:4102',
        ssl: false,
        merge: true,
      });
    } else {
      console.log('not test');
      // cannot have useEmulator and settings set at the same time
      firebase.firestore().settings({
        host: 'localhost:4102',
        // experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true,
        ssl: false,
        merge: true,
      });
    }
    firebase
      .auth()
      // @ts-expect-error TODO: This has a type issue when the previous line exists
      .useEmulator('http://127.0.0.1:4101', { disableWarnings: true });
    firebase.functions().useEmulator('127.0.0.1', 4104);
    firebase.storage().useEmulator('127.0.0.1', 4105);
    // TODO: this is kinda dumb, but it keeps erroring in the extension
    try {
      firebase.database().useEmulator('127.0.0.1', 9000);
    } catch (err) {
      console.warn('Failed to load realtime database', err);
    }
  }

  // We should test, and enable persistence, at least for the native app if not the browser app
  // firebase
  //   .firestore()
  //   .enablePersistence()
  //   .catch((err) => {
  //     if (err.code == 'failed-precondition') {
  //       // Multiple tabs open, persistence can only be enabled
  //       // in one tab at a a time.
  //       // ...
  //       console.warn(
  //         'FireStore persistence was not enabled due to a failed precondition',
  //         err,
  //       );
  //     } else if (err.code == 'unimplemented') {
  //       // The current browser does not support all of the
  //       // features required to enable persistence
  //       // ...
  //       console.warn(
  //         'FireStore persistence was not enabled due to insufficient browser supporg',
  //         err,
  //       );
  //     }
  //   });
  // if (!hideAnalytics) {
  // firebase.analytics();
  // }
}

export enum ClientID {
  webapp = 'webapp',
  extension = 'extension',
  native = 'native',
}

type VersionData = {
  allowed_versions: string[];
};
function initVersionListen(clientID: ClientID, onVersionChange: (allowed_versions: string[]) => void) {
  console.debug('initVersionListen', clientID);
  const docRef = globalStore.createDocRef<VersionData>('allowed_clients', clientID);
  globalStore.subscribeToDocument(docRef, (docSnap) => {
    const data = docSnap.data();
    console.debug('data', data);
    if (!data) return;
    onVersionChange(data.allowed_versions);
  });
}

export function useVersionCheck(clientID: ClientID, appVersion: string) {
  console.debug('appVersion', appVersion);
  const [versionPermitted, setVersionPermitted] = useState<boolean | null>(null);

  useEffect(() => {
    initVersionListen(clientID, (versions) => {
      let matches = false;
      for (let version of versions) {
        const regex = new RegExp(version);
        // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
        if (appVersion.match(regex)) {
          matches = true;
          break;
        }
      }
      setVersionPermitted(matches);
    });
  }, [clientID, appVersion]);
  return versionPermitted;
}

export async function signInAnonymously() {
  const auth = firebase.auth();
  await auth.signInAnonymously();
}
