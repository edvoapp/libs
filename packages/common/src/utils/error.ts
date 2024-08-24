let errorHandler: ((msg: string) => void) | null = null;

export function bindRaiseError(handler: (msg: string) => void) {
  errorHandler = handler;
}

export function raiseError(message: string) {
  console.error(message);
  errorHandler?.(message);
}
