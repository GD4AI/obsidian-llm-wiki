// The request shape and the header normalization both fetch paths need.
//
// Split out by #929. `obsidian-fetch-bridge` and `node-https-fetch` imported
// each other only for these two symbols, which made a two-file cycle. This
// module imports neither of them, so both can import it.

export interface ObsidianFetchInit {
  method?: string;
  /** Fetch-API HeadersInit: plain object, Headers instance, or tuple array. */
  headers?: HeadersInit;
  body?: string | Uint8Array | undefined;
  signal?: AbortSignal;
  // Note: AI-SDK doesn't pass these but we accept them defensively.
  timeout?: number;
}

/**
 * Convert a Fetch API HeadersInit to a plain object that `requestUrl`
 * understands. AI-SDK passes either a Headers instance, a plain object,
 * or an array of tuples.
 *
 * Exported since v1.27.0 (#425): the Bedrock SigV4 signing wrapper
 * reuses this normalization so wrapped and unwrapped paths see
 * identical header shapes.
 */
export function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    for (const [key, value] of headers) {
      obj[key] = value;
    }
    return obj;
  }
  // Plain object — shallow copy to avoid aliasing caller's object.
  const obj: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    obj[key] = value;
  }
  return obj;
}
