import { clamp, EdvoObj, MemoizeOwned, Observable, ObservableList, OwnedProperty, WeakProperty } from '@edvoapp/util';
import { DB, Firebase, Model } from '@edvoapp/common';
import { ChildNode, ChildNodeCA, ListNode, Node, NodeCA, Position } from './base';
import { UserAvatar } from './user-avatar';
import { TopicSpace } from './topic-space';

const HEARTBEAT_INTERVAL = 2 * 1000;
const GREY_CUTOFF_INTERVAL = 4 * 1000;
const FULL_CUTOFF_INTERVAL = 8 * 1000;

// fresh means that the cursor has moved sometime within the last 4 seconds
// stale means that the cursor has not moved in the last 4 seconds
// absent means that the cursor has not moved in the last 8 seconds
type PresenceState = 'fresh' | 'stale' | 'absent';

export interface UserPresenceVals {
  lastCursorTimestamp: number;
  // if a user hasn't moved their cursor in a bit, but have the window open, they should not appear
  lastPresenceTimestamp: number;
  userId: string;
  pointer: Position | null;
  windowId: string | null;
}

export class UserPresenceValue extends EdvoObj {
  lastCursorTimestamp: number;
  lastPresenceTimestamp: number;
  userId: string;
  windowId: string | null;

  @OwnedProperty
  pointer = new Observable<null | Position>(null);
  @OwnedProperty
  state = new Observable<null | PresenceState>(null);

  constructor({
    lastCursorTimestamp,
    lastPresenceTimestamp,
    userId,
    pointer,
    windowId,
  }: {
    lastCursorTimestamp: number;
    lastPresenceTimestamp: number;
    userId: string;
    pointer: Position | null;
    windowId: string | null;
  }) {
    super();
    this.lastCursorTimestamp = lastCursorTimestamp;
    this.lastPresenceTimestamp = lastPresenceTimestamp;
    this.userId = userId;
    this.windowId = windowId;
    this.pointer.set(pointer);
  }

  getState(lastCursorTimestamp: number, lastPresenceTimestamp: number): PresenceState {
    /*
    presence timestamp updates every 2 seconds
    cursor timestamp updates every mousemove

    we only want to hide the presence once there is no presence timestamp within the last 8 sec

    otherwise, we always want to show the presence, but it may be dimmed if the cursor has not moved in the last 4 sec
     */
    const now = Date.now();
    let cutoff1 = now - GREY_CUTOFF_INTERVAL;
    let cutoff2 = now - FULL_CUTOFF_INTERVAL;

    // apparently the following are true, which all independently make sense but make it difficult to do comparisons:
    // - !(undefined < 1)
    // - !(undefined > 1)
    // - !(undefined == 1)
    // therefore, we should just ignore any undefined values
    if (!lastPresenceTimestamp || !lastCursorTimestamp || lastPresenceTimestamp < cutoff2) return 'absent';
    if (lastCursorTimestamp < cutoff1) return 'stale';
    return 'fresh';
  }

  update({ lastCursorTimestamp, lastPresenceTimestamp, userId, windowId, pointer }: UserPresenceVals) {
    // If the userID and windowID don't match me, then it's not my record -- don't do anything
    if (userId !== this.userId) return;
    this.lastCursorTimestamp = lastCursorTimestamp;
    const state = this.getState(lastCursorTimestamp, lastPresenceTimestamp);
    this.windowId = windowId;
    this.state.set(state);
    this.pointer.set(pointer);
  }
}

interface CA extends NodeCA<Node> {
  vertexID: string;
  userID?: string;
}

export class UserPresence extends Node {
  @OwnedProperty
  _presentUsers = new ObservableList<UserPresenceValue>();
  @OwnedProperty
  presentUsers = this._presentUsers.filterObs((x) => x.state.value !== 'absent', 'present users', undefined, true);

  rtdb: Firebase.Database;
  vertexID: string;
  userID: string | undefined;
  windowId: string;

  constructor({ vertexID, userID, ...args }: CA) {
    super(args);
    const winId = Math.random()
      .toString(36)
      .replace(/[^a-z]+/g, '')
      .substr(0, 5);
    this.windowId = winId;
    this.rtdb = Firebase.firebase.database();
    this.vertexID = vertexID;
    this.userID = userID;

    // TODO Refine the update
    const vertexRef = this.rtdb?.ref(`vertex/${vertexID}/users`);
    const callback = (snapShot: DB.DataSnapshot) => {
      const newData = Object.values<UserPresenceVals>(snapShot?.val() || {});
      this.updateFromRTDB(newData);
    };
    vertexRef?.on('value', callback);
    this.onCleanup(() => vertexRef?.off('value', callback));
    // INITIAL PING
    void this.ping();

    // CONSTRUCT HEARTBEAT
    const heartbeat = setInterval(() => {
      void this.ping();
    }, HEARTBEAT_INTERVAL);

    this.onCleanup(() => clearInterval(heartbeat));
  }

  static new(args: CA) {
    const me = new UserPresence(args);
    me.init();
    return me;
  }

  get childProps(): string[] {
    return ['userCursors', 'userPresences'];
  }

  @MemoizeOwned()
  get userCursors() {
    return ListNode.new<UserPresence, UserCursor, UserPresenceValue>({
      parentNode: this,
      precursor: this.presentUsers.filterObs(
        // Don't show my own cursor on my own browser
        (x) => x.userId !== this.userID && x.windowId !== this.windowId,
      ),
      factory: (userPresence, parentNode) =>
        UserCursor.new({
          parentNode,
          userPresence,
        }),
    });
  }

