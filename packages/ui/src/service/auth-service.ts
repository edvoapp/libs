import {
  AsyncFilterMapObservableList,
  AsyncMutex,
  EdvoObj,
  Guard,
  mapObsList,
  MemoizeOwned,
  Observable,
  ObservableList,
  ObservableReader,
  OwnedProperty,
  QueryString,
} from '@edvoapp/util';

import axios from 'axios';
import {
  Analytics,
  BrowserProfile,
  BrowserProfiles,
  config,
  Firebase,
  globalStore,
  Model,
  subTrxWrap,
  TrxRef,
  trxWrap,
  trxWrapSync,
} from '@edvoapp/common';

import Cookie from 'js-cookie';
import { adjectives, animals, colors, uniqueNamesGenerator } from 'unique-names-generator';
import { route } from 'preact-router';
import { BaseExtensionBridge } from './base-extension-bridge';
import * as VM from '../viewmodel';
import { WebappExtensionBridge } from './webapp-extension-bridge';
import { CloneContext } from '../utils';
import { ElectronAPI } from '../types/electron';
import { util } from 'prettier';
import skip = util.skip;

// import LogRocket from "logrocket";

interface Storage {
  set: (key: string, value: string) => void;
  get: (key: string) => Promise<string | null | undefined>;
  clear: (keys: string) => void;
}

export type InviteeSignupResponse = {
  status: string;
  email?: string;
};

let _globalAuthService: AuthService | undefined;

export function initGlobalAuthService(extBridge: BaseExtensionBridge, isExtension?: boolean, skipLogout?: boolean) {
  _globalAuthService = new AuthService(extBridge, isExtension, skipLogout).leak();
  window.authService = _globalAuthService;
  return _globalAuthService;
}

export function globalAuthService(): AuthService {
  if (_globalAuthService) return _globalAuthService;
  throw new Error('AuthService not initialized');
}

export class AuthService extends EdvoObj {
  @OwnedProperty
  userMutex = new AsyncMutex();
  interval: ReturnType<typeof setInterval> | null = null;

  // null means logged out, undefined means loading
  @OwnedProperty
  currentUserVertexObs: Observable<Model.Vertex | null | undefined>;
  isElectron: boolean;
  constructor(readonly extBridge: BaseExtensionBridge, readonly isExtension = false, readonly skipLogout = false) {
    super();

    const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
    this.isElectron = isElectron;

    let userLoaded: () => void;
    const loadUser = new Promise<void>((resolve) => (userLoaded = resolve));

    this.onCleanup(
      Firebase.firebase.auth().onAuthStateChanged((user) => {
        // when the popup script first opens you're not considered logged in
        if (!user && !skipLogout) {
          this.currentUserVertexObs.set(null);
        }
        // this is kinda silly but I think it's the only way to force other tabs/windows to get bumped to the login page
        if (this.currentUserVertexObs.value && !user) {
          void this.renewExtensionToken();
          return route('/auth/login');
        }
        if (this.ignoreAuthStateChange) return;

        this.fetchAndSetUserVertex(user);
        userLoaded();
        if (user) {
          Analytics.identify(user.uid);
        }
        void this.renewExtensionToken();
      }),
    );

    const currentUserVertexObs = new Observable<Model.Vertex | null | undefined>(undefined, () => loadUser);
    this.currentUserVertexObs = currentUserVertexObs;

    this.managedSubscription(currentUserVertexObs, (user) => {
      if (user) Analytics.identify(user.id);
    });

    const name = currentUserVertexObs.mapObs((user) => user?.getPlainTextPropValueObs('full-name'));
    const email = currentUserVertexObs.mapObs((user) => user?.getPlainTextPropValueObs('email'));

    this.managedSubscription(
      Observable.calculated((a) => a, { name, email }),
      ({ name, email }) => Analytics.identifyUser({ name, email }),
      true,
    );

    if (isElectron) {
      this.managedSubscription(currentUserVertexObs, (_) => this.upsertDefaultProfile());
    }

    // "token" is a JWT which we generate in a firestore function
    // ""

    void this.renewExtensionToken();
    this.initRefreshInterval();
  }

  protected cleanup() {
    if (this.interval) clearInterval(this.interval);
    super.cleanup();
  }

  async signInAnonymously() {
    await Firebase.signInAnonymously();
  }

  initRefreshInterval() {
    this.interval = setInterval(() => void this.renewExtensionToken(), 10 * 60 * 1000); // 10 min
  }

