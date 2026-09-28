// Must be imported BEFORE @readlater/core: the webdav library binds
// window.fetch at module init time, so the patch has to be in place first.
const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  originalFetch(input, { ...init, credentials: "omit" })) as typeof fetch;
