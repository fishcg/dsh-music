#!/usr/bin/env node
/**
 * Thin wrapper behind the DSH plugin's "抓取并入库" action.
 *
 * The real work is done by import-direct.mjs:
 *   Bilibili search/pick -> download -> ffmpeg -> POST /api/plugin/import
 * so nothing is written to a local MySQL database or local OSS client here.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url))
const NODE = process.env.DSH_ACGAY_NODE_BIN || process.execPath
const WORKER = path.join(PLUGIN_DIR, 'import-direct.mjs')

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PLUGIN_DIR,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`import-direct timed out after ${options.timeoutMs || 600000}ms`))
    }, options.timeoutMs || 600000)

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`import-direct exited ${code}: ${(stderr || stdout).slice(-1200)}`))
    })
  })
}

async function main() {
  const raw = process.argv.slice(2).join(' ').trim()
  if (!raw) throw new Error('missing query/bvid')
  const isBvid = /^BV[0-9A-Za-z]{10}$/.test(raw)
  const payload = isBvid ? { bvid: raw } : { query: raw }
  const { stdout, stderr } = await run(NODE, [WORKER, JSON.stringify(payload)], { timeoutMs: 600000 })

  const lines = String(stdout)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
  let parsed = null
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { parsed = JSON.parse(lines[index]); break } catch { /* keep looking */ }
  }
  if (!parsed) throw new Error(`import-direct 没有返回 JSON：${(stderr || stdout).slice(-500)}`)
  console.log(JSON.stringify(parsed))
}

main().catch((error) => {
  console.log(JSON.stringify({ ok: false, error: String((error && error.message) || error) }))
  process.exitCode = 1
})
