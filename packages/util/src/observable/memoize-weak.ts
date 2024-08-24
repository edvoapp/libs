import { EdvoObj, Guard, GuardedObj } from './object';
import { EdvoError } from './edvo-error';

/**
 * Calls the wrapped getter and memoizes the result on the object with a registered reference to keep it alive.
 * Because of this, the original getter is guaranteed to only be called once.
 * UNLESS you've previously called the setter to unset the value, in which case it will be called again.
 */

export function MemoizeOwned() {
  return function <
    Cls extends EdvoObj | null,
    Key extends keyof Cls,
    DescriptorValue extends GuardedObj | GuardedObj[] | null,
  >(_target: Cls, property: Key, descriptor: TypedPropertyDescriptor<DescriptorValue>) {
    const propertyName = String(property);
    const memoKey = Symbol(`MemoizeOwned() ${propertyName}`);
    const gettingFlag = Symbol(`getting ${propertyName}`);

    const getter = descriptor.get;
    if (descriptor.value) {
      throw 'MemoizeOwned can only be used on a getter';
    }

    if (getter) {
      descriptor.set = function (v: DescriptorValue | undefined) {
        if (v !== undefined) throw 'attempt to call setter with defined value';
        const self = this as EdvoObj;
        self.validate();
        self.setProperty(memoKey, undefined);
      };
      descriptor.get = function () {
        // @ts-expect-error this is known
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-this-alias
        const self = this as EdvoObj;
        self.validate();
        let value = self[memoKey] as DescriptorValue;

        if (value === undefined) {
          if (self[gettingFlag]) {
            debugger;
            throw `Detected recursive call for get ${propertyName}`;
          }
          self[gettingFlag] = true;

          value = getter?.apply(self);
          delete self[gettingFlag];
          // I'm taking ownership of this, and I hereby pinky-swear to send the override flag when calling .destroy()
          // All other callers of destroy without the override flag will not actually destroy it
          self.setProperty(memoKey, value);
        }
        return value;
      } as () => DescriptorValue;
    } else {
      throw 'Only put a MemoizeOwned() decorator on a get accessor.';
    }
  };
}

/**
 * Calls the wrapped getter and memoizes the result on the object *without* registering a reference to keep it alive.
 * On subsequent calls, the value is checked for liveness, and if it is destroyed, the getter is called again.
 * Because of this, the original getter may be called multiple times.
 *
 * Either way, the caller will receive a value which is guaranteed to be alive - at least in that instant!
 * They caller must still call `.registerReferent(...)` or use a guard to keep it alive for whatever duration is desired.
 */

export function MemoizeWeak() {
  return function <Cls extends EdvoObj | null, Key extends keyof Cls, DescriptorValue extends GuardedObj | null>(
    _target: Cls,
    property: Key,
    descriptor: TypedPropertyDescriptor<DescriptorValue>,
  ) {
    const propertyName = String(property);
    const memoKey = Symbol(`MemoizeWeak() ${propertyName}`);
    const gettingFlag = Symbol(`getting ${propertyName}`);

    const getter = descriptor.get;
    if (descriptor.value) {
      throw 'MemoizeWeak can only be used on a getter';
    }

    if (getter) {
      descriptor.set = function (v: DescriptorValue | undefined) {
        if (v !== undefined) throw 'attempt to call setter with defined value';
        const self = this as EdvoObj;
        self.validate();
        self[memoKey] = undefined;
      };
      descriptor.get = function () {
        // @ts-expect-error this is known
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-this-alias
        const self = this as EdvoObj;
        self.validate();
        let value = self[memoKey] as DescriptorValue;

        if (value === undefined || value?.destroyed) {
          // don't call the getter if value is null
          if (self[gettingFlag]) {
            debugger;
            throw `Detected recursive call for get ${propertyName}`;
          }
          self[gettingFlag] = true;

          value = getter?.apply(self);
          delete self[gettingFlag];

          // Not taking ownership
          self[memoKey] = value;
        }

        return value;
      } as () => DescriptorValue;
    } else {
      throw 'Only put a MemoizeOwned() decorator on a get accessor.';
    }
  };
}

export function OwnedProperty<Cls extends EdvoObj, Key extends keyof Cls, Val extends GuardedObj>(
  target: Cls,
  propertyKey: Key,
) {
  let key = String(propertyKey);
  // Create a new symbol key for our private property
  const _key = Symbol(key);
  // Define the getter and setter
  Object.defineProperty(target, propertyKey, {
    get: function (): Val {
      const self = this as Cls;
      self.validate();
      return self[_key] as Val;
    },
    set: function (value: Val) {
      const self = this as Cls;
      self.setProperty(_key, value);
    },
    enumerable: true,
    configurable: true,
  });
}

export function WeakProperty<Cls extends GuardedObj, Key extends keyof Cls, Val extends GuardedObj>(
  target: Cls,
  propertyKey: Key,
) {
  let key = String(propertyKey);
  // Create a new symbol key for our private property
  const _key = Symbol(key);
  // Define the getter and setter
  Object.defineProperty(target, propertyKey, {
    get: function (): Val | null {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-this-alias
      const self = this as Cls;
      self.validate();
      return (self[_key] as Val | null | undefined)?.upgrade() ?? null;
    },
    set: function (value: Val) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-this-alias
      const self = this as Cls;
      self.validate();
      (self[_key] as Val | undefined) = value;
    },
    enumerable: true,
    configurable: true,
  });
}

/** Prevents object cleanup until after the Guarded function completes. This is useful for functions
 * which may in some circumstances result in their own object destruction.
 *
 * This works for async and synchronous functions. It detects if the guarded function returns a promise,
 * and releases the guard when the promise completes, or immediately in the case of synchronous functions.
 */
export function Guarded<Cls extends GuardedObj>(target: Cls, propertyKey: string, descriptor: PropertyDescriptor) {
  if (!(target instanceof GuardedObj)) throw `${propertyKey} : @Guarded can only be used on an GuardedObj`;

  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    return Guard.while(this as GuardedObj, (self) => originalMethod.apply(self, args));
  };

  return descriptor;
}

// export function MemoizeOwnedArray() {
//   return function <
//     Cls extends EdvoObj,
//     Key extends keyof Cls,
//     DescriptorValue extends EdvoObj[],
//   >(
//     _target: Cls,
//     _propertyKey: Key,
//     descriptor: TypedPropertyDescriptor<DescriptorValue>,
//   ) {
//     const memoKey = `__owned_${String(_propertyKey)}`;
//     const gettingFlag = `__getting_${String(_propertyKey)}`;
//     const propertyName = `${String(_propertyKey)}`;

//     const getter = descriptor.get;
//     if (descriptor.value) {
//       throw 'MemoizeOwned can only be used on a getter';
//     }

//     if (getter) {
//       descriptor.get = function () {
//         // @ts-expect-error this is known
//         // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-this-alias
//         const self = this as EdvoObj;
//         let value = self[memoKey] as DescriptorValue;

//         if (value === undefined) {
//           if (self[gettingFlag])
//             throw `Detected recursive call for get ${propertyName}`;
//           self[gettingFlag] = true;

//           value = getter?.apply(self);
//           self[memoKey] = value;
//           delete self[gettingFlag];
//           // I'm taking ownership of this, and I hereby pinky-swear to send the override flag when calling .destroy()
//           // All other callers of destroy without the override flag will not actually destroy it
//           self.setProperty(memoKey, value);
//         }
//         return value;
//       } as () => DescriptorValue;
//     } else {
//       throw 'Only put a MemoizeOwned() decorator on a get accessor.';
//     }
//   };
// }
