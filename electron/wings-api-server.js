#!/usr/bin/env node
const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')

const APP_DATA_DIR = path.join(os.homedir(), '.config', '.TerverPanel')
const DB_PATH = path.join(APP_DATA_DIR, 'terverpanel.db')
const TOKEN_STORE_PATH = path.join(os.homedir(), '.config', 'terver-panel', 'wings-api-token.json')
const EGGS_DIR = path.join(__dirname, 'eggs')

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) }
  catch { return { servers: [], settings: {} } }
}

function updateServerConfig(serverId, updates) {
  const db = readDB()
  const idx = (db.servers || []).findIndex(s => s.id === serverId)
  if (idx >= 0) {
    db.servers[idx] = { ...db.servers[idx], ...updates }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
  }
}

let wingsApiTokenId = '1'
let wingsApiToken = ''
if (fs.existsSync(TOKEN_STORE_PATH)) {
  try {
    const stored = JSON.parse(fs.readFileSync(TOKEN_STORE_PATH, 'utf8'))
    wingsApiTokenId = stored.tokenId || '1'
    wingsApiToken = stored.token || ''
  } catch {}
}
if (!wingsApiToken) {
  wingsApiToken = crypto.randomBytes(32).toString('hex')
  fs.mkdirSync(path.dirname(TOKEN_STORE_PATH), { recursive: true })
  fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify({ tokenId: wingsApiTokenId, token: wingsApiToken }))
}

function resolveDockerImage(server) {
  const dockerImage = server.dockerImage || ''
  if (!dockerImage) return 'ghcr.io/pelican-eggs/yolks:java_21'
  // Full image ref already (contains registry path or tag)
  if (dockerImage.includes('/') && dockerImage.includes(':')) return dockerImage
  try {
    const eggId = server.eggId || ''
    if (eggId && fs.existsSync(EGGS_DIR)) {
      const parts = eggId.split('/')
      const eggPath = path.join(EGGS_DIR, parts[0], parts[1] + '.json')
      if (fs.existsSync(eggPath)) {
        const egg = JSON.parse(fs.readFileSync(eggPath, 'utf8'))
        const dockerImages = egg.docker_images || {}
        if (dockerImages[dockerImage]) return dockerImages[dockerImage]
        // Key like "Java 25" missing from egg → map by number
        const m = dockerImage.match(/(\d+)/)
        if (m) return `ghcr.io/pelican-eggs/yolks:java_${m[1]}`
      }
    }
  } catch {}
  const m = dockerImage.match(/(\d+)/)
  if (m && !dockerImage.includes('/')) return `ghcr.io/pelican-eggs/yolks:java_${m[1]}`
  if (dockerImage.includes(':') || dockerImage.includes('/')) return dockerImage
  return 'ghcr.io/pelican-eggs/yolks:java_21'
}

function getServers() {
  const db = readDB()
  return (db.servers || []).map(s => {
    const res = s.resources || {}
    const env = s.config || {}
    const startupCmd = s.startup || 'java -Xms128M -jar {{SERVER_JARFILE}} nogui'
    const jarFile = env.SERVER_JARFILE || 'server.jar'
    let resolvedStartup = startupCmd.replace(/\{\{SERVER_JARFILE\}\}/g, jarFile)
    resolvedStartup = resolvedStartup.replace(/\{\{SERVER_MEMORY\}\}/g, String(res.memory || 1024))
    const memFlag = `-Xms128M -Xmx${res.memory || 1024}M`
    let finalStartup = resolvedStartup.replace(/-Xms\d+M -Xmx\d+M/, memFlag)
    if (/\bjava\b/.test(finalStartup) && /-jar\b/.test(finalStartup) && !/\bnogui\b/.test(finalStartup)) {
      finalStartup = `${finalStartup} nogui`
    }
    return {
      settings: {
        uuid: s.id,
        start_on_completion: false,
        meta: { name: s.name, description: s.name, startup_command: finalStartup, egg: { id: '00000000-0000-0000-0000-000000000001' } },
        suspended: false, invocation: finalStartup, skip_egg_scripts: false,
        entrypoint: null, environment: env, labels: {},
        backups: (db.backups || []).filter(b => b.serverId === s.id).map(b => ({
          id: b.uuid, name: b.name, completed_at: b.completed,
          successful: !!b.isSuccessful, size: b.bytes || 0, created_at: b.created,
        })),
        schedules: getSchedules(s.id).map(sch => ({
          id: sch.id,
          name: sch.name,
          cron: sch.cron,
          is_active: !!sch.isActive,
          is_processing: !!sch.isProcessing,
          last_run_at: sch.lastRunAt,
          next_run_at: sch.nextRunAt,
        })),
        allocations: { force_outgoing_ip: false, default: { ip: '0.0.0.0', port: s.port || 25565 }, mappings: {} },
        build: { memory_limit: res.memory || 1024, overhead_memory: 0, swap: 0, io_weight: null,
          cpu_limit: res.cpuPercent || 100, disk_space: res.disk || 10240,
          threads: res.cpuCores ? String(res.cpuCores) : null, oom_disabled: false },
        mounts: [], firewall: [],
        egg: { id: '00000000-0000-0000-0000-000000000001', file_denylist: [] },
        container: { image: resolveDockerImage(s), timezone: null,
          hugepages_passthrough_enabled: false, kvm_passthrough_enabled: false, seccomp: { remove_allowed: [] } },
        auto_kill: { enabled: false, seconds: 0 },         auto_start_behavior: 'never',
        features: { startup_cpu_boost: null, runtime_cpu_boost: null }
      },
      process_configuration: {
        startup: { done: [s.donePattern || ')! For help, type'], strip_ansi: false },
        stop: { type: 'tag', value: s.stopCommand || 'stop' }, configs: []
      }
    }
  })
}

