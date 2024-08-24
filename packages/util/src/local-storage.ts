export function loadState<T>(key: string): T | undefined {
  try {
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) {
      return undefined;
    }
    return JSON.parse(serializedState) as T;
  } catch (err) {
    const serializedState = localStorage.getItem(key) as unknown as T;
    return serializedState || undefined;
  }
}

export function saveState<T>(key: string, state: T) {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(key, serializedState);
  } catch (err) {
    // Ignore write errors.
  }
}

export function removeState(key: string) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    // ignore remove errors
  }
}
