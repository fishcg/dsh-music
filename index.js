/**
 * dsh-music — Host half.
 *
 * Starts a loopback HTTP proxy to https://www.acgay.cn so the Client half can
 * embed the real site in an iframe (the production site sends
 * `X-Frame-Options: DENY`, and its `/_next/*` assets are root-absolute, so a
 * DSH-path proxy would collide with DSH's own assets).
 *
 * The proxy strips frame/CSP headers, injects a tiny bridge script into HTML
 * pages, and exposes `/__dsh_acgay_bridge.js` for that script. The Client half
 * reads the proxy URL from `/dsh-acgay/state`.
 */

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const BRIDGE_FILE = path.join(PACKAGE_ROOT, 'assets', 'bridge.js')

const UPSTREAM = 'https://www.acgay.cn'
const ROUTE_BASE = '/dsh-music'
const STATE_ROUTE = `${ROUTE_BASE}/state`
const IMPORT_ROUTE = `${ROUTE_BASE}/import`
const VERSION = '0.2.0'
const WORKER_SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'import-one.mjs')
const NODE_BIN = process.env.DSH_ACGAY_NODE_BIN || process.execPath
const TOKEN_ENV = 'ACGAY_IMPORT_TOKEN'
const TOKEN_FILE_ENV = 'ACGAY_IMPORT_TOKEN_FILE'
const TOKEN_FILES = [
  path.join(os.homedir(), '.acgay-import-token'),
  path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'acgay-import-token'),
]

/** Resolve the optional import credential: env, plugin config, then files. */
function resolveImportToken(config = {}) {
  const fromEnv = String(process.env[TOKEN_ENV] || '').trim()
  if (fromEnv) return fromEnv
  const fromConfig = String((config && (config.importToken || config.token)) || '').trim()
  if (fromConfig) return fromConfig
  const customFile = String(process.env[TOKEN_FILE_ENV] || '').trim()
  const candidates = customFile ? [customFile, ...TOKEN_FILES] : TOKEN_FILES
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue
      const value = fs.readFileSync(file, 'utf8').trim()
      if (value) return value
    } catch {
      // Try the next location.
    }
  }
  return ''
}

const HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const DROP_RESPONSE_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'strict-transport-security',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
])

let proxyState = null

function readBody(req, limit = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function rewriteLocation(location) {
  if (!location) return location
  try {
    const parsed = new URL(location, UPSTREAM)
    if (parsed.origin === UPSTREAM) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    // Leave relative/odd locations untouched.
  }
  return location
}

function stripCookieDomain(value) {
  return String(value)
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*Secure/gi, '')
    .replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
}

function withCors(headers) {
  headers['access-control-allow-origin'] = '*'
  headers['access-control-allow-methods'] = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS'
  headers['access-control-allow-headers'] = '*'
  headers['access-control-expose-headers'] = '*'
}

function serveBridge(res) {
  let body
  try {
    body = fs.readFileSync(BRIDGE_FILE)
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`bridge unavailable: ${String(error && error.message)}`)
    return
  }
  res.writeHead(200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'content-length': body.length,
  })
  res.end(body)
}


async function handleProxy(req, res) {
  if (req.method === 'OPTIONS') {
    const headers = {}
    withCors(headers)
    res.writeHead(204, headers)
    res.end()
    return
  }

  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')
  if (requestUrl.pathname === '/__dsh_acgay_bridge.js') {
    serveBridge(res)
    return
  }

  let target
  try {
    target = new URL(`${requestUrl.pathname}${requestUrl.search}`, UPSTREAM)
  } catch {
    sendJson(res, 400, { ok: false, error: 'bad request path' })
    return
  }

  const headers = {}
  for (const [name, value] of Object.entries(req.headers)) {
    const key = name.toLowerCase()
    if (HOP_HEADERS.has(key) || key === 'host' || key === 'content-length') continue
    if (Array.isArray(value)) headers[key] = value.join(', ')
    else if (value !== undefined) headers[key] = value
  }
  headers['accept-encoding'] = 'identity'

  let body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await readBody(req)
    } catch (error) {
      sendJson(res, 413, { ok: false, error: String(error && error.message) })
      return
    }
  }

  let upstream
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: `acgay upstream unreachable: ${String(error && error.message)}`,
    })
    return
  }

  const responseHeaders = {}
  upstream.headers.forEach((value, name) => {
    const key = name.toLowerCase()
    if (DROP_RESPONSE_HEADERS.has(key)) return
    if (key === 'set-cookie') return
    responseHeaders[key] = value
  })
  withCors(responseHeaders)

  const cookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : []
  if (cookies.length > 0) responseHeaders['set-cookie'] = cookies.map(stripCookieDomain)
  const location = upstream.headers.get('location')
  if (location) responseHeaders.location = rewriteLocation(location)

  const contentType = upstream.headers.get('content-type') || ''
  if (contentType.includes('text/html')) {
    let html = await upstream.text()
    if (!html.includes('/__dsh_acgay_bridge.js')) {
      const tag = '<script src="/__dsh_acgay_bridge.js" data-dsh-acgay-bridge></script>'
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${tag}</body>`) : `${html}${tag}`
    }
    responseHeaders['content-type'] = 'text/html; charset=utf-8'
    res.writeHead(upstream.status, responseHeaders)
    res.end(req.method === 'HEAD' ? undefined : html)
    return
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  if (req.method !== 'HEAD') responseHeaders['content-length'] = String(buffer.length)
  res.writeHead(upstream.status, responseHeaders)
  res.end(req.method === 'HEAD' ? undefined : buffer)
}

function startProxy() {
  if (proxyState !== null) return proxyState

  proxyState = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleProxy(req, res).catch((error) => {
        try {
          sendJson(res, 500, { ok: false, error: String(error && error.message) })
        } catch {
          // Response may already be committed.
        }
      })
    })
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      if (!port) {
        server.close()
        reject(new Error('cannot bind acgay proxy'))
        return
      }
      resolve({
        server,
        origin: `http://127.0.0.1:${port}`,
      })
    })
  }).catch((error) => {
    proxyState = null
    throw error
  })

  return proxyState
}