  @MemoizeOwned()
  get userPresences() {
    return ListNode.new<UserPresence, UserPresentWrapper, UserPresenceValue>({
      parentNode: this,
      precursor: this.presentUsers,
      factory: (userPresence, parentNode) =>
        UserPresentWrapper.new({
          parentNode,
          userPresence,
        }),
    });
  }

  lastSent: number | null = null;
  pointerActive = false;

  updateFromRTDB(list: UserPresenceVals[]) {
    if (!this.alive) return;
    for (const val of list) {
      const existingUser = this._presentUsers.find((user) => user.userId === val.userId);
      if (existingUser) {
        existingUser.update(val);
        // TODO: this can probably be smarter
        this.presentUsers.reevaluate();
      } else {
        this._presentUsers.insert(new UserPresenceValue(val));
      }
    }
  }

  // Updates the rtdb with the latest timestamp, runs every 2 seconds (HEARTBEAT_INTERVAL)
  private async ping() {
    if (this.userID) {
      // perhaps add query .where('timestamp','>=', 10 minutes before the page load)
      const snapShot = await this.rtdb.ref(`vertex/${this.vertexID}/users/${this.userID}`).get();
      const previousVals = snapShot.val() as UserPresenceVals | undefined;
      if (!previousVals) return;

      const { lastCursorTimestamp = 0 } = previousVals;

      const presenceVals: UserPresenceVals = {
        userId: this.userID,
        lastPresenceTimestamp: Date.now(),
        lastCursorTimestamp,
        pointer: previousVals?.pointer || null,
        windowId: previousVals?.windowId || null,
      };

      await this.rtdb.ref(`vertex/${this.vertexID}/users/${this.userID}`).set(presenceVals);
    }
  }

  shouldSendPointer(): boolean {
    const now = Date.now();
    const lastSent = this.lastSent || 0;
    if (lastSent < now - 100) {
      this.lastSent = now;
      return true;
    } else {
      return false;
    }
  }

  // updates the cursor of the current user
  async setPointer(coords: Position | null) {
    const shouldSend = this.shouldSendPointer();
    const pointerActive = coords !== null;

    if (this.pointerActive === pointerActive && !shouldSend) return;
    this.pointerActive = pointerActive;

    if (this.userID && this.rtdb) {
      const last = Date.now();
      const presenceVals: UserPresenceVals = {
        lastPresenceTimestamp: last,
        userId: this.userID,
        lastCursorTimestamp: last,
        pointer: coords,
        windowId: this.windowId,
      };

      await this.rtdb.ref(`vertex/${this.vertexID}/users/${this.userID}`).set(presenceVals);
    }
  }
}

interface UserCursorArgs extends ChildNodeCA<ListNode<UserPresence, UserCursor, UserPresenceValue>> {
  userPresence: UserPresenceValue;
}

export class UserCursor extends ChildNode<ListNode<UserPresence, UserCursor, UserPresenceValue>> {
  @OwnedProperty
  vertex: Model.Vertex;
  @OwnedProperty
  userPresence: UserPresenceValue;
  constructor({ userPresence, ...args }: UserCursorArgs) {
    super(args);
    this.userPresence = userPresence;
    this.vertex = Model.Vertex.getById({ id: userPresence.userId });
  }
  static new(args: UserCursorArgs) {
    const me = new UserCursor(args);
    me.init();
    return me;
  }

  get childProps(): string[] {
    return ['avatar'];
  }

  @MemoizeOwned()
  get avatar() {
    return UserAvatar.new({
      vertex: this.vertex,
      parentNode: this,
      context: this.context,
      size: 'small',
    });
  }

  @WeakProperty
  get myTopicSpace(): TopicSpace {
    return this.closestInstance(TopicSpace)!;
  }

  @MemoizeOwned()
  get clientPointer() {
    const avatarSize = 35; // for padding too

    return Observable.calculated(
      ({ pointer, spaceRect, viewport }) => {
        if (!pointer) return null;
        const { planeScale: scale, x: translateX, y: translateY } = viewport;
        let x = (pointer.x - translateX) * scale;
        let y = (pointer.y - translateY) * scale;

        // To fade the cursor if it is outside the current viewport
        const isOutside = x < spaceRect.left || x > spaceRect.right || y < spaceRect.top || y > spaceRect.bottom;

        // prevent the avatar from rendering off-screen
        x = clamp(1, spaceRect.right - avatarSize, x);
        y = clamp(1, spaceRect.bottom - avatarSize, y);

        return {
          x,
          y,
          isOutside,
        };
      },
      {
        pointer: this.userPresence.pointer,
        spaceRect: this.myTopicSpace.clientRectObs,
        viewport: this.myTopicSpace.viewportState,
      },
    );
  }
}

interface UserPresentWrapperArgs extends ChildNodeCA<ListNode<UserPresence, UserPresentWrapper, UserPresenceValue>> {
  userPresence: UserPresenceValue;
}

export class UserPresentWrapper extends ChildNode<ListNode<UserPresence, UserPresentWrapper, UserPresenceValue>> {
  @OwnedProperty
  vertex: Model.Vertex;
  @OwnedProperty
  userPresence: UserPresenceValue;
  constructor({ userPresence, ...args }: UserPresentWrapperArgs) {
    super(args);
    this.userPresence = userPresence;
    this.vertex = Model.Vertex.getById({ id: userPresence.userId });
  }

  static new(args: UserPresentWrapperArgs) {
    const me = new UserPresentWrapper(args);
    me.init();
    return me;
  }

  get childProps(): string[] {
    return ['avatar'];
  }

  @MemoizeOwned()
  get avatar() {
    return UserAvatar.new({
      vertex: this.vertex,
      parentNode: this,
      context: this.context,
      size: 'small',
      showNameAsTooltip: true,
    });
  }

  @MemoizeOwned()
  get state() {
    return this.userPresence.state;
  }
}