function getServer(uuid) { return getServers().find(s => s.settings?.uuid === uuid) || null }
function getServerByUuid(uuid) { const db = readDB(); return (db.servers || []).find(s => s.id === uuid) || null }

function getSchedules(serverUuid) {
  const db = readDB()
  return (db.schedules || []).filter(s => !serverUuid || s.serverId === serverUuid)
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => { if (!body) return resolve({}); try { resolve(JSON.parse(body)) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.url.startsWith('/api/remote')) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJson(res, 401, { error: 'Unauthorized' })
    }
    const bearerToken = authHeader.slice(7)
    const [reqId, reqToken] = bearerToken.split('.')
    if (reqId !== wingsApiTokenId || reqToken !== wingsApiToken) {
      return sendJson(res, 403, { error: 'Invalid token' })
    }
  }

  try {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1')
    const url = parsedUrl.searchParams
    const reqPath = parsedUrl.pathname
    const method = req.method
    console.log(`[Wings API] ${method} ${reqPath}`)

    // List all servers
    if (method === 'GET' && reqPath === '/api/remote/servers') {
      const page = parseInt(url.get('page')) || 1
      const perPage = parseInt(url.get('per_page')) || 50
      const allServers = getServers()
      const start = (page - 1) * perPage
      const servers = allServers.slice(start, start + perPage)
      const totalPages = Math.ceil(allServers.length / perPage)
      return sendJson(res, 200, {
        data: servers,
        meta: { current_page: page, from: allServers.length > 0 ? start + 1 : 0,
          last_page: totalPages, per_page: perPage, path: '/api/remote/servers',
          to: Math.min(start + perPage, allServers.length), total: allServers.length }
      })
    }

    // Reset state (must be before per-server route)
    if (reqPath === '/api/remote/servers/reset' && method === 'POST') {
      console.log('[Wings API] Wings daemon connected - reset state')
      const servers = getServers()
      return sendJson(res, 200, { data: servers })
    }

    // Server-specific routes
    const match = reqPath.match(/^\/api\/remote\/servers\/([^/]+)\/?(.*)$/)
    if (match) {
      const uuid = match[1]
      const subPath = match[2]

      if (subPath === '' || subPath === '/') {
        if (method === 'GET') {
          const srv = getServer(uuid)
          if (!srv) return sendJson(res, 404, { error: 'Server not found', errors: [] })
          return sendJson(res, 200, srv)
        }
        if (method === 'DELETE') {
          const db = readDB()
          db.servers = (db.servers || []).filter(s => s.id !== uuid)
          fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
          return sendJson(res, 200, { success: true })
        }
        return sendJson(res, 404, { error: 'Not found' })
      }

      if (subPath === 'install' && method === 'GET') {
        const srv = getServer(uuid)
        if (!srv) return sendJson(res, 404, { error: 'Server not found' })
        const dbServer = getServerByUuid(uuid)
        if (!dbServer || dbServer.installedAt) return sendJson(res, 200, { command: '', done: true })
        const eggId = dbServer.eggId || ''
        try {
          const parts = eggId.split('/')
          const eggPath = path.join(EGGS_DIR, parts[0], parts[1] + '.json')
          const raw = fs.readFileSync(eggPath, 'utf8')
          const egg = JSON.parse(raw)
          const install = egg.scripts?.installation || {}
          const envVars = {}
          if (egg.variables) {
            for (const v of egg.variables) {
              if (v.env_variable && v.default_value !== undefined) envVars[v.env_variable] = v.default_value
            }
          }
          if (dbServer.config) Object.assign(envVars, dbServer.config)
          sendJson(res, 200, {
            script: install.script || '',
            container_image: install.container || 'ghcr.io/pelican-eggs/installers:alpine',
            entrypoint: install.entrypoint || 'ash', done: false, environment: envVars
          })
        } catch { sendJson(res, 200, { command: '', done: true }) }
        return
      }

      if (subPath === 'install' && method === 'POST') {
        const body = await parseBody(req)
        const dbServer = getServerByUuid(uuid)
        if (dbServer) {
          if (body.successful !== false) {
            updateServerConfig(dbServer.id, { status: 'stopped', installedAt: new Date().toISOString() })
            console.log(`[Wings API] Install completed for ${uuid}`)
          } else {
            updateServerConfig(dbServer.id, { status: 'error', installError: 'Wings install failed' })
            console.log(`[Wings API] Install FAILED for ${uuid}`)
          }
        }
        return sendJson(res, 200, { successful: true, reinstall: false })
      }

      if (subPath === 'power' && method === 'POST') {
        const body = await parseBody(req)
        console.log(`[Wings API] Power ${body.action} for ${uuid}`)
        return sendJson(res, 200, { ok: true })
      }

      if (subPath === 'commands' && method === 'POST') { return sendJson(res, 200, { ok: true }) }

      if (subPath === 'logs' && method === 'GET') {
        const serverDir = path.join(APP_DATA_DIR, 'wings', 'servers', uuid)
        const logFile = path.join(serverDir, 'logs', 'latest.log')
        try {
          if (fs.existsSync(logFile)) return sendJson(res, 200, { logs: fs.readFileSync(logFile, 'utf8') })
          return sendJson(res, 200, { logs: '' })
        } catch { return sendJson(res, 200, { logs: '' }) }
      }

      if (subPath === 'sync' && method === 'POST') { return sendJson(res, 200, { ok: true }) }
      if (subPath === 'reinstall' && method === 'POST') { return sendJson(res, 200, { ok: true }) }

      if (subPath.startsWith('files')) {
        const fileSubPath = subPath.split('files/')[1] || ''
        const serverDir = path.join(APP_DATA_DIR, 'wings', 'servers', uuid)

        if (fileSubPath === 'list' && method === 'GET') {
          const dir = url.get('directory') || '/'
          const targetDir = dir === '/' ? serverDir : path.join(serverDir, dir)
          try {
            if (!fs.existsSync(targetDir)) return sendJson(res, 200, { data: [] })
            const entries = fs.readdirSync(targetDir, { withFileTypes: true })
            const files = entries.map(e => ({
              name: e.name, is_dir: e.isDirectory(),
              size: e.isFile() ? (fs.statSync(path.join(targetDir, e.name)).size || 0) : 0,
              modified: fs.statSync(path.join(targetDir, e.name)).mtime.toISOString()
            })).sort((a, b) => (b.is_dir - a.is_dir) || a.name.localeCompare(b.name))
            return sendJson(res, 200, { data: files })
          } catch { return sendJson(res, 200, { data: [] }) }
        }

        if (fileSubPath === 'read' && method === 'GET') {
          const file = url.get('file') || ''
          try { return sendJson(res, 200, { content: fs.readFileSync(path.join(serverDir, file), 'utf8') }) }
          catch { return sendJson(res, 200, { content: '' }) }
        }

        if (fileSubPath === 'write' && method === 'POST') {
          const file = url.get('file') || ''
          const content = await parseBody(req)
          const filePath = path.join(serverDir, file)
          try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true })
            fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content))
            return sendJson(res, 200, { success: true })
          } catch (err) { return sendJson(res, 500, { error: err.message }) }
        }

        if (fileSubPath === 'delete' && method === 'DELETE') {
          const files = url.getAll('files[]') || []
          for (const f of files) {
            const filePath = path.join(serverDir, f)
            try { const st = fs.statSync(filePath); if (st.isDirectory()) fs.rmSync(filePath, { recursive: true }); else fs.unlinkSync(filePath) } catch {}
          }
          return sendJson(res, 200, { success: true })
        }
      }

      // Default fallback
      return sendJson(res, 404, { error: 'Not found' })
    }

    // Activity
    if (reqPath === '/api/remote/activity' && method === 'POST') { return sendJson(res, 200, { ok: true }) }
    if (reqPath === '/api/remote/schedule' && method === 'POST') {
      const body = await parseBody(req)
      // Wings fires schedule notifications; just acknowledge (panel runs its own cron runner)
      return sendJson(res, 200, { ok: true, received: body || {} })
    }
    if (reqPath === '/api/remote/sftp/auth' && method === 'POST') { return sendJson(res, 401, { error: 'SFTP not supported in local mode' }) }

    // Catch-all for unknown endpoints
    console.log(`[Wings API] ${method} ${reqPath} - unknown endpoint`)
    sendJson(res, 200, { ok: true })
  } catch (err) {
    sendJson(res, 500, { error: err.message })
  }
})

server.on('error', (err) => console.error('[Wings API Server] Error:', err.message))
server.listen(6543, '127.0.0.1', () => {
  console.log('[Wings API Server] Listening on http://127.0.0.1:6543')
  console.log('[Wings API Server] DB:', DB_PATH)
})
