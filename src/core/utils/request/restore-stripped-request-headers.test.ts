import { restoreStrippedRequestHeaders } from './restore-stripped-request-headers'

const rawHeadersSymbol = Symbol('kRawHeaders')

function attachRawHeaders(
  request: Request,
  rawHeaders: Array<[string, string]>,
): Array<[string, string]> {
  Object.defineProperty(request.headers, rawHeadersSymbol, {
    configurable: true,
    value: rawHeaders,
  })

  return rawHeaders
}

test('copies raw headers missing from the request', () => {
  const request = new Request('https://example.com/resource', {
    method: 'POST',
    headers: { accept: '*/*' },
    body: 'a=1&b=2',
  })
  const rawHeaders = attachRawHeaders(request, [
    ['Accept', '*/*'],
    ['Cookie', 'session=abc'],
    ['Content-Length', '7'],
    ['Referer', 'https://example.com/from'],
    ['Host', 'example.com'],
    ['Accept-Encoding', 'gzip'],
    ['Connection', 'close'],
    ['Sec-Fetch-Site', 'same-origin'],
    ['Proxy-Authorization', 'Basic abc'],
  ])

  restoreStrippedRequestHeaders(request)

  expect(request.headers.get('cookie')).toBe('session=abc')
  expect(request.headers.get('content-length')).toBe('7')
  expect(request.headers.get('referer')).toBe('https://example.com/from')
  expect(request.headers.get('host')).toBe('example.com')
  expect(request.headers.get('accept-encoding')).toBe('gzip')
  expect(request.headers.get('connection')).toBe('close')
  expect(request.headers.get('sec-fetch-site')).toBe('same-origin')
  expect(request.headers.get('proxy-authorization')).toBe('Basic abc')
  expect(request.headers.get('accept')).toBe('*/*')
  expect(rawHeaders).toEqual([
    ['Accept', '*/*'],
    ['Cookie', 'session=abc'],
    ['Content-Length', '7'],
    ['Referer', 'https://example.com/from'],
    ['Host', 'example.com'],
    ['Accept-Encoding', 'gzip'],
    ['Connection', 'close'],
    ['Sec-Fetch-Site', 'same-origin'],
    ['Proxy-Authorization', 'Basic abc'],
  ])
})

test('keeps headers the request constructor already exposed', () => {
  const request = new Request('https://example.com/resource', {
    headers: {
      cookie: 'session=abc',
      accept: '*/*',
    },
  })
  const rawHeaders = attachRawHeaders(request, [
    ['Cookie', 'session=abc'],
    ['Accept', '*/*'],
  ])

  restoreStrippedRequestHeaders(request)

  expect(request.headers.get('cookie')).toBe('session=abc')
  expect(rawHeaders).toEqual([
    ['Cookie', 'session=abc'],
    ['Accept', '*/*'],
  ])
})

test('does not record a second copy when append records raw headers', () => {
  const request = new Request('https://example.com/resource')
  const rawHeaders = attachRawHeaders(request, [
    ['Accept', '*/*'],
    ['Cookie', 'session=abc'],
  ])
  const originalAppend = Headers.prototype.append

  Headers.prototype.append = function append(
    this: Headers,
    name: string,
    value: string,
  ) {
    rawHeaders.push([name, value])
    return originalAppend.call(this, name, value)
  }

  try {
    restoreStrippedRequestHeaders(request)
  } finally {
    Headers.prototype.append = originalAppend
  }

  expect(request.headers.get('cookie')).toBe('session=abc')
  expect(rawHeaders).toEqual([
    ['Accept', '*/*'],
    ['Cookie', 'session=abc'],
  ])
})

test('leaves the request untouched when it has no raw headers', () => {
  const request = new Request('https://example.com/resource', {
    headers: { accept: '*/*' },
  })

  restoreStrippedRequestHeaders(request)

  expect(request.headers.get('accept')).toBe('*/*')
  expect(request.headers.get('cookie')).toBeNull()
})