  private async redirectAfterAuth() {
    const params = QueryString.parse(window.location.search);
    if (params.returnToPreviousTab) {
      this.extBridge.sendExtensionMessage('RETURN_TO_PREVIOUS_TAB');
    }

    if (params.redirect) {
      route(params.redirect);
      return;
    }

    const welcomeSpaceVertex = await this.getWelcomeSpaceVertex();
    if (welcomeSpaceVertex && !(await welcomeSpaceVertex.getLastVisitEvent())) {
      route(`/topic/${welcomeSpaceVertex.id}`);
      return;
    }

    route('/');
  }

  async generateAuthToken(): Promise<string | null> {
    const idToken = await Firebase.firebase.auth().currentUser?.getIdToken();
    if (idToken) {
      const checkStatusRes = await axios
        .post<{
          ok: boolean;
          extensionCustomToken?: string;
        }>(`${config.apiEndpointUrl}/api/auth2/generateExtensionToken`, {
          idToken,
        })
        .catch((error) => {
          this.traceError('generateExtensionToken failed witherror', error);
          return { data: { ok: false, extensionCustomToken: null } };
        });

      const data = checkStatusRes.data;
      if (data.ok && data.extensionCustomToken) {
        return data.extensionCustomToken;
      }
    }
    return null;
  }

  async renewExtensionToken() {
    if (this.isExtension) return;
    const token = await this.generateAuthToken();
    if (!token && this.skipLogout) return;
    this.extBridge.sendExtensionMessage('NOTICE/SESSION_UPDATE', { token });
  }

  ignoreAuthStateChange = false;

  async createAccount({
    fullName,
    email,
    password,
    inviteCode,
    skipRedirect,
  }: {
    fullName: string;
    email: string;
    password: string;
    inviteCode: string;
    skipRedirect?: boolean;
  }) {
    const auth = Firebase.firebase.auth();

    // The lookup will fail until we create the vertex, so prevent it from happening
    this.ignoreAuthStateChange = true;

    const { user } = await auth.createUserWithEmailAndPassword(email, password);
    if (!user) throw new Error('signup error - no user');

    // LogRocket.identify(user.uid, {
    //   name: fullName,
    //   email,
    //   // Add your own custom user variables here, ie:
    //   // subscriptionType: 'pro'
    // });
    const userVertex = trxWrapSync((trx) => {
      const userVertex = Model.Vertex.create({
        trx,
        id: user.uid,
        parent: null,
        kind: 'user',
        email,
        inviteCode,
      });

      this.currentUserVertexObs.set(userVertex);
      this.ignoreAuthStateChange = false;

      Model.TimelineEvent.create({
        trx,
        parent: userVertex,
        eventType: 'sign-up',
      });

      userVertex.createProperty({
        trx,
        role: ['full-name'],
        initialString: fullName,
        contentType: 'text/plain',
        privs: Model.Priv.PrivState.defaultPublicReadonly(),
      });
      userVertex.createProperty({
        trx,
        role: ['email'],
        initialString: email,
        contentType: 'text/plain',
        privs: Model.Priv.PrivState.defaultPublicReadonly(),
      });

      return userVertex;
    });

    await this.upsertStarterSpaces(userVertex);
    this.postSignupBackroundItems(userVertex, email, fullName);
    if (!skipRedirect) route('/welcome', true);
    return user.uid;
  }

