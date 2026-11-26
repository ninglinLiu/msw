// @vitest-environment node
/**
 * Node's `Request` already keeps forbidden request headers. Restoring
 * headers from the raw list must not duplicate them or invent cookies
 * the client did not send.
 * @see https://github.com/mswjs/msw/issues/2815
 */
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

test('keeps an explicit cookie header in Node', async () => {
  let receivedCookie: string | null = null
  let receivedCookies: Record<string, string> = {}

  server.use(
    http.get('http://localhost/resource', ({ request, cookies }) => {
      receivedCookie = request.headers.get('cookie')
      receivedCookies = cookies
      return HttpResponse.json({ ok: true })
    }),
  )

  const response = await fetch('http://localhost/resource', {
    headers: { cookie: 'session=abc' },
  })

  expect(response.status).toBe(200)
  expect(receivedCookie).toBe('session=abc')
  expect(receivedCookies).toEqual({ session: 'abc' })
})

test('exposes content-length in Node', async () => {
  let receivedContentLength: string | null = null

  server.use(
    http.post('http://localhost/resource', ({ request }) => {
      receivedContentLength = request.headers.get('content-length')
      return HttpResponse.json({ ok: true })
    }),
  )

  const response = await fetch('http://localhost/resource', {
    method: 'POST',
    body: 'a=1&b=2',
  })

  expect(response.status).toBe(200)
  expect(receivedContentLength).toBe('7')
})
