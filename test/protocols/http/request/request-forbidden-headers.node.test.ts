// @vitest-environment happy-dom
/**
 * @see https://github.com/mswjs/msw/issues/2815
 *
 * happy-dom's `Request` removes forbidden request headers. The intercepted
 * request is the one the server received, so those headers must survive.
 */
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'bypass' })
})

afterEach(() => {
  server.resetHandlers()
  document.cookie.split(';').forEach((cookie) => {
    const [name] = cookie.trim().split('=')
    if (name) {
      document.cookie = `${name}=; Max-Age=0; Path=/`
    }
  })
})

afterAll(() => {
  server.close()
})

test('exposes the cookie happy-dom sent with the request', async () => {
  document.cookie = 'session=abc'

  let receivedCookie: string | null = null
  let receivedCookies: Record<string, string> = {}

  server.use(
    http.get('http://localhost:3000/resource', ({ request, cookies }) => {
      expect(request).toBeInstanceOf(Request)
      receivedCookie = request.headers.get('cookie')
      receivedCookies = cookies
      return HttpResponse.json({ ok: true })
    }),
  )

  const response = await fetch('/resource')

  expect(response.status).toBe(200)
  expect(receivedCookie).toBe('session=abc')
  expect(receivedCookies).toEqual({ session: 'abc' })
})

test('exposes forbidden headers parsed from the request happy-dom sent', async () => {
  document.cookie = 'session=abc'

  let headers: Headers | undefined

  server.use(
    http.get('http://localhost:3000/resource', ({ request }) => {
      headers = request.headers
      return HttpResponse.json({ ok: true })
    }),
  )

  await fetch('/resource')

  expect(headers).toBeInstanceOf(Headers)
  expect(headers?.get('cookie')).toBe('session=abc')
  expect(headers?.get('host')).toBe('localhost:3000')
  expect(headers?.get('referer')).toBe('http://localhost:3000/')
  expect(headers?.get('accept-encoding')).toBe('gzip, deflate, br')
  expect(headers?.get('connection')).toBe('close')
})

test('exposes content-length on the intercepted request', async () => {
  let receivedContentLength: string | null = null

  server.use(
    http.post('http://localhost:3000/resource', ({ request }) => {
      receivedContentLength = request.headers.get('content-length')
      return HttpResponse.json({ ok: true })
    }),
  )

  const response = await fetch('http://localhost:3000/resource', {
    method: 'POST',
    body: 'a=1&b=2',
  })

  expect(response.status).toBe(200)
  expect(receivedContentLength).toBe('7')
})