  async claimPassword(uid: string, password: string, name: string) {
    const serverUrl = config.serverUrl;

    const response = await fetch(`${serverUrl}/invitee/signup`, {
      method: 'POST',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        name,
        password,
      }),
    });

    const { status, email } = (await response.json()) as InviteeSignupResponse;

    if (status === 'SUCCESS' && email) {
      // sign in...
      await Firebase.firebase.auth().signInWithEmailAndPassword(email, password);

      const userVertex = Model.Vertex.getById({ id: uid });
      void this.upsertStarterSpaces(userVertex);
      this.postSignupBackroundItems(userVertex, email, name);
    } else {
      throw new Error('Error signing up');
    }
  }

  // async setupUser(uid: string, email: string, name: string) {
  //   const userVertex = Model.Vertex.getById({ id: uid });
  //   void this.postSignupItems(userVertex, email, name);
  // NOTE: This does not unload the app, and thus should not interfere with postSignupItems completion
  // const params = QueryString.parse(window.location.search);
  // if (params.returnToPreviousTab) {
  //   this.extBridge.sendExtensionMessage('RETURN_TO_PREVIOUS_TAB');
  // }
  // TODO: re-enable later
  // location.href = `https://buy.stripe.com/00g7uv4jL59R8g04gl?client_reference_id=${userID}`;
  // }

  // Any post-signup asynchrony must be internal to this function
  // Anything which can fail in here must do so silently - no raising exceptions
  postSignupBackroundItems(
    userVertex: Model.Vertex,
    email: string,
    fullName: string,
    // user: Firebase.firebase.User,
  ) {
    try {
      //Backgrounding starter spaces because it can happen while we're looking at the welcome screen
      Analytics.event('auth', { action: 'Sign Up' });
      subscribeUser({ email, full_name: fullName })
        .then(() => {
          console.log('User subscribed');
        })
        .catch(() => {
          console.warn('User failed to subscribe');
        });
    } catch (e) {
      console.error('Error in postSignupBackroundItems', e);
    }
  }

  async upsertStarterSpaces(userVertex: Model.Vertex) {
    console.log('upsertStarterSpaces start', { userVertex });
    let backrefs = await store.get<Model.Backref>('backref', userVertex, {
      where: [
        ['role', 'array-contains-any', ['welcome-space']],
        // TODO change role to primaryRole (after migration) and uncomment this lines
        // ['recipientID', 'array-contains-any', [userVertex.id]
        ['userID', '==', userVertex.id],
      ],
    });

    console.log('upsertStarterSpaces post check', { backrefs });
    const welcomeSpaceVertex = backrefs[0]?.target;
    // already exists
    if (welcomeSpaceVertex) return;

    let wipFlag = await userVertex.getFlagProperty('setting-up-starter-spaces');
    // 5 minutes
    if (wipFlag) {
      if (wipFlag.updatedAt.toMillis() > Date.now() - 5 * 60 * 1000) {
        console.log('upsertStarterSpaces already in progress');
        return;
      }
      trxWrapSync((trx) => wipFlag?.archive(trx));
    }

    // not actually a mutex, but we should try to prevent more than one of these from running at a time
    // if the user logs in to multiple tabs or something. Needs to be in a seperate trx of course.
    wipFlag ??= trxWrapSync((trx) => userVertex.createFlagProperty('setting-up-starter-spaces', trx));

    return await trxWrap(async (trx) => {
      userVertex.createFlagProperty('new-user', trx);
      const { getStarted, others } = config.welcomeTemplateIds;
      const vmContext = new VM.ViewModelContext(this, this.extBridge as WebappExtensionBridge, true);
      return Guard.while(
        // use one clone context for all of these cloning procedures
        { cloneContext: new CloneContext(trx) },
        async ({ cloneContext }) => {
          const [gsVertex, _] = await Promise.all([
            VM.createTopicSpaceFromTemplateId(getStarted, vmContext, cloneContext),
            ...others.map(async (templateVertexID) =>
              VM.createTopicSpaceFromTemplateId(templateVertexID, vmContext, cloneContext),
            ),
          ]);

          gsVertex.createEdge({ trx, target: userVertex, role: ['welcome-space'], meta: {} });

          wipFlag.archive(trx);
          console.log('upsertStarterSpaces done');
        },
      );
    });
  }

  // TODO: it seems like onAuthStateChange already renews the extension token. Does this method need to be anything more than auth.signInWithEmailAndPassword?
  //  Challenge seems necessary, but it's not clear what `/api/auth/signIn accomplishes that generateAuthToken doesn't do
  async signIn(email: string, password: string) {
    const auth = Firebase.firebase.auth();

    // If email + password are correct, change the auth state
    // (and commensurately, call onAuthStateChange"
    const { user } = await auth.signInWithEmailAndPassword(email, password);

    if (!user) throw new Error('No user found');
    const idToken = await user.getIdToken();

    const signInRes = await axios.post<{
      ok: boolean;
      token?: string;
      uid: string;
    }>(
      `${config.apiEndpointUrl}/api/auth/signIn`,
      {
        idToken,
      },
      { withCredentials: true },
    );

    const data = signInRes.data;

    if (data.ok && data.token) {
      await this.renewExtensionToken();
      Analytics.event('auth', {
        action: 'Login',
      });
      Analytics.identify(user.uid);
      const userRecord = Model.Vertex.getById({ id: user.uid });
      this.currentUserVertexObs.set(userRecord);
      const evt = await trxWrap(async (trx) => {
        return Model.TimelineEvent.create({
          trx,
          parent: userRecord,
          eventType: 'sign-in',
        });
      });
      let guard = Guard.unsafe(evt);
      // we don't want this to show up in timeline or anything
      await trxWrap(async (trx) => evt.archive(trx));
      guard.release();

      await userRecord.properties.get();
      void this.challengeBrowserContexts();
      void this.logrocketIdentify(userRecord);

      // In case this is an older account that doesn't have the welcome spaces
      await this.upsertStarterSpaces(userRecord);

      return this.redirectAfterAuth();
    } else {
      console.error('failed');
      throw new Error('Failed');
    }
  }

  // @MemoizeOwned()
  // get welcomeSpaceVertex() {
  //   // TODO: I believe the loader is not being awaited, by way of the currentuservertexobs being initially null perhaps?
  //   return this.currentUserVertexObs.mapObs((user) => {
  //     if (!user) return null;
  //     return user
  //       .filterBackrefs({ role: ['welcome-space'] })
  //       .firstObs()
  //       .mapObs((b) => b && b.target);
  //   });
  // }

  async getWelcomeSpaceVertex() {
    const user = this.currentUserVertexObs.value;
    if (!user) return null;
    const backrefs = await globalStore.get<Model.Backref>('backref', user, {
      where: [
        ['role', 'array-contains-any', ['welcome-space']],
        ['userID', '==', user.id],
      ],
    });

    return backrefs[0]?.target;
  }

  // Automatically creates a default profile for the user if one does not exist.
  async upsertDefaultProfile() {
    const currentUser = this.currentUserVertexObs.value;
    if (!currentUser) return;

    const props = await globalStore.get<Model.Property>('property', null, {
      where: [
        // Must be created by me. We should also be checking to see if this has a valid profile-of edge to the currentUser, but lets fudge that for now
        ['userID', '==', currentUser.id],
        // Be paranoid and filter out invalid recipients. Generally shouldn't be necessary, but any errant records will crash the query without this
        ['recipientID', 'array-contains-any', [currentUser.id]],
        ['status', '==', 'active'],
        ['primaryRole', '==', 'default-edvo-profile'],
      ],
    });

    if (props.length == 0) {
      trxWrapSync((trx) => this.createProfile(trx, 'default', 'default', true));
    }
  }

  async logrocketIdentify(user: Model.Vertex) {
    const name = await (
      await user
        .filterProperties({ role: ['full-name'] })
        .firstObs()
        .get()
    )?.text.get();

    const email = await (
      await user
        .filterProperties({ role: ['email'] })
        .firstObs()
        .get()
    )?.text.get();

    const traits: Record<string, string> = {};

    if (name) traits.name = name;
    if (email) traits.email = email;
    // LogRocket.identify(user.id, traits);
  }

  async challengeBrowserContexts() {
    const bc = await globalStore
      .query<Model.BrowserContext>('browser_context', null, {
        where: [
          ['userID', '==', globalStore.getCurrentUserID()],
          ['status', '==', 'active'],
        ],
      })
      .get();

    trxWrapSync((trx) => bc.forEach((ctx) => ctx.challenge(trx)));
  }

  async signInWithCustomToken(token: string, redirect = true) {
    const auth = Firebase.firebase.auth();
    const { user } = await auth.signInWithCustomToken(token);
    if (!user) {
      await auth.signOut();
      return;
    }
    const userRecord = Model.Vertex.getById({ id: user.uid });
    this.currentUserVertexObs.set(userRecord);
    const evt = await trxWrap(async (trx) => {
      return Model.TimelineEvent.create({
        trx,
        parent: userRecord,
        eventType: 'sign-in',
      });
    });
    let guard = Guard.unsafe(evt);
    await trxWrap(async (trx) => evt.archive(trx));
    guard.release();
    // we don't want this to show up in timeline or anything

    await userRecord.properties.get();
    return redirect && this.redirectAfterAuth();
  }

  async signOut() {
    // we have to nav first, then sign out, otherwise the userObs does weird stuff
    route('/auth/login');
    await Firebase.firebase.auth().signOut();
    Analytics.reset();
  }

  /**
   * get or create the user vertex
   * For regular users, the user vertex was created at signup, but not anonymous users.
   */
  private fetchAndSetUserVertex(user: Firebase.firebase.User | null) {
    const uid = user?.uid;
    if (!uid) this.currentUserVertexObs.set(null);
    if (!uid || this.currentUserVertexObs.value?.id === uid) return null;

    if (!user) {
      this.currentUserVertexObs.set(null);
      return null;
    } else if (user.isAnonymous) {
      void this.upsertAnonymousUser(user).then((vertex) => {
        this.currentUserVertexObs.set(vertex);
      });
    } else {
      const vertex = Model.Vertex.getById({ id: user.uid });
      this.currentUserVertexObs.set(vertex);
      void this.logrocketIdentify(vertex);
      return vertex;
    }
  }

  private async upsertAnonymousUser(user: Firebase.firebase.User): Promise<Model.Vertex> {
    const fullName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: ' ',
      length: 2,
      style: 'capital',
    });

    return this.userMutex.run_locked_async(() =>
      trxWrap(async (trx) =>
        Model.Vertex.upsertByID({
          trx,
          id: user.uid,
          parent: null,
          kind: 'user',
          onCreate: (trx, userVertex) => {
            userVertex.createProperty({
              trx,
              role: ['full-name'],
              initialString: fullName,
              contentType: 'text/plain',
              privs: Model.Priv.PrivState.defaultPublicReadonly(),
            });
            userVertex.setFlagProperty('is-anonymous', true, trx);
          },
        }),
      ),
    );
  }

  createProfile(trx: TrxRef, name: string, identifier?: string, setAsDefault?: boolean): Model.Vertex | null {
    const currentUser = this.currentUserVertexObs.value;
    if (!currentUser) return null;
    const profile = Model.Vertex.create({ trx, kind: 'user-profile' });

    if (setAsDefault) profile?.createFlagProperty('default-edvo-profile', trx);
    profile.createProperty({
      trx,
      role: ['profile-name'],
      contentType: 'text/plain',
      initialString: name,
    });

    if (identifier) {
      profile.createProperty({
        trx,
        role: ['profile-ident'],
        contentType: 'text/plain',
        initialString: identifier,
      });
    }

    profile.createEdge({
      trx,
      target: currentUser,
      role: ['profile-of'],
      meta: {},
    });

    return profile;
  }

  // Contains the list of profiles for the current user if logged in, otherwise an empty list
  @MemoizeOwned()
  get profilesObs(): ObservableList<Model.Vertex> {
    return mapObsList(this.currentUserVertexObs, (currentUser) => {
      return currentUser?.filterBackrefs({ role: ['profile-of'] }).mapObs((b) => b.target) ?? [];
    });
  }

  @MemoizeOwned()
  get defaultProfile(): ObservableReader<Model.Vertex | null | undefined> {
    return this.currentUserVertexObs.mapObs((user) => {
      if (!user) return user;
      const query = globalStore.query<Model.Property>('property', null, {
        where: [
          // Must be created by me. We should also be checking to see if this has a valid profile-of edge to the currentUser, but lets fudge that for now
          ['userID', '==', user.id],
          // Be paranoid and filter out invalid recipients. Generally shouldn't be necessary, but any errant records will crash the query without this
          ['recipientID', 'array-contains-any', [user.id]],
          ['status', '==', 'active'],
          ['primaryRole', '==', 'default-edvo-profile'],
        ],
      });
      return query.firstObs().mapObs((prop) => prop && prop.parent);
    });
  }
}

