const RAW_HEADERS_SYMBOL = 'kRawHeaders'

type RawHeaderTuple = [string, string]

/**
 * Copy request headers that a browser-like `Request` constructor removed.
 *
 * happy-dom and jsdom apply the Fetch forbidden request-header rules while
 * constructing a `Request`. `@mswjs/interceptors` builds the handler request
 * with that constructor, so `Cookie`, `Content-Length`, `Host`, and the rest
 * of that list disappear. Those rules stop a page from forging headers. They
 * do not apply to the request the server received: the interceptor keeps the
 * original values on an internal raw-header list.
 *
 * @see https://github.com/mswjs/msw/issues/2815
 * @see https://fetch.spec.whatwg.org/#forbidden-request-header
 */
export function restoreStrippedRequestHeaders(request: Request): void {
  const rawHeaders = readRawHeaders(request.headers)

  if (!rawHeaders) {
    return
  }

  const groups = new Map<string, Array<RawHeaderTuple>>()

  for (const entry of rawHeaders) {
    if (!Array.isArray(entry) || entry.length < 2) {
      continue
    }

    const tuple: RawHeaderTuple = [String(entry[0]), String(entry[1])]
    const key = tuple[0].toLowerCase()
    const group = groups.get(key)

    if (group) {
      group.push(tuple)
    } else {
      groups.set(key, [tuple])
    }
  }

  for (const group of groups.values()) {
    const [name] = group[0]

    if (request.headers.has(name)) {
      continue
    }

    /**
     * @note While interception is active, `Headers.prototype.append` records
     * raw headers again. This list already has these values. Drop the
     * duplicates so a later passthrough does not send them twice.
     */
    const lengthBefore = rawHeaders.length

    try {
      for (const [headerName, headerValue] of group) {
        request.headers.append(headerName, headerValue)
      }
    } finally {
      if (rawHeaders.length > lengthBefore) {
        rawHeaders.length = lengthBefore
      }
    }
  }
}

function readRawHeaders(headers: Headers): Array<RawHeaderTuple> | undefined {
  const symbol = Object.getOwnPropertySymbols(headers).find((candidate) => {
    return candidate.description === RAW_HEADERS_SYMBOL
  })

  if (!symbol) {
    return
  }

  const value: unknown = Reflect.get(headers, symbol)

  if (!Array.isArray(value)) {
    return
  }

  return value as Array<RawHeaderTuple>
}
