export function parse(search = window.location.search) {
  const urlSearchParams = new URLSearchParams(search);
  return Object.fromEntries(urlSearchParams.entries());
}

export function stringify(parsed: Record<string, string>) {
  return Object.entries(parsed)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

export function preserveQueryString(url: string) {
  if (window.location.search) {
    // window.location.search already has a ?
    return `${url}${window.location.search}`;
  }
  return url;
}
