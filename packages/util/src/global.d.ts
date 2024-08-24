declare global {
  interface Window {
    traceState: {
      level: number;
      regex: RegExp;
    };
  }
  var traceState: {
    level: number;
    regex: RegExp;
  };
}