class CookieStorage implements Storage {
  set(key: string, value: string) {
    const domain = this.getTLD();
    const cookieOpts: Cookie.CookieAttributes = {
      path: '/',
      sameSite: 'None',
      secure: true,
      expires: 100,
    };
    if (domain) {
      cookieOpts.domain = domain;
    }
    Cookie.set(key, value, cookieOpts);
  }

  get(key: string): Promise<string | null | undefined> {
    return Promise.resolve(Cookie.get(key) || null);
  }

  clear(key: string) {
    const domain = this.getTLD();
    const cookieOpts: Cookie.CookieAttributes = {
      path: '/',
      sameSite: 'None',
      secure: true,
      expires: 100,
    };
    if (domain) {
      cookieOpts.domain = domain;
    }
    Cookie.remove(key, cookieOpts);
  }

  getTLD() {
    if (typeof window === 'undefined') return null;
    const hostname = window.location.hostname;
    if (hostname === 'localhost') {
      return null;
    }
    return 'edvo.com';
  }
}

interface ElectronWindow extends Window {
  electronAPI: ElectronAPI;
}

async function subscribeUser(args: { email: string; full_name: string }) {
  if (config.env !== 'production') return;
  const data = await globalStore.callServerFunction('userCreation', args);
  console.debug('SUBSCRIBE USER', data);
}