function isLoopbackHost(hostHeader) {
  const host = String(hostHeader || '').toLowerCase()
  const hostname = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0]
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
}

function requestAllowed(req) {
  if (!isLoopbackHost(req.headers.host)) return false
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false
  return true
}


function runImportWorker(query, token) {
  return new Promise((resolve) => {
    const child = spawn(NODE_BIN, [WORKER_SCRIPT, query], {
      cwd: PACKAGE_ROOT,
      env: { ...process.env, [TOKEN_ENV]: token || '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
    }, 15 * 60 * 1000)
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ ok: false, error: String(error && error.message) })
    })
    child.on('close', () => {
      clearTimeout(timer)
      const lines = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('{'))
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        try {
          resolve(JSON.parse(lines[index]))
          return
        } catch {
          // Try an earlier JSON line.
        }
      }
      resolve({
        ok: false,
        error: `导入进程没有返回结果${stderr ? `：${stderr.slice(-800)}` : ''}`,
      })
    })
  })
}

export function apply(root, config = {}) {
  const settings = {
    enabled: config.enabled !== false,
  }
  if (!settings.enabled) return

  // The proxy is independent of the DSH web server: it is a second loopback
  // listener used as the iframe origin.
  root.effect(() => {
    const started = startProxy()
    return () => {
      // Drop the module-level cache before closing: a disabled then re-enabled
      // plugin must create a fresh listener, not reuse a closed one.
      const pending = proxyState
      proxyState = null
      ;(pending || started)
        .then(({ server }) => {
          try {
            server.close()
            if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
          } catch {
            // Already closed.
          }
        })
        .catch(() => {
          // Startup failed; nothing to close.
        })
    }
  })

  root.inject(['webServer'], (ctx) => {
    ctx.webServer.register({
      kind: 'exact',
      path: STATE_ROUTE,
      handler: async (req, res) => {
        if (!requestAllowed(req)) {
          sendJson(res, 403, { ok: false, error: 'forbidden' })
          return
        }
        try {
          const { origin } = await startProxy()
          const token = resolveImportToken(config)
          sendJson(res, 200, {
            ok: true,
            version: VERSION,
            origin,
            upstream: UPSTREAM,
            imports: Boolean(token),
          })
        } catch (error) {
          sendJson(res, 500, { ok: false, error: String(error && error.message) })
        }
      },
    })

    // Automatic-import fallback: one searched query -> existing import CLI ->
    // publish the fresh row to the production acgay database. The worker runs
    // as a short-lived child process, not as a second web service.
    ctx.webServer.register({
      kind: 'exact',
      path: IMPORT_ROUTE,
      handler: async (req, res) => {
        if (!requestAllowed(req)) {
          sendJson(res, 403, { ok: false, error: 'forbidden' })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        const token = resolveImportToken(config)
        if (!token) {
          sendJson(res, 503, {
            ok: false,
            error: '未配置 ACGAY_IMPORT_TOKEN，导入功能已关闭',
          })
          return
        }
        let payload
        try {
          payload = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8'))
        } catch {
          sendJson(res, 400, { ok: false, error: 'invalid JSON body' })
          return
        }
        const query = String((payload && payload.query) || '').trim().slice(0, 80)
        if (!query) {
          sendJson(res, 400, { ok: false, error: 'query is required' })
          return
        }
        try {
          const result = await runImportWorker(query, token)
          if (!result || result.ok !== true) {
            sendJson(res, 422, {
              ok: false,
              error: (result && result.error) || '自动抓取没有成功',
              candidates: result && result.candidates,
            })
            return
          }
          sendJson(res, 200, { ...result, ok: true })
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: `自动抓取失败：${String((error && error.message) || error)}`,
          })
        }
      },
    })

  })
}

export default {
  name: 'dsh-music',
  apply,
}
