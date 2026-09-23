// TerverPanel - Electron Main Process
// Gaming Hosting Launcher for Minecraft

const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, shell, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const os = require('os')
const { spawn, spawnSync } = require('child_process')

const isDev = process.env.NODE_ENV === 'development'

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

let mainWindow = null
let tray = null

function sendProgress(key, percent, message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('install:progress', { key, percent, message })
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.setAppUserModelId('com.terverpanel.app')

const APP_DATA_DIR = path.join(app.getPath('appData'), '.TerverPanel')
const LOCAL_DB_FILE = path.join(APP_DATA_DIR, 'terverpanel.db')

const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
  return salt + ':' + hash
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':')
    const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'))
  } catch {
    return false
  }
}

function generateUUID() {
  return crypto.randomUUID()
}

function ensureAppDataDir() {
  if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR, { recursive: true })
}

function readDB() {
  ensureAppDataDir()
  try {
    if (!fs.existsSync(LOCAL_DB_FILE)) {
      const initial = { users: [], sessions: [], servers: [], settings: {} }
      fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(initial, null, 2), { mode: 0o600 })
      return initial
    }
    return JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'))
  } catch {
    return { users: [], sessions: [], servers: [], settings: {} }
  }
}

function writeDB(data) {
  ensureAppDataDir()
  const tmp = LOCAL_DB_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, LOCAL_DB_FILE)
}

const DEFAULT_SETTINGS = {
  language: 'vi',
  theme: 'dark',
  autoCheckDocker: true,
  savedUsername: '',
  savedPassword: '',
  rememberMe: false,
}

function sanitizeSettings(input) {
  const safe = Object.assign({}, DEFAULT_SETTINGS)
  if (!input || typeof input !== 'object') return safe
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key in input) safe[key] = input[key]
  }
  if (input.paths && typeof input.paths === 'object') safe.paths = input.paths
  if ('setupComplete' in input) safe.setupComplete = input.setupComplete
  if (input.autoStart && typeof input.autoStart === 'object') safe.autoStart = input.autoStart
  return safe
}

function getDefaultPaths() {
  const home = os.homedir()
  const base = `${home}/.terverpanel`
  return {
    base,
    docker: `${base}/docker`,
    wings: `${base}/wings`,
    wingsConfig: `${base}/wings-config`,
    cloudflare: `${base}/cloudflare`,
    database: `${base}/database`,
    downloads: `${base}/downloads`,
    servers: `${base}/servers`,
    logs: `${base}/logs`,
  }
}

function readSettings() {
  const db = readDB()
  const settings = sanitizeSettings(db.settings || {})
  if (!settings.paths || !settings.paths.base) {
    settings.paths = getDefaultPaths()
  }
  return settings
}

function writeSettings(patch) {
  const db = readDB()
  db.settings = sanitizeSettings(Object.assign({}, db.settings || {}, patch))
  writeDB(db)
  return db.settings
}

function addServerConfig(server) {
  const db = readDB()
  db.servers = db.servers || []
  db.servers.push(server)
  writeDB(db)
  return db.servers
}

function removeServerConfig(id) {
  const db = readDB()
  db.servers = (db.servers || []).filter(s => s.id !== id)
  writeDB(db)
  return db.servers
}

function listServerConfigs() {
  const db = readDB()
  return db.servers || []
}

function updateServerConfig(id, updates) {
  const db = readDB()
  db.servers = (db.servers || []).map(s => s.id === id ? { ...s, ...updates } : s)
  writeDB(db)
  return db.servers.find(s => s.id === id) || null
}

function getServerByUuid(uuid) {
  const db = readDB()
  return (db.servers || []).find(s => s.id === uuid || s.uuid === uuid) || null
}

function appendServerHistory(serverId, action) {
  try {
    const server = getServerByUuid(serverId)
    if (!server) return
    const history = Array.isArray(server.history) ? server.history : []
    const now = Date.now()
    const last = history[0]
    if (last && last.action === action) {
      if (action === 'start' || action === 'stop' || action === 'kill') return
      if (now - (last.at || 0) < 3000) return
    }
    const next = [{ at: now, action }, ...history].slice(0, 20)
    updateServerConfig(serverId, { history: next })
  } catch {}
}

function dedupeServerHistory(history) {
  if (!Array.isArray(history)) return []
  const out = []
  for (const item of history) {
    if (out[0] && out[0].action === item.action &&
        (item.action === 'start' || item.action === 'stop' || item.action === 'kill')) {
      continue
    }
    // Drop false "start" that status polling wrote right after a stop/kill
    if (item.action === 'start' && out[0] &&
        (out[0].action === 'stop' || out[0].action === 'kill') &&
        (item.at || 0) - (out[0].at || 0) < 3000) {
      continue
    }
    out.push(item)
  }
  return out
}

function cleanServerHistoryOnDisk(serverId) {
  try {
    const server = getServerByUuid(serverId)
    if (!server || !Array.isArray(server.history) || server.history.length === 0) return
    const cleaned = dedupeServerHistory(server.history)
    if (cleaned.length !== server.history.length) {
      updateServerConfig(serverId, { history: cleaned.slice(0, 20) })
    }
  } catch {}
}

const _serverTps = new Map()
const _serverTpsSamples = new Map()
const _tpsPollers = new Map()
const TPS_MEAN_WINDOW_MS = 30000
const TPS_MEAN_MAX_SAMPLES = 12

function clampTps(n) {
  if (!Number.isFinite(n) || n < 0) return null
  if (n > 20.5) return 20
  return Math.round(n * 100) / 100
}

function meanTps(samples) {
  if (!samples.length) return null
  let sum = 0
  for (const s of samples) sum += s.v
  return Math.round((sum / samples.length) * 100) / 100
}

function pruneTpsSamples(list, now = Date.now()) {
  const cutoff = now - TPS_MEAN_WINDOW_MS
  let i = 0
  while (i < list.length && list[i].at < cutoff) i++
  const kept = i > 0 ? list.slice(i) : list
  return kept.length > TPS_MEAN_MAX_SAMPLES
    ? kept.slice(kept.length - TPS_MEAN_MAX_SAMPLES)
    : kept
}

function parseTpsSamplesFromText(text) {
  if (!text) return []
  const t = String(text)
  const out = []
  const push = (n) => {
    const v = clampTps(parseFloat(n))
    if (v != null) out.push(v)
  }

  // Forge/NeoForge: prefer Overall line, else average all Mean TPS lines in this chunk
  const overall = t.match(/Overall\s*:\s*[\s\S]*?Mean TPS:\s*([\d]+(?:\.[\d]+)?)/i)
  if (overall) { push(overall[1]); return out }

  const meanAll = t.match(/Mean TPS:\s*([\d]+(?:\.[\d]+)?)/gi)
  if (meanAll && meanAll.length) {
    let sum = 0
    let n = 0
    for (const hit of meanAll) {
      const v = clampTps(parseFloat(String(hit).replace(/.*Mean TPS:\s*/i, '')))
      if (v != null) { sum += v; n++ }
    }
    if (n) { out.push(clampTps(sum / n)); return out }
  }

  // Paper/Spigot/Purpur: TPS from last 1m, 5m, 15m: a, b, c
  let m = t.match(/TPS from last[\s\S]{0,300}?\*?\s*([\d]+(?:\.[\d]+)?)\s*,\s*([\d]+(?:\.[\d]+)?)\s*,\s*([\d]+(?:\.[\d]+)?)/i)
  if (m) {
    push(m[1]); push(m[2]); push(m[3])
    return out
  }

  m = t.match(/TPS from last[^:\n]*:\s*([\d]+(?:\.[\d]+)?)/i)
  if (m) { push(m[1]); return out }

  m = t.match(/\bavg\s+TPS\s*[:=]?\s*([\d]+(?:\.[\d]+)?)/i)
  if (m) { push(m[1]); return out }

  m = t.match(/\b(?:current\s+)?TPS\s*[:=]\s*([\d]+(?:\.[\d]+)?)/i)
  if (m) { push(m[1]); return out }

  m = t.match(/([\d]+\.[\d]+)\s*,\s*([\d]+\.[\d]+)\s*,\s*([\d]+\.[\d]+)/)
  if (m) {
    const a = parseFloat(m[1])
    if (a >= 0 && a <= 20.5) { push(m[1]); push(m[2]); push(m[3]); return out }
  }

  m = t.match(/\bMSPT\s*[:=]?\s*([\d]+(?:\.[\d]+)?)/i)
  if (m) {
    const mspt = parseFloat(m[1])
    if (mspt > 0 && mspt < 5000) push(1000 / mspt)
  }

  return out
}

function setServerTps(serverId, samples) {
  const list = Array.isArray(samples) ? samples : [samples]
  const now = Date.now()
  let buffer = _serverTpsSamples.get(serverId) || []
  for (const raw of list) {
    const v = clampTps(raw)
    if (v == null) continue
    buffer.push({ v, at: now })
  }
  if (!buffer.length) return false
  buffer = pruneTpsSamples(buffer, now)
  _serverTpsSamples.set(serverId, buffer)

  const mean = meanTps(buffer)
  if (mean == null) return false
  const prev = _serverTps.get(serverId)
  if (prev && Math.abs(prev.tps - mean) < 0.05 && now - prev.at < 15000) {
    prev.at = now
    prev.samples = buffer.length
    return true
  }
  _serverTps.set(serverId, { tps: mean, at: now, samples: buffer.length })
  try {
    const server = getServerByUuid(serverId)
    if (!server || Math.abs((server.lastTps || 0) - mean) >= 0.05) {
      updateServerConfig(serverId, { lastTps: mean, lastTpsAt: now })
    }
  } catch {}
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('server:tps', { serverId, tps: mean, at: now, samples: buffer.length })
  }
  return true
}

function ingestTpsLine(serverId, line) {
  if (!line) return
  const samples = parseTpsSamplesFromText(line)
  if (samples.length) setServerTps(serverId, samples)
}

function clearServerTps(serverId) {
  _serverTps.delete(serverId)
  _serverTpsSamples.delete(serverId)
}

function stopTpsPoller(serverId) {
  const t = _tpsPollers.get(serverId)
  if (t) {
    clearInterval(t)
    _tpsPollers.delete(serverId)
  }
}

function tpsCommandsForEgg(eggId) {
  const id = String(eggId || '').toLowerCase()
  const [game, egg] = id.split('/')
  if (game !== 'minecraft') return []
  switch (egg) {
    case 'forge':
    case 'neoforge':
      return ['forge tps']
    case 'paper':
    case 'purpur':
    case 'spigot':
      return ['tps']
    case 'fabric':
    case 'vanilla':
      return ['tick query', 'tps']
    default:
      return ['tps', 'tick query']
  }
}

async function sendTpsProbe(serverId) {
  const server = getServerByUuid(serverId)
  const cmds = tpsCommandsForEgg(server?.eggId)
  if (!cmds.length) return
  for (const cmd of cmds) {
    try {
      if (sendWingsWs(serverId, 'send command', [cmd])) return
    } catch {}
  }
  try {
    await wingsApiCall('POST', `/api/servers/${serverId}/commands`, { commands: [cmds[0]] })
  } catch {}
}

function startTpsPoller(serverId) {
  if (_tpsPollers.has(serverId)) return
  const iv = setInterval(() => { sendTpsProbe(serverId).catch(() => {}) }, 8000)
  _tpsPollers.set(serverId, iv)
  setTimeout(() => { sendTpsProbe(serverId).catch(() => {}) }, 2500)
}

function stopTpsPollerFor(serverId) {
  stopTpsPoller(serverId)
}

function getSettings() {
  const db = readDB()
  return db.settings || {}
}

const WINGS_DATA_DIR = path.join(app.getPath('appData'), '.TerverPanel', 'wings', 'servers')

function resolveIconPath() {
  const devPath = path.join(__dirname, '../public/icon.ico')
  if (isDev && fs.existsSync(devPath)) return devPath
  const resourcesIcon = path.join(process.resourcesPath, 'icon.ico')
  if (fs.existsSync(resourcesIcon)) return resourcesIcon
  const exeDir = path.dirname(process.execPath)
  const exeIcon = path.join(exeDir, 'resources', 'icon.ico')
  if (fs.existsSync(exeIcon)) return exeIcon
  return devPath
}

function resolveTrayIconPath() {
  const candidates = []
  if (isDev) candidates.push(path.join(__dirname, '../public/icon.png'))
  candidates.push(path.join(process.resourcesPath, 'icon.png'))
  candidates.push(path.join(path.dirname(process.execPath), 'resources', 'icon.png'))
  if (isDev) candidates.push(path.join(__dirname, '../public/icon.png'))
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return resolveIconPath()
}

const ICON_PATH = resolveIconPath()
const TRAY_ICON_PATH = resolveTrayIconPath()

function getTrustedWindow(event) {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return null
  return win
}

function secureWebPrefs() {
  return {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubframes: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
  }
}

function createMainWindow() {
  const icon = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : undefined

  mainWindow = new BrowserWindow({
    width: 1150, height: 680,
    minWidth: 1150, minHeight: 680,
    maxWidth: 1150, maxHeight: 680,
    resizable: false,
    maximizable: false,
    frame: false, transparent: false,
    show: false,
    backgroundColor: '#0a0a0a',
    title: 'TerverPanel',
    icon,
    webPreferences: secureWebPrefs(),
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    shell.openExternal(url)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  try {
    let trayIcon
    if (fs.existsSync(TRAY_ICON_PATH)) {
      trayIcon = nativeImage.createFromPath(TRAY_ICON_PATH).resize({ width: 16, height: 16 })
    } else {
      trayIcon = nativeImage.createEmpty()
    }

    tray = new Tray(trayIcon)
    tray.setToolTip('TerverPanel')
    tray.setTitle('TerverPanel')

    const openMainWindow = () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow()
        return
      }
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }

    const trayMenu = Menu.buildFromTemplate([
      { label: 'TerverPanel', enabled: false },
      { type: 'separator' },
      { label: 'Mở TerverPanel', click: () => openMainWindow() },
      { type: 'separator' },
      {
        label: 'Thoát',
        click: () => {
          app.isQuitting = true
          app.quit()
        },
      },
    ])

    tray.setContextMenu(trayMenu)
    tray.on('click', () => { openMainWindow() })
    tray.on('double-click', () => { openMainWindow() })
  } catch (err) {
    console.error('[Tray] Failed to create tray:', err.message)
  }
}

ipcMain.on('window-minimize', (e) => { const w = getTrustedWindow(e); if (w) w.minimize() })
ipcMain.on('window-maximize', (e) => {
  const win = getTrustedWindow(e)
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.on('window-close', (e) => {
  const win = getTrustedWindow(e)
  if (!win) return
  win.hide()
})

ipcMain.on('quit-app', () => {
  app.isQuitting = true
  app.quit()
})

ipcMain.handle('app:version', (e) => {
  if (!getTrustedWindow(e)) return null
  return app.getVersion()
})

ipcMain.handle('clipboard:write', (e, text) => {
  if (!getTrustedWindow(e)) return { ok: false, error: 'Unauthorized' }
  try {
    clipboard.writeText(String(text ?? ''))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('app:openExternal', (e, url) => {
  if (!getTrustedWindow(e)) return null
  shell.openExternal(url)
  return true
})

ipcMain.handle('settings:get', () => {
  return readSettings()
})

ipcMain.handle('settings:save', (e, patch) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (!patch || typeof patch !== 'object') return { error: 'Du lieu khong hop le' }
  const updated = writeSettings(patch)
  return { ok: true, data: updated }
})

ipcMain.handle('dialog:openFolder', async (e, defaultPath) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { dialog } = require('electron')
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath || os.homedir(),
  })
  if (result.canceled || !result.filePaths?.length) return { canceled: true }
  return { path: result.filePaths[0] }
})

ipcMain.handle('auth:register', (e, { username, password }) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return { error: 'Username chi duoc chua chu, so va _ (3-16 ky tu)' }
  }
  if (typeof password !== 'string' || password.length < 6) {
    return { error: 'Mat khau phai it nhat 6 ky tu' }
  }

  const db = readDB()
  const exists = db.users.find(u => u.username === username)
  if (exists) return { error: 'Ten nguoi dung da ton tai' }

  const newUser = {
    id: generateUUID(),
    username,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }

  db.users.push(newUser)
  writeDB(db)

  return { ok: true, user: { id: newUser.id, username: newUser.username, createdAt: newUser.createdAt } }
})

ipcMain.handle('auth:login', (e, { username, password, rememberMe }) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }

  const db = readDB()
  const user = db.users.find(u => u.username === username)
  if (!user) return { error: 'Tai khoan hoac mat khau khong dung' }

  if (!verifyPassword(password, user.passwordHash)) {
    return { error: 'Tai khoan hoac mat khau khong dung' }
  }

  const session = {
    id: generateUUID(),
    userId: user.id,
    username: user.username,
    createdAt: new Date().toISOString(),
  }

  db.sessions = db.sessions || []
  db.sessions.push(session)
  db.currentSession = session.id
  writeDB(db)

  if (rememberMe) {
    writeSettings({ savedUsername: username, savedPassword: password, rememberMe: true })
  } else {
    writeSettings({ savedUsername: '', savedPassword: '', rememberMe: false })
  }

  return { ok: true, session, user: { id: user.id, username: user.username, createdAt: user.createdAt } }
})

ipcMain.handle('auth:logout', (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const db = readDB()
  db.currentSession = null
  writeDB(db)
  return { ok: true }
})

ipcMain.handle('auth:getSession', (e) => {
  if (!getTrustedWindow(e)) return null
  const db = readDB()
  if (!db.currentSession || !db.sessions) return null
  const session = db.sessions.find(s => s.id === db.currentSession)
  if (!session) return null
  const user = db.users.find(u => u.id === session.userId)
  if (!user) return null
  return { ok: true, session, user: { id: user.id, username: user.username, createdAt: user.createdAt } }
})

ipcMain.handle('auth:checkDocker', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { exec } = require('child_process')
  return new Promise((resolve) => {
    exec('docker --version', { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({ installed: false, version: null })
      resolve({ installed: true, version: (stdout || '').replace(/\n/g, '').trim() })
    })
  })
})

ipcMain.handle('auth:checkDockerRunning', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { exec } = require('child_process')
  return new Promise((resolve) => {
    exec('docker info', { timeout: 5000 }, (err) => {
      if (err) return resolve({ running: false })
      resolve({ running: true })
    })
  })
})

ipcMain.handle('docker:startServer', async (e, opts) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { exec } = require('child_process')
  const { name, version, port, memory, levelName, gamemode, difficulty } = opts
  const portMapping = port + ':25565'
  const memFlag = memory ? '--memory=' + memory + 'g' : '--memory=2g'
  const cmd = 'docker run -d --name ' + name + ' -p ' + portMapping + ' ' + memFlag +
    ' -e EULA=TRUE -e LEVEL_NAME=' + levelName +
    ' -e GAME_MODE=' + gamemode +
    ' -e DIFFICULTY=' + difficulty +
    ' itzg/minecraft-server:' + version
  return new Promise((resolve) => {
    exec(cmd, { timeout: 60000 }, (err, stdout) => {
      if (err) return resolve({ error: err.message })
      resolve({ ok: true, containerId: (stdout || '').replace(/\n/g, '').trim() })
    })
  })
})

ipcMain.handle('docker:stopServer', async (e, name) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { exec } = require('child_process')
  return new Promise((resolve) => {
    exec('docker stop ' + name + ' && docker rm ' + name, { timeout: 30000 }, (err) => {
      if (err) return resolve({ error: err.message })
      resolve({ ok: true })
    })
  })
})

ipcMain.handle('docker:listServers', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { exec } = require('child_process')
  return new Promise((resolve) => {
    exec('docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}"', { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve({ servers: [] })
      const lines = (stdout || '').trim().split('\n').filter(Boolean)
      const servers = lines
        .filter(l => l.includes('25565'))
        .map(function(line) {
          const parts = line.split('|')
          return { name: parts[0], status: parts[1] || '', port: null }
        })
      resolve({ servers: servers })
    })
  })
})

ipcMain.handle('docker:getServerLogs', async (e, name) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { exec } = require('child_process')
  return new Promise((resolve) => {
    exec('docker logs --tail 100 ' + name, { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve({ error: err.message })
      resolve({ logs: stdout || '' })
    })
  })
})

ipcMain.handle('server:getConfigs', (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  return { ok: true, servers: listServerConfigs() }
})

ipcMain.handle('server:getConfig', (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = getServerByUuid(serverId)
  if (!server) return { ok: false, error: 'Server not found' }
  return { ok: true, server }
})

function ensureEula(serverId) {
  try {
    const dir = path.join(WINGS_DATA_DIR, serverId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o755 })
    const p = path.join(dir, 'eula.txt')
    let needWrite = true
    if (fs.existsSync(p)) {
      const cur = fs.readFileSync(p, 'utf8')
      needWrite = !/eula\s*=\s*true/i.test(cur)
    }
    if (needWrite) {
      fs.writeFileSync(p, '#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA)\neula=true\n')
      return true
    }
  } catch {}
  return false
}

function requiredJavaForVersion(raw) {
  const low = String(raw || '').trim().toLowerCase()
  if (!low || low === 'latest' || low === 'snapshot') return 0
  const m = low.match(/^(\d+)\.(\d+)/)
  if (m) {
    const major = parseInt(m[1], 10)
    const minor = parseInt(m[2], 10)
    if (major >= 25) return 25
    if (major === 1) {
      if (minor > 21) return 25
      if (minor === 21) {
        const patch = parseInt((low.split('.')[2] || '0').replace(/\D.*/, ''), 10) || 0
        return patch >= 9 ? 25 : 21
      }
      if (minor === 20) {
        const patch = parseInt((low.split('.')[2] || '0').replace(/\D.*/, ''), 10) || 0
        return patch >= 5 ? 21 : 17
      }
      if (minor >= 17) return 17
      if (minor >= 13) return 16
      return 8
    }
    if (major >= 21 && major <= 24) return 21
  }
  return 0
}

function currentJavaFromImage(img) {
  const m = String(img || '').match(/java[_-](\d+)/i)
  return m ? parseInt(m[1], 10) : 0
}

// Resolve Docker image ref from egg key (e.g. "Java 25") or full image path
function resolveDockerImage(server) {
  const dockerImage = server.dockerImage || ''
  if (!dockerImage) return 'ghcr.io/pelican-eggs/yolks:java_21'
  if (dockerImage.includes('/') && dockerImage.includes(':')) return dockerImage
  try {
    const eggId = server.eggId || ''
    const eggsDir = path.join(__dirname, 'eggs')
    if (eggId && fs.existsSync(eggsDir)) {
      const parts = eggId.split('/')
      const filePath = path.join(eggsDir, parts[0], parts[1] + '.json')
      if (fs.existsSync(filePath)) {
        const egg = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        const dockerImages = egg.docker_images || {}
        if (dockerImages[dockerImage]) return dockerImages[dockerImage]
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

function ensureJava(serverId) {
  try {
    const server = getServerByUuid(serverId)
    if (!server) return null
    const eggId = server.eggId || ''
    if (!eggId || !eggId.startsWith('minecraft/')) return null
    const ver = (server.config && (server.config.MINECRAFT_VERSION || server.config.MC_VERSION || server.config.DL_VERSION || server.config.VANILLA_VERSION)) || server.version || ''
    const need = requiredJavaForVersion(ver)
    if (!need) return null
    const resolved = resolveDockerImage(server)
    const have = currentJavaFromImage(resolved)
    if (have >= need) return null
    const next = `ghcr.io/pelican-eggs/yolks:java_${need}`
    updateServerConfig(serverId, { dockerImage: next })
    return { from: resolved, to: next, need }
  } catch { return null }
}

function runProc(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(result)
    }
    let proc
    try {
      proc = spawn(cmd, args, { env: process.env, ...opts })
    } catch (err) {
      finish({ status: 1, stdout, stderr: err.message })
      return
    }
    const timer = opts.timeout
      ? setTimeout(() => {
          try { proc.kill('SIGKILL') } catch {}
          finish({ status: 124, stdout, stderr: stderr + '\ntimeout' })
        }, opts.timeout)
      : null
    if (proc.stdout) proc.stdout.on('data', (d) => { stdout += d.toString() })
    if (proc.stderr) proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => finish({ status: code ?? 1, stdout, stderr }))
    proc.on('error', (err) => finish({ status: 1, stdout, stderr: err.message }))
  })
}

ipcMain.handle('server:addConfig', async (e, serverConfig) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = { id: generateUUID(), ...serverConfig, createdAt: new Date().toISOString() }
  addServerConfig(server)
  const serverDir = path.join(WINGS_DATA_DIR, server.id)
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true, mode: 0o755 })
  }
  ensureEula(server.id)
  ensureJava(server.id)
  syncServerToWings(server.id).catch(() => {})
  return { ok: true, server }
})

ipcMain.handle('server:removeConfig', (e, id) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  removeServerConfig(id)
  const serverDir = path.join(WINGS_DATA_DIR, id)
  if (fs.existsSync(serverDir)) {
    try {
      fs.rmSync(serverDir, { recursive: true, force: true })
    } catch {
      try {
        const dockerBin = '/home/neo/.config/.TerverPanel/docker/bin/docker'
        spawnSync(dockerBin, ['run', '--rm', '-v', `${path.dirname(serverDir)}:/mnt/servers`, 'alpine', 'rm', '-rf', `/mnt/servers/${id}`], { timeout: 15000 })
      } catch {}
      if (fs.existsSync(serverDir)) {
        spawnSync('rm', ['-rf', serverDir], { timeout: 15000 })
      }
      if (fs.existsSync(serverDir)) {
        sudoExec(`rm -rf "${serverDir}"`)
      }
    }
  }
  try { wingsApiCall('DELETE', `/api/servers/${id}`).catch(() => {}) } catch {}
  return { ok: true }
})

function sendServerProgress(serverId, percent, message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('server:progress', { serverId, percent, message })
  }
}

function sendServerLog(serverId, message) {
  let msg = String(message ?? '')
  msg = msg
    .replace(/\[Calagopus Daemon\]/g, '[Terver Daemon]')
    .replace(/\[Calagopus\]/g, '[Terver]')
    .replace(/Calagopus Daemon/g, 'Terver Daemon')
    .replace(/calagopus daemon/gi, 'Terver Daemon')
    .replace(/container@calagopus~/g, 'container@terver')
    .replace(/@calagopus~/g, '@terver')
  const entry = { serverId, message: msg, timestamp: Date.now() }
  if (!global._serverLogs) global._serverLogs = {}
  if (!global._serverLogs[serverId]) global._serverLogs[serverId] = []
  global._serverLogs[serverId].push(entry)
  if (global._serverLogs[serverId].length > 500) global._serverLogs[serverId] = global._serverLogs[serverId].slice(-500)
  persistServerLogs(serverId)
  ingestTpsLine(serverId, message)
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('server:log', entry)
  }
}

function serverLogsPath(serverId) {
  return path.join(APP_DATA_DIR, 'server-logs', `${serverId}.json`)
}

function persistServerLogs(serverId) {
  try {
    const dir = path.join(APP_DATA_DIR, 'server-logs')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const logs = (global._serverLogs && global._serverLogs[serverId]) || []
    fs.writeFileSync(serverLogsPath(serverId), JSON.stringify(logs))
  } catch {}
}

function loadServerLogsFromDisk(serverId) {
  try {
    const p = serverLogsPath(serverId)
    if (!fs.existsSync(p)) return []
    const data = JSON.parse(fs.readFileSync(p, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

function getServerLogs(serverId) {
  const mem = (global._serverLogs && global._serverLogs[serverId]) || []
  if (mem.length) return mem
  return loadServerLogsFromDisk(serverId)
}

function clearServerLogs(serverId) {
  if (global._serverLogs) global._serverLogs[serverId] = []
  try {
    const p = serverLogsPath(serverId)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {}
}

function emitLogReset(serverId) {
  clearServerLogs(serverId)
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('server:log-reset', { serverId })
  }
}

ipcMain.handle('server:getLogs', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  return { ok: true, logs: getServerLogs(serverId) }
})


let cloudflaredProcess = null

function restartWings() {
  try {
    const result = sudoExec('systemctl restart lunarspace-wings.service')
    if (result.ok) {
      console.log('[Wings] Restarted successfully')
      return true
    }
    console.error('[Wings] Restart failed:', result.error)
    return false
  } catch {
    return false
  }
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const https = url.startsWith('https') ? require('https') : require('http')
    const file = fs.createWriteStream(destPath)
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlinkSync(destPath)
        return downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        fs.unlinkSync(destPath)
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const totalBytes = parseInt(res.headers['content-length'], 10) || 0
      let downloaded = 0
      res.on('data', (chunk) => {
        downloaded += chunk.length
        if (totalBytes > 0 && onProgress) onProgress(downloaded, totalBytes)
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      file.on('error', (err) => { fs.unlinkSync(destPath); reject(err) })
    }).on('error', (err) => { file.close(); if (fs.existsSync(destPath)) fs.unlinkSync(destPath); reject(err) })
  })
}

function ensureWingsWs(serverId) {
  const entry = _wingsWs.get(serverId)
  if (entry && entry.connected && entry.authenticated) return
  try { connectWingsWs(serverId, {}) } catch {}
}

function sendFinalLogSnapshot(serverId) {
  // Do not dump full history after stop — it re-injects previous session into console.
}

const _stopCleanups = new Map()

function cancelStopCleanup(serverId) {
  const t = _stopCleanups.get(serverId)
  if (t) {
    clearInterval(t)
    _stopCleanups.delete(serverId)
  }
}

function scheduleStopCleanup(serverId, delayMs = 8000) {
  cancelStopCleanup(serverId)
  const started = Date.now()
  const gen = (global._logGen && global._logGen[serverId]) || 0
  const timer = setInterval(async () => {
    if ((global._logGen && global._logGen[serverId]) !== gen) {
      clearInterval(timer)
      _stopCleanups.delete(serverId)
      return
    }
    let state = 'unknown'
    try {
      const data = await wingsApiCall('GET', `/api/servers/${serverId}`)
      state = data?.state || 'unknown'
    } catch {}
    const done = state === 'offline' || state === 'stopped' || Date.now() - started > delayMs
    if (!done) return
    clearInterval(timer)
    if (_stopCleanups.get(serverId) === timer) _stopCleanups.delete(serverId)
    if ((global._logGen && global._logGen[serverId]) !== gen) return
    closeWingsWs(serverId, { reconnect: false })
    stopLogStream(serverId)
    updateServerConfig(serverId, { status: 'stopped' })
  }, 700)
}

ipcMain.handle('server:install', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = getServerByUuid(serverId)
  if (!server) return { ok: false, error: 'Server not found' }

  updateServerConfig(server.id, { status: 'installing' })
  sendServerProgress(server.id, 0, 'Preparing server directory...')
  if (!global._logGen) global._logGen = {}
  global._logGen[server.id] = (global._logGen[server.id] || 0) + 1
  cancelStopCleanup(server.id)
  emitLogReset(server.id)
  stopLogStream(server.id)
  sendServerLog(server.id, `[Install] Starting installation for ${server.name}...`)
  startLogStream(server.id, { boot: true, baseline: true })
  ensureWingsWs(server.id)

  try {
    const serverDir = path.join(WINGS_DATA_DIR, server.id)
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true, mode: 0o755 })
      sendServerLog(server.id, `[Install] Created server directory: ${serverDir}`)
    } else {
      sendServerLog(server.id, `[Install] Server directory: ${serverDir}`)
    }

    const dockerBin = '/home/neo/.config/.TerverPanel/docker/bin/docker'
    const uid = os.userInfo().uid
    const gid = os.userInfo().gid
    try {
      const inspectAlpine = await runProc(dockerBin, ['inspect', 'alpine'], { timeout: 5000 })
      if (inspectAlpine.status !== 0) {
        sendServerLog(server.id, `[Install] Pulling alpine image...`)
        await runProc(dockerBin, ['pull', 'alpine'], { timeout: 60000 })
      }
      sendServerLog(server.id, `[Install] Cleaning server directory...`)
      await runProc(dockerBin, ['run', '--rm', '-v', `${serverDir}:/mnt/server`, 'alpine', 'sh', '-c', 'rm -rf /mnt/server/* /mnt/server/.[!.]* 2>/dev/null; chown -R ' + uid + ':' + gid + ' /mnt/server'], { timeout: 30000 })
      sendServerLog(server.id, `[Install] Directory cleaned and ownership fixed`)
      ensureEula(server.id)
      const javaFixed2 = ensureJava(server.id)
      if (javaFixed2) sendServerLog(server.id, `[Install] Using Docker image ${javaFixed2.to} (needs Java ${javaFixed2.need})`)
    } catch (err) {
      sendServerLog(server.id, `[Install] WARNING: Docker cleanup failed: ${err.message}`)
    }

    const eggName = (server.eggId || 'paper').split('/').pop()
    const eggJsonPath = path.join(__dirname, 'eggs', 'minecraft', eggName + '.json')
    let eggData = null
    try {
      eggData = JSON.parse(fs.readFileSync(eggJsonPath, 'utf8'))
    } catch {
      sendServerLog(server.id, `[Install] WARNING: Could not load egg JSON from ${eggJsonPath}`)
    }

    const eggConfig = server.config || {}
    const jarFile = eggConfig.SERVER_JARFILE || 'server.jar'
    const jarPath = path.join(serverDir, jarFile)

    if (eggData && eggData.scripts && eggData.scripts.installation) {
      const install = eggData.scripts.installation
      const installerContainer = install.container || 'ghcr.io/pelican-eggs/installers:alpine'
      const entrypoint = install.entrypoint || 'ash'
      const installScript = install.script

      sendServerProgress(server.id, 5, `Running install script in Docker...`)
      sendServerLog(server.id, `[Install] Egg: ${eggData.name || eggName}`)
      sendServerLog(server.id, `[Install] Installer container: ${installerContainer}`)

      const envVars = []
      const eggVariables = eggData.variables || []
      for (const v of eggVariables) {
        const envName = v.env_variable
        let value = ''
        if (envName === 'SERVER_JARFILE') value = jarFile
        else if (envName === 'MC_VERSION' || envName === 'MINECRAFT_VERSION' || envName === 'VANILLA_VERSION' || envName === 'DL_VERSION') {
          value = eggConfig[envName] || server.version || v.default_value || 'latest'
        }
        else if (envName === 'BUILD_NUMBER') value = eggConfig[envName] || v.default_value || 'latest'
        else if (envName === 'FORGE_VERSION') value = eggConfig[envName] || ''
        else if (envName === 'FABRIC_VERSION' || envName === 'LOADER_VERSION') value = eggConfig[envName] || v.default_value || 'latest'
        else if (envName === 'BUILD_TYPE') value = eggConfig[envName] || v.default_value || 'recommended'
        else if (envName === 'DL_PATH') value = eggConfig[envName] || ''
        else value = eggConfig[envName] || v.default_value || ''
        envVars.push('-e', `${envName}=${value}`)
      }

      const dockerCheck = await runProc(dockerBin, ['inspect', installerContainer], { timeout: 10000 })
      if (dockerCheck.status !== 0) {
        sendServerLog(server.id, `[Install] Pulling installer image: ${installerContainer}`)
        const pullProc = await runProc(dockerBin, ['pull', installerContainer], { timeout: 120000 })
        if (pullProc.status !== 0) {
          throw new Error(`Failed to pull installer image: ${pullProc.stderr?.toString() || ''}`)
        }
        sendServerLog(server.id, `[Install] Installer image pulled successfully`)
      }

      const scriptPath = path.join(serverDir, '_install.sh')
      fs.writeFileSync(scriptPath, installScript, { mode: 0o755 })

      const dockerArgs = [
        'run', '--rm',
        '--user', `${os.userInfo().uid}:${os.userInfo().gid}`,
        '-v', `${serverDir}:/mnt/server`,
        '-v', `${scriptPath}:/tmp/install.sh:ro`,
        ...envVars,
        '--entrypoint', entrypoint,
        installerContainer, '/tmp/install.sh'
      ]

      sendServerLog(server.id, `[Install] Starting installer container...`)

      await new Promise((resolve, reject) => {
        const proc = spawn(dockerBin, dockerArgs, { env: process.env })
        let stderr = ''

        proc.stdout.on('data', (data) => {
          const lines = data.toString().split('\n').filter(l => l.trim())
          lines.forEach(line => {
            sendServerLog(server.id, `[Install] ${line}`)
          })
        })

        proc.stderr.on('data', (data) => {
          const lines = data.toString().split('\n').filter(l => l.trim())
          lines.forEach(line => {
            sendServerLog(server.id, `[Install] ${line}`)
          })
          stderr += data.toString()
        })

        proc.on('close', (code) => {
          try { fs.unlinkSync(scriptPath) } catch {}
          if (code === 0) {
            sendServerProgress(server.id, 85, 'Install script completed')
            sendServerLog(server.id, '[Install] Install script completed successfully')
            resolve()
          } else {
            reject(new Error(`Install script exited with code ${code}: ${stderr.slice(-300)}`))
          }
        })

        proc.on('error', (err) => {
          try { fs.unlinkSync(scriptPath) } catch {}
          reject(new Error(`Failed to run Docker: ${err.message}`))
        })
      })
    } else {
      sendServerLog(server.id, '[Install] No install script in egg, using direct download...')
      if (server.jarUrl) {
        sendServerProgress(server.id, 5, `Downloading ${jarFile}...`)
        sendServerLog(server.id, `[Install] Download URL: ${server.jarUrl}`)
        await downloadFile(server.jarUrl, jarPath, (downloaded, total) => {
          const pct = Math.round((downloaded / total) * 80) + 5
          const dlMB = (downloaded / 1048576).toFixed(1)
          const totalMB = (total / 1048576).toFixed(1)
          sendServerProgress(server.id, pct, `Downloading ${jarFile}... ${dlMB}/${totalMB} MB`)
          if (pct % 20 === 0 || pct >= 80) {
            sendServerLog(server.id, `[Install] Downloaded ${dlMB}/${totalMB} MB (${pct}%)`)
          }
        })
        sendServerProgress(server.id, 85, 'Download complete')
        sendServerLog(server.id, `[Install] Download complete: ${jarFile}`)
      } else {
        sendServerLog(server.id, '[Install] No jar URL provided, skipping download')
      }
    }

    sendServerProgress(server.id, 88, 'Writing eula.txt...')
    sendServerLog(server.id, '[Install] Writing eula.txt')
    ensureEula(server.id)
    const javaFixedInstall = ensureJava(server.id)
    if (javaFixedInstall) sendServerLog(server.id, `[Install] Using Docker image ${javaFixedInstall.to} (needs Java ${javaFixedInstall.need})`)

    if (eggName === 'forge') {
      const forgeArgsGlob = fs.readdirSync(path.join(serverDir, 'libraries', 'net', 'minecraftforge')).flatMap(dir => {
        try { return fs.readdirSync(path.join(serverDir, 'libraries', 'net', 'minecraftforge', dir)).map(sub => path.join(dir, sub)) } catch { return [] }
      }).find(d => { try { return fs.statSync(path.join(serverDir, 'libraries', 'net', 'minecraftforge', d, 'unix_args.txt')).isFile() } catch { return false } })
      if (forgeArgsGlob) {
        const src = path.join('libraries', 'net', 'minecraftforge', forgeArgsGlob, 'unix_args.txt')
        const dest = path.join(serverDir, 'unix_args.txt')
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(path.join(serverDir, src), dest)
          sendServerLog(server.id, `[Install] Created unix_args.txt symlink from ${src}`)
        }
        const serverJarCandidates = fs.readdirSync(path.join(serverDir, 'libraries', 'net', 'minecraftforge', forgeArgsGlob)).filter(f => f.endsWith('-server.jar'))
        if (serverJarCandidates.length > 0 && !fs.existsSync(path.join(serverDir, jarFile))) {
          fs.copyFileSync(path.join(serverDir, 'libraries', 'net', 'minecraftforge', forgeArgsGlob, serverJarCandidates[0]), path.join(serverDir, jarFile))
          sendServerLog(server.id, `[Install] Created ${jarFile} from ${serverJarCandidates[0]}`)
        }
      } else {
        sendServerLog(server.id, '[Install] WARNING: Could not find Forge unix_args.txt in libraries')
      }
    }

    const port = server.port || 25565
    sendServerProgress(server.id, 92, 'Writing server.properties...')
    sendServerLog(server.id, `[Install] Writing server.properties (port: ${port})`)
    const props = [
      'server-port=' + port,
      'query.port=' + port,
      'server-ip=',
      'level-name=world',
      'gamemode=survival',
      'difficulty=easy',
      'max-players=20',
      'online-mode=true',
      'enable-query=true',
      'eula=true',
    ].join('\n')
    fs.writeFileSync(path.join(serverDir, 'server.properties'), props + '\n')

    sendServerProgress(server.id, 98, 'Finalizing...')
    sendServerLog(server.id, '[Install] Finalizing installation...')
    updateServerConfig(server.id, {
      status: 'stopped',
      installedAt: new Date().toISOString(),
      serverDir,
    })

    sendServerProgress(server.id, 100, 'Installation complete!')
    sendServerLog(server.id, '[Install] Installation complete! Server is ready to start.')
    appendServerHistory(server.id, 'install')
    sendServerLog(server.id, '[Install] Syncing server to Wings daemon...')
    await syncServerToWings(server.id)
    const freshServer = getServerByUuid(server.id)
    return { ok: true, server: freshServer }
  } catch (err) {
    updateServerConfig(server.id, { status: 'error', installError: err.message })
    sendServerProgress(server.id, 0, 'Installation failed: ' + err.message)
    sendServerLog(server.id, `[Install] ERROR: ${err.message}`)
    return { ok: false, error: err.message }
  }
})

// Stream Wings console logs to renderer while a server is active
const _activeLogStreams = new Map()

function stopLogStream(serverId) {
  const t = _activeLogStreams.get(serverId)
  if (!t) return
  if (typeof t === 'object' && typeof t.stop === 'function') {
    t.stop()
  } else {
    try { clearInterval(t) } catch {}
  }
  _activeLogStreams.delete(serverId)
}

async function fetchWingsLogs(uuid, lines = 500) {
  try {
    const tokenData = getWingsLocalToken()
    const token = tokenData?.token || ''
    const resp = await fetch(`http://127.0.0.1:8080/api/servers/${uuid}/logs?lines=${lines}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'text/plain, application/json' },
      timeout: 6000,
    })
    if (!resp.ok) return null
    const text = await resp.text()
    try {
      const json = JSON.parse(text)
      if (typeof json === 'string') return json
      if (json && typeof json.logs === 'string') return json.logs
      if (json && typeof json.data === 'string') return json.data
      if (json && Array.isArray(json.lines)) return json.lines.join('\n')
      if (json && Array.isArray(json.data)) return json.data.join('\n')
    } catch {}
    return text || null
  } catch { return null }
}

function getContainerHostHint(server) {
  // Wings sets container hostname; short uuid is common fallback
  const name = (server?.name || 'container').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 16) || 'container'
  const short = String(server?.id || '').slice(0, 8)
  return name || short || 'container'
}

// ─── Wings WebSocket client (real-time console like Calagopus) ─────
const { WebSocket } = require('ws')
const _wingsWs = new Map() // serverId -> { ws, jwt, serverId, connected, authenticated }

function signWingsWsJwt(serverUuid) {
  const jwt = require('jsonwebtoken')
  const tokenData = getWingsLocalToken()
  const secret = tokenData?.token
  if (!secret) throw new Error('Wings token not found')
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    scope: 'websocket',
    iss: 'panel',
    aud: [],
    exp: now + 600,
    iat: now,
    jti: '00000000-0000-0000-0000-000000000001',
    user_uuid: '00000000-0000-0000-0000-000000000001',
    user_name: 'terver',
    server_uuid: serverUuid,
    permissions: [
      'websocket.connect',
      'control.read-console',
      'control.console',
      'control.start',
      'control.stop',
      'control.restart',
      'admin.websocket.errors',
      'admin.websocket.install',
      'admin.websocket.transfer',
      'backup.read',
      'schedule.read',
      'file.read',
      'file.read-content',
      'file.create',
      'file.update',
      'file.delete',
      'file.archive',
    ],
    ignored_files: [],
  }
  return jwt.sign(payload, secret, { algorithm: 'HS256' })
}

function emitWsToRenderer(serverId, event, payload) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('wings:ws-event', { serverId, event, payload })
  }
}

function closeWingsWs(serverId, opts = {}) {
  const entry = _wingsWs.get(serverId)
  if (entry) {
    entry.closedByUs = true
    if (opts.reconnect === false) entry.noReconnect = true
    try { entry.ws.close(1000, 'client disconnect') } catch {}
    _wingsWs.delete(serverId)
  }
}

function connectWingsWs(serverId, opts = {}) {
  if (_wingsWs.has(serverId)) closeWingsWs(serverId, { reconnect: false })
  let jwtToken
  try { jwtToken = signWingsWsJwt(serverId) } catch (err) {
    emitWsToRenderer(serverId, 'error', { message: err.message })
    return { ok: false, error: err.message }
  }

  const ws = new WebSocket(`ws://127.0.0.1:8080/api/servers/${serverId}/ws`, {
    headers: { Origin: 'http://127.0.0.1:6543' },
  })
  const entry = { ws, serverId, connected: false, authenticated: false }
  _wingsWs.set(serverId, entry)

  ws.on('open', () => {
    entry.connected = true
    ws.send(JSON.stringify({ event: 'auth', args: [jwtToken] }))
  })

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }
    const ev = msg.event
    const args = msg.args || []
    if (ev === 'auth success') {
      entry.authenticated = true
      // Do NOT replay Wings history on every auth — it dumps previous session into console.
      ws.send(JSON.stringify({ event: 'send status', args: [] }))
      emitWsToRenderer(serverId, 'auth success', { permissions: args[0] })
      return
    }
    if (ev === 'ping') { try { ws.send(JSON.stringify({ event: 'pong', args: [] })) } catch {} return }
    if (ev === 'token expiring' || ev === 'token expired') {
      try { ws.send(JSON.stringify({ event: 'auth', args: [signWingsWsJwt(serverId)] })) } catch {}
      return
    }
    if (ev === 'console output' || ev === 'install output') {
      const linesArg = args[0]
      if (typeof linesArg === 'string') ingestTpsLine(serverId, linesArg)
      else if (Array.isArray(linesArg)) linesArg.forEach((l) => ingestTpsLine(serverId, l))
      // Persist WS console lines so history survives app restart while server runs
      const text = typeof linesArg === 'string' ? linesArg : Array.isArray(linesArg) ? linesArg.join('\n') : ''
      if (text) {
        for (const line of text.split('\n')) {
          if (line) sendServerLog(serverId, line)
        }
      } else {
        emitWsToRenderer(serverId, ev, { lines: args[0] })
        return
      }
      // sendServerLog already emits server:log; also forward as ws-event for console page
      emitWsToRenderer(serverId, ev, { lines: args[0] })
      return
    }
    if (ev === 'status') {
      const state = args[0]
      if (state === 'running') {
        updateServerConfig(serverId, { status: 'running' })
        startTpsPoller(serverId)
      } else if (state === 'starting') updateServerConfig(serverId, { status: 'starting' })
      else if (state === 'stopping') updateServerConfig(serverId, { status: 'stopping' })
      else if (state === 'offline' || state === 'stopped') {
        updateServerConfig(serverId, { status: 'stopped' })
        stopTpsPoller(serverId)
        clearServerTps(serverId)
      }
      emitWsToRenderer(serverId, 'status', { state })
      return
    }
    if (ev === 'jwt error' || ev === 'daemon error' || ev === 'daemon message') {
      emitWsToRenderer(serverId, ev, { args })
      return
    }
    emitWsToRenderer(serverId, ev, { args })
  })

  ws.on('error', (err) => {
    emitWsToRenderer(serverId, 'error', { message: err.message })
  })

  ws.on('close', (code, reason) => {
    entry.connected = false
    entry.authenticated = false
    emitWsToRenderer(serverId, 'close', { code, reason: String(reason || '') })
    if (_wingsWs.get(serverId) === entry) _wingsWs.delete(serverId)
    const intentional = entry.closedByUs || entry.noReconnect || opts.reconnect === false || code === 1000
    if (!intentional) {
      setTimeout(() => { if (!_wingsWs.has(serverId) && !entry.closedByUs && !entry.noReconnect) connectWingsWs(serverId, opts) }, 2000)
    }
  })

  return { ok: true }
}

function sendWingsWs(serverId, event, args = []) {
  const entry = _wingsWs.get(serverId)
  if (!entry || !entry.connected || !entry.authenticated) return false
  try { entry.ws.send(JSON.stringify({ event, args })); return true } catch { return false }
}

ipcMain.handle('wings:ws-connect', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  return connectWingsWs(serverId, {})
})
ipcMain.handle('wings:ws-disconnect', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  closeWingsWs(serverId, { reconnect: false })
  return { ok: true }
})
ipcMain.handle('wings:ws-send', async (e, serverId, event, args) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const ok = sendWingsWs(serverId, event, args || [])
  return { ok }
})
ipcMain.handle('wings:ws-status', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const entry = _wingsWs.get(serverId)
  return { ok: true, connected: !!entry?.connected, authenticated: !!entry?.authenticated }
})

function startLogStream(serverId, opts = {}) {
  stopLogStream(serverId)
  const server = getServerByUuid(serverId)
  const hostHint = getContainerHostHint(server)
  let lastLog = ''
  let seenLines = new Set()
  let idleTicks = 0
  let bootPhase = !!opts.boot
  let stopped = false
  let baselineDone = !opts.baseline
  const bootUntil = Date.now() + (opts.boot ? 45000 : 0)
  const streamEntry = {
    stop: () => { stopped = true },
  }
  const finish = () => {
    stopped = true
    if (_activeLogStreams.get(serverId) === streamEntry) {
      _activeLogStreams.delete(serverId)
    }
  }
  streamEntry.stop = finish
  _activeLogStreams.set(serverId, streamEntry)

  const tick = async () => {
    if (stopped) return
    try {
      const raw = await fetchWingsLogs(serverId, 800)
      const now = Date.now()
      const inBoot = bootPhase && now < bootUntil
      if (raw !== null && raw !== undefined && raw !== lastLog) {
        lastLog = raw
        idleTicks = 0
        const lines = raw.split('\n').filter(Boolean)
        if (!baselineDone) {
          // Seed seen set from existing docker log so old session lines are not re-emitted
          baselineDone = true
          for (const line of lines) seenLines.add(line)
        } else {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('server:log-snapshot', { serverId, logs: raw, host: hostHint })
          }
          for (const line of lines) {
            if (!seenLines.has(line)) {
              seenLines.add(line)
              sendServerLog(serverId, line)
            }
          }
          if (seenLines.size > 2000) seenLines = new Set(lines.slice(-400))
        }
        ingestTpsLine(serverId, raw)
        if (/Done \(/.test(raw) || /For help, type/.test(raw)) {
          bootPhase = false
          updateServerConfig(serverId, { status: 'running' })
          startTpsPoller(serverId)
        }
      } else {
        idleTicks++
      }
      if (!inBoot && idleTicks > 45) { finish(); return }
      if (stopped) return
      setTimeout(tick, inBoot ? 300 : 1000)
    } catch {
      if (stopped) return
      setTimeout(tick, bootPhase ? 500 : 2000)
    }
  }
  tick()
}

function beginLogSession(serverId) {
  if (!global._logGen) global._logGen = {}
  global._logGen[serverId] = (global._logGen[serverId] || 0) + 1
  cancelStopCleanup(serverId)
  emitLogReset(serverId)
  stopLogStream(serverId)
  stopTpsPoller(serverId)
}

ipcMain.handle('server:start', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = getServerByUuid(serverId)
  if (!server) return { ok: false, error: 'Server not found' }

  const eulaFixed = ensureEula(server.id)
  const javaFixed = ensureJava(server.id)
  updateServerConfig(server.id, { status: 'starting' })
  appendServerHistory(server.id, 'start')
  beginLogSession(server.id)
  if (eulaFixed) sendServerLog(server.id, '[Daemon] Ensured eula=true in eula.txt')
  if (javaFixed) sendServerLog(server.id, `[Daemon] Switched Docker image ${javaFixed.from} → ${javaFixed.to} (needs Java ${javaFixed.need})`)
  sendServerLog(server.id, '[Daemon] Starting server...')
  startLogStream(server.id, { boot: true, baseline: true })
  ensureWingsWs(server.id)
  try {
    const data = await wingsApiCall('POST', `/api/servers/${server.id}/power`, { action: 'start', wait_seconds: 0 })
    return { ok: true, data }
  } catch (err) {
    if (err.message && err.message.includes('server not found')) {
      console.log('[Server] Server not found on Wings, syncing...')
      sendServerLog(server.id, '[Daemon]: Syncing server configuration with daemon...')
      const synced = await syncServerToWings(server.id)
      if (synced) {
        await new Promise(r => setTimeout(r, 1500))
        try {
          const data2 = await wingsApiCall('POST', `/api/servers/${server.id}/power`, { action: 'start', wait_seconds: 0 })
          return { ok: true, data: data2 }
        } catch (err2) {
          updateServerConfig(server.id, { status: 'stopped', startError: err2.message })
          sendServerLog(server.id, `[Daemon]: ${err2.message}`)
          return { ok: false, error: err2.message }
        }
      }
    }
    updateServerConfig(server.id, { status: 'stopped', startError: err.message })
    sendServerLog(server.id, `[Daemon]: ${err.message}`)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('server:stop', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = getServerByUuid(serverId)
  if (!server) return { ok: false, error: 'Server not found' }

  updateServerConfig(server.id, { status: 'stopping' })
  appendServerHistory(server.id, 'stop')
  stopTpsPoller(server.id)
  clearServerTps(server.id)
  sendServerLog(server.id, '[Daemon] Stopping server...')
  stopLogStream(server.id)
  startLogStream(server.id, { baseline: true })
  ensureWingsWs(server.id)
  try {
    await wingsApiCall('POST', `/api/servers/${server.id}/power`, { action: 'stop', wait_seconds: 0 })
    scheduleStopCleanup(server.id, 15000)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('server:kill', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = getServerByUuid(serverId)
  if (!server) return { ok: false, error: 'Server not found' }

  try {
    appendServerHistory(server.id, 'kill')
    stopTpsPoller(server.id)
    clearServerTps(server.id)
    cancelStopCleanup(server.id)
    sendServerLog(server.id, '[Daemon] Killed server')
    stopLogStream(server.id)
    await wingsApiCall('POST', `/api/servers/${server.id}/power`, { action: 'kill', wait_seconds: 0 })
    updateServerConfig(server.id, { status: 'stopped' })
    closeWingsWs(server.id, { reconnect: false })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('server:status', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = getServerByUuid(serverId)
  if (!server) return { ok: false, error: 'Server not found' }

  try {
    const data = await wingsApiCall('GET', `/api/servers/${server.id}`)
    const state = data?.state || 'offline'
    const util = data?.utilization || {}
    const isRunning = state === 'running'
    const prev = server.status
    let nextStatus = isRunning ? 'running' : (state === 'starting' || state === 'stopping' ? state : (state === 'offline' || state === 'stopped' ? 'stopped' : state))
    if (prev === 'stopping' && isRunning) nextStatus = 'stopping'
    if (prev === 'starting' && (state === 'offline' || state === 'stopped') && util.cpu_absolute === 0 && !util.memory_bytes) {
      // keep starting briefly; cleanup path will mark stopped
      nextStatus = 'starting'
    }
    if (isRunning && (prev === 'running' || prev === 'starting')) startTpsPoller(server.id)
    if (!isRunning && (state === 'offline' || state === 'stopped') && (prev === 'running' || prev === 'stopping')) {
      stopTpsPoller(server.id)
      clearServerTps(server.id)
      if (prev === 'running') nextStatus = 'stopped'
    }
    updateServerConfig(server.id, { status: nextStatus, resources_usage: util })
    const live = _serverTps.get(server.id)
    const tps = live?.tps ?? (isRunning ? (server.lastTps ?? null) : null)
    return { ok: true, status: nextStatus, state, resources: util, tps }
  } catch {
    const live = _serverTps.get(serverId)
    return { ok: true, status: 'stopped', resources: {}, tps: live?.tps ?? null }
  }
})

ipcMain.handle('server:tps', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const live = _serverTps.get(serverId)
  const server = getServerByUuid(serverId)
  const tps = live?.tps ?? (server?.status === 'running' ? (server.lastTps ?? null) : null)
  return { ok: true, tps, at: live?.at || server?.lastTpsAt || null }
})

ipcMain.handle('server:history', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = getServerByUuid(serverId)
  if (!server) return { ok: false, error: 'Server not found' }
  cleanServerHistoryOnDisk(serverId)
  const fresh = getServerByUuid(serverId)
  const history = Array.isArray(fresh?.history) ? fresh.history : []
  return { ok: true, history: dedupeServerHistory(history).slice(0, 20) }
})

ipcMain.handle('mc:getVersions', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const https = require('https')
    return new Promise((resolve) => {
      https.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 10000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve({ ok: true, latest: json.latest, versions: json.versions })
          } catch { resolve({ error: 'Parse error' }) }
        })
      }).on('error', () => resolve({ error: 'Network error' }))
    })
  } catch { return { error: 'Failed' } }
})

ipcMain.handle('mc:getChangelog', async (e, version) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const https = require('https')
    const url = `https://xyrios.com/minecraft/tools/changelog/${encodeURIComponent(version)}`
    return new Promise((resolve) => {
      https.get(url, { timeout: 15000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const titleMatch = data.match(/<h1[^>]*>(.*?)<\/h1>/s)
            const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''
            const dateMatch = data.match(/Published on (\d{4}\.\d{2}\.\d{2})/)
            const date = dateMatch ? dateMatch[1] : ''
            const imgMatch = data.match(/launchercontent\.mojang\.com\/v2\/images\/([^"'\s]+)/)
            const image = imgMatch ? `https://launchercontent.mojang.com/v2/images/${imgMatch[1]}` : ''
            const contentMatch = data.match(/<div[^>]*class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/div>/)
            let content = ''
            if (contentMatch) {
              let raw = contentMatch[1]
              raw = raw.replace(/<script[\s\S]*?<\/script>/gi, '')
              raw = raw.replace(/<style[\s\S]*?<\/style>/gi, '')
              raw = raw.replace(/<nav[\s\S]*?<\/nav>/gi, '')
              raw = raw.replace(/<footer[\s\S]*?<\/footer>/gi, '')
              raw = raw.replace(/\s+/g, ' ')
              content = raw.trim()
            }
            resolve({ ok: true, title, date, image, content })
          } catch { resolve({ error: 'Parse error' }) }
        })
      }).on('error', () => resolve({ error: 'Network error' }))
    })
  } catch { return { error: 'Failed' } }
})

ipcMain.handle('mc:getModpacks', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const https = require('https')
    const facets = encodeURIComponent(JSON.stringify([['project_type:modpack']]))
    const url = `https://api.modrinth.com/v3/search?index=downloads&limit=10&facets=${facets}`
    return new Promise((resolve) => {
      https.get(url, { timeout: 10000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve({ ok: true, hits: json.hits || [] })
          } catch { resolve({ error: 'Parse error' }) }
        })
      }).on('error', () => resolve({ error: 'Network error' }))
    })
  } catch { return { error: 'Failed' } }
})

let cachedSudoPassword = null

function sudoExec(command, timeout = 30000) {
  const { execSync } = require('child_process')
  if (cachedSudoPassword) {
    try {
      const result = execSync(`echo '${cachedSudoPassword.replace(/'/g, "'\\''")}' | sudo -S sh -c '${command.replace(/'/g, "'\\''")}' 2>&1`, { timeout, encoding: 'utf8' })
      return { ok: true, output: result }
    } catch (err) {
      if (err.message && err.message.includes('incorrect password')) {
        cachedSudoPassword = null
        return { ok: false, error: 'password_wrong' }
      }
      return { ok: false, error: err.message }
    }
  }
  return { ok: false, error: 'sudo_not_authenticated' }
}

ipcMain.handle('system:auth', async (e, password) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  try {
    execSync(`echo '${password.replace(/'/g, "'\\''")}' | sudo -S echo 'terver_auth_ok' 2>&1`, { timeout: 10000, encoding: 'utf8' })
    cachedSudoPassword = password
    return { ok: true }
  } catch {
    return { ok: false, error: 'wrong_password' }
  }
})

ipcMain.handle('system:checkAuth', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  return { ok: true, authenticated: !!cachedSudoPassword }
})

ipcMain.handle('system:getInfo', (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const cpus = os.cpus()
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown'
  const cpuCores = cpus.length
  let totalDisk = 0
  let freeDisk = 0
  try {
    const { execSync } = require('child_process')
    const out = execSync("df -B1 / | tail -1", { timeout: 5000 }).toString().trim()
    const parts = out.split(/\s+/)
    totalDisk = parseInt(parts[1]) || 0
    freeDisk = parseInt(parts[3]) || 0
  } catch {}
  return {
    ok: true,
    ram: { total: totalMem, free: freeMem },
    cpu: { model: cpuModel, cores: cpuCores },
    disk: { total: totalDisk, free: freeDisk },
    platform: os.platform(),
    arch: os.arch(),
  }
})

// Egg management
ipcMain.handle('eggs:list', (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const eggsDir = path.join(__dirname, 'eggs')
  const result = {}
  try {
    const games = fs.readdirSync(eggsDir)
    for (const game of games) {
      const gameDir = path.join(eggsDir, game)
      if (fs.statSync(gameDir).isDirectory()) {
        result[game] = []
        const files = fs.readdirSync(gameDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const raw = fs.readFileSync(path.join(gameDir, file), 'utf8')
              const egg = JSON.parse(raw)
              result[game].push({
                id: `${game}/${file.replace('.json', '')}`,
                file: file,
                name: egg.name || file.replace('.json', ''),
                description: egg.description || '',
                docker_images: egg.docker_images || {},
                variables: egg.variables || [],
                startup: egg.Startup || egg.startup || '',
                config: egg.config || {},
                scripts: egg.scripts || {},
                features: egg.features || [],
              })
            } catch {}
          }
        }
      }
    }
  } catch {}
  return { ok: true, eggs: result }
})

ipcMain.handle('eggs:get', (e, eggId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const eggsDir = path.join(__dirname, 'eggs')
  try {
    const parts = eggId.split('/')
    const filePath = path.join(eggsDir, parts[0], parts[1] + '.json')
    const raw = fs.readFileSync(filePath, 'utf8')
    return { ok: true, egg: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
})

ipcMain.handle('docker:check', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const fs2 = require('fs')
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const dockerDir = (paths.docker || '').replace(/^~/, os.homedir())

    let installed = false
    let version = ''
    let composeVersion = ''
    let running = false
    let containers = 0
    let usingSystem = false
    let dockerCmd = ''

    if (dockerDir) {
      const binPath = `${dockerDir}/bin/docker`
      try { fs2.accessSync(binPath, fs2.constants.F_OK | fs2.constants.X_OK); installed = true } catch {}
      if (installed) {
        dockerCmd = `DOCKER_HOST=unix:///var/run/docker.sock ${binPath}`
        try { version = execSync(`${binPath} --version`, { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
        try { composeVersion = execSync(`${binPath} compose version`, { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
        try { const s = execSync('systemctl is-active terver-docker 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); running = s === 'active' } catch {}
        if (!running) {
          try { const s = execSync('systemctl is-active docker 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); if (s === 'active') { running = true; usingSystem = true } } catch {}
        }
        try { containers = parseInt(execSync(`${dockerCmd} ps -q 2>/dev/null | wc -l`, { timeout: 5000, encoding: 'utf8' }).trim()) || 0 } catch {}
      }
    }

    if (!installed) {
      try {
        version = execSync('docker --version', { timeout: 5000, encoding: 'utf8' }).trim()
        installed = true
        usingSystem = true
        dockerCmd = 'docker'
        try { composeVersion = execSync('docker compose version', { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
        try { const s = execSync('systemctl is-active docker 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); running = s === 'active' } catch {}
        try { containers = parseInt(execSync('docker ps -q 2>/dev/null | wc -l', { timeout: 5000, encoding: 'utf8' }).trim()) || 0 } catch {}
      } catch {}
    }

    return { ok: true, installed, version, composeVersion, running, containers, usingSystem }
  } catch {
    return { ok: true, installed: false, version: '', composeVersion: '', running: false, containers: 0 }
  }
})

ipcMain.handle('docker:install', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const https = require('https')
  const fs2 = require('fs')
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const dockerDir = (paths.docker || '').replace(/^~/, os.homedir())
    if (!dockerDir) return { ok: false, error: 'Chưa chọn đường dẫn Docker. Hãy Setup trước.' }

    const binDir = `${dockerDir}/bin`
    const dataDir = `${dockerDir}/data`
    const configDir = `${dockerDir}/config`
    const logDir = `${dockerDir}/logs`
    const socketPath = '/var/run/docker.sock'
    const dockerVersion = '27.5.1'

    sendProgress('docker', 5, 'Đang tạo thư mục Docker...')
    for (const d of [binDir, dataDir, configDir, logDir]) fs.mkdirSync(d, { recursive: true })

    const arch = execSync('uname -m', { encoding: 'utf8' }).trim()
    const dockerArch = arch === 'aarch64' ? 'aarch64' : 'x86_64'
    const downloadUrl = `https://download.docker.com/linux/static/stable/${dockerArch}/docker-${dockerVersion}.tgz`
    const tmpFile = `/tmp/docker-${dockerVersion}.tgz`

    sendProgress('docker', 10, `Tải docker-${dockerVersion}.tgz (${dockerArch})...`)
    try {
      await new Promise((resolve, reject) => {
        const req = https.get(downloadUrl, { timeout: 120000 }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            sendProgress('docker', 12, 'Đang chuyển hướng download...')
            https.get(res.headers.location, { timeout: 120000 }, (res2) => {
              const file = fs2.createWriteStream(tmpFile)
              res2.pipe(file)
              file.on('finish', () => { file.close(); resolve() })
              file.on('error', (err) => { fs2.unlink(tmpFile, () => {}); reject(err) })
            }).on('error', reject)
            return
          }
          if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return }
          const total = parseInt(res.headers['content-length'] || '0')
          let loaded = 0
          const startTime = Date.now()
          res.on('data', (chunk) => {
            loaded += chunk.length
            if (total > 0) {
              const pct = Math.round(10 + (loaded / total) * 40)
              const speed = loaded / ((Date.now() - startTime) / 1000)
              const speedMB = (speed / 1024 / 1024).toFixed(1)
              const remain = speed > 0 ? Math.ceil((total - loaded) / speed) : '?'
              sendProgress('docker', pct, `Tải Docker: ${(loaded/1024/1024).toFixed(1)}/${(total/1024/1024).toFixed(1)}MB (${pct}%) — ${speedMB}MB/s — còn ~${remain}s`)
            }
          })
          const file = fs2.createWriteStream(tmpFile)
          res.pipe(file)
          file.on('finish', () => { file.close(); resolve() })
          file.on('error', (err) => { fs2.unlink(tmpFile, () => {}); reject(err) })
        }).on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout 120s')) })
      })
    } catch (dlErr) {
      sendProgress('docker', 0, `Lỗi tải: ${dlErr.message}`)
      return { ok: false, error: `Không tải được Docker: ${dlErr.message}` }
    }

    const tmpDir = path.join(os.tmpdir(), `terver-docker-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    sendProgress('docker', 50, 'Giải nén Docker binaries...')
    execSync(`tar -xzf ${tmpFile} -C ${tmpDir}`)

    const dockerTmp = path.join(tmpDir, 'docker')
    try { fs.mkdirSync(dockerTmp, { recursive: true }) } catch {}

    // Download containerd-shim-runc-v2 separately (not included in Docker tarball)
    const containerdVersion = '1.7.25'
    const containerdArch = process.arch === 'x64' ? 'amd64' : process.arch === 'arm64' ? 'arm64' : 'arm'
    const shimUrl = `https://github.com/containerd/containerd/releases/download/v${containerdVersion}/containerd-shim-runc-v2-${containerdVersion}-linux-${containerdArch}.tar.gz`
    const shimTmpFile = path.join(tmpDir, `containerd-shim-${containerdVersion}.tar.gz`)
    try {
      await new Promise((resolve, reject) => {
        const https = require('https')
        const req = https.get(shimUrl, { headers: { 'User-Agent': 'TerverPanel' } }, (res) => {
          if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return }
          const file = fs.createWriteStream(shimTmpFile)
          res.pipe(file)
          file.on('finish', () => { file.close(); resolve() })
          file.on('error', (err) => { fs.unlink(shimTmpFile, () => {}); reject(err) })
        }).on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout 60s')) })
        req.setTimeout(60000)
      })
      execSync(`tar -xzf ${shimTmpFile} -C ${dockerTmp}`)
      sendProgress('docker', 55, 'Downloaded containerd-shim-runc-v2')
    } catch (e) {
      sendProgress('docker', 55, `Warning: could not download containerd-shim: ${e.message}`)
    }

    const bins = ['docker', 'dockerd', 'containerd', 'ctr', 'runc', 'containerd-shim-runc-v2']
    let copied = 0
    for (const b of bins) {
      const src = path.join(dockerTmp, b)
      const dst = path.join(binDir, b)
      try { if (fs.existsSync(src)) { fs.copyFileSync(src, dst); fs.chmodSync(dst, 0o755); copied++ } } catch {}
    }
    try {
      const proxySrc = path.join(dockerTmp, 'docker-proxy')
      const proxyDst = path.join(binDir, 'docker-proxy')
      if (fs.existsSync(proxySrc)) { fs.copyFileSync(proxySrc, proxyDst); fs.chmodSync(proxyDst, 0o755); copied++ }
    } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    sendProgress('docker', 62, `Đã copy ${copied} binaries vào ${binDir}`)

    sendProgress('docker', 65, 'Tạo daemon.json...')
    const daemonConfig = {
      'data-root': dataDir,
      'storage-driver': 'overlay2',
      'userland-proxy': false,
      'log-driver': 'json-file',
      'log-opts': { 'max-size': '10m', 'max-file': '3' },
    }
    fs.writeFileSync(path.join(configDir, 'daemon.json'), JSON.stringify(daemonConfig, null, 2))

    sendProgress('docker', 72, 'Đang tạo containerd service...')
    const containerdService = `[Unit]
Description=Containerd (Terver Panel)
After=network.target

[Service]
Type=simple
Environment=PATH=${binDir}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${binDir}/containerd
Restart=on-failure
RestartSec=5
LimitNOFILE=infinity

[Install]
WantedBy=multi-user.target
`
    fs.writeFileSync('/etc/systemd/system/terver-containerd.service', containerdService)

    sendProgress('docker', 75, 'Đang tạo docker service...')
    const serviceContent = `[Unit]
Description=Docker Engine (Terver Panel)
After=network.target terver-containerd.service
Requires=terver-containerd.service

[Service]
Type=notify
Environment=PATH=${binDir}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStartPre=/bin/bash -c 'rm -f /var/run/docker.pid'
ExecStart=${binDir}/dockerd --config-file=${configDir}/daemon.json --containerd=/run/containerd/containerd.sock --userland-proxy-path=${binDir}/docker-proxy
ExecReload=/bin/kill -s HUP $MAINPID
Restart=on-failure
RestartSec=5
TimeoutStartSec=0
LimitNOFILE=infinity

[Install]
WantedBy=multi-user.target
`
    fs.writeFileSync('/etc/systemd/system/terver-docker.service', serviceContent)
    sudoExec('systemctl daemon-reload')

    sendProgress('docker', 82, 'Đang enable + start containerd...')
    sudoExec('systemctl enable terver-containerd')
    sudoExec('systemctl start terver-containerd')
    execSync('sleep 2')

    sendProgress('docker', 85, 'Đang enable + start Docker...')
    sudoExec('systemctl enable terver-docker')
    sudoExec('systemctl start terver-docker')

    sendProgress('docker', 90, 'Đang chờ Docker khởi động...')
    for (let i = 0; i < 15; i++) {
      try {
        execSync(`DOCKER_HOST=unix://${socketPath} ${binDir}/docker info`, { timeout: 5000, stdio: 'ignore' })
        break
      } catch {}
      execSync('sleep 2')
    }

    sendProgress('docker', 95, 'Đang xác minh...')
    let version = ''
    try {
      version = execSync(`${binDir}/docker --version`, { timeout: 5000, encoding: 'utf8' }).trim()
    } catch {}
    sendProgress('docker', 100, `Cài thành công: ${version || dockerVersion}`)
    return { ok: true, version: version || dockerVersion, path: dockerDir }
  } catch (err) {
    sendProgress('docker', 0, `Lỗi: ${err.message}`)
    return { ok: false, error: err.message || 'Cài đặt thất bại' }
  }
})

ipcMain.handle('docker:config:get', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const configPath = path.join(app.getPath('home'), '.config', 'terver', 'docker-config.json')
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8')
      return { ok: true, config: JSON.parse(raw) }
    }
    return { ok: true, config: { socket: '/var/run/docker.sock', dataDir: '/var/lib/terver', networkInterface: 'docker0' } }
  } catch {
    return { ok: true, config: { socket: '/var/run/docker.sock', dataDir: '/var/lib/terver', networkInterface: 'docker0' } }
  }
})

ipcMain.handle('docker:config:save', async (e, config) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const configDir = path.join(app.getPath('home'), '.config', 'terver')
  const configPath = path.join(configDir, 'docker-config.json')
  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('stats:docker', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const dockerDir = (paths.docker || '').replace(/^~/, os.homedir())
    const fs2 = require('fs')

    let installed = false
    let running = false
    let version = ''
    let containers = 0

    if (dockerDir) {
      const binPath = `${dockerDir}/bin/docker`
      try { fs.accessSync(binPath, fs.constants.F_OK | fs.constants.X_OK); installed = true } catch {}
      if (installed) {
        try { const s = execSync('systemctl is-active terver-docker 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); running = s === 'active' } catch {}
        if (!running) {
          try { const s = execSync('systemctl is-active docker 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); running = s === 'active' } catch {}
        }
        try { version = execSync(`${binPath} --version 2>/dev/null`, { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
        const socketPath = '/var/run/docker.sock'
        try { containers = parseInt(execSync(`DOCKER_HOST=unix://${socketPath} ${binPath} ps -q 2>/dev/null | wc -l`, { timeout: 5000, encoding: 'utf8' }).trim()) || 0 } catch {}
      }
    }

    if (!installed) {
      try {
        version = execSync('docker --version 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
        installed = true
        try { const s = execSync('systemctl is-active docker 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); running = s === 'active' } catch {}
        try { containers = parseInt(execSync('docker ps -q 2>/dev/null | wc -l', { timeout: 5000, encoding: 'utf8' }).trim()) || 0 } catch {}
      } catch {}
    }

    return { ok: true, installed, running, version, containers }
  } catch {
    return { ok: true, installed: false, running: false, version: '', containers: 0 }
  }
})

ipcMain.handle('stats:database', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const dbDir = (paths.database || '').replace(/^~/, os.homedir())
    const fs2 = require('fs')
    let installed = false
    if (dbDir) {
      try { installed = fs2.existsSync(`${dbDir}/data`) } catch {}
      if (!installed) { try { installed = fs2.existsSync(`${dbDir}/postgresql`) || fs2.existsSync(`${dbDir}/pgdata`) } catch {} }
    }
    if (!installed) {
      try { execSync('which psql 2>/dev/null', { stdio: 'ignore' }); installed = true } catch {}
    }
    let running = false
    try { const s = execSync('systemctl is-active postgresql 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); running = s === 'active' } catch {}
    let version = ''
    try { version = execSync('psql --version 2>/dev/null', { timeout: 3000, encoding: 'utf8' }).trim() } catch {}
    return { ok: true, installed, running, version }
  } catch {
    return { ok: true, installed: false, running: false, version: '' }
  }
})

ipcMain.handle('node:loadConfigs', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const configs = {}
  const settings = readSettings()
  const paths = settings.paths || {}
  const wingsConfigPath = (paths.wingsConfig || '').replace(/\/+$/, '')
  const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())
  // Docker config — from custom path
  const dockerDir = (paths.docker || '').replace(/^~/, os.homedir())
  if (dockerDir) {
    try {
      const raw = fs.readFileSync(`${dockerDir}/config/daemon.json`, 'utf8')
      const dockerCfg = JSON.parse(raw)
      configs.docker = {
        socketPath: '/var/run/docker.sock',
        dataDir: dockerCfg['data-root'] || `${dockerDir}/data`,
        networkInterface: 'docker0'
      }
    } catch { configs.docker = { socketPath: '/var/run/docker.sock', dataDir: `${dockerDir}/data`, networkInterface: 'docker0' } }
  } else { configs.docker = { socketPath: '', dataDir: '', networkInterface: '' } }
  // Wings config — from custom path
  if (wingsConfigPath) {
    try {
      const raw = fs.readFileSync(`${wingsConfigPath}/config.yml`, 'utf8')
      const tokenMatch = raw.match(/token:\s*(.+)/)
      const uuidMatch = raw.match(/uuid:\s*(.+)/)
      configs.wings = { token: tokenMatch?.[1]?.trim() || '', uuid: uuidMatch?.[1]?.trim() || '' }
    } catch { configs.wings = { token: '', uuid: '' } }
  } else { configs.wings = { token: '', uuid: '' } }
  // Cloudflare config — from custom path
  if (cfDir) {
    try {
      const raw = fs.readFileSync(`${cfDir}/config.yml`, 'utf8')
      const tunnelMatch = raw.match(/^tunnel:\s*(.+)/m)
      const hostnameMatch = raw.match(/hostname:\s*(.+)/)
      configs.cloudflare = { tunnelId: tunnelMatch?.[1]?.trim() || '', domain: hostnameMatch?.[1]?.trim() || '' }
    } catch { configs.cloudflare = { tunnelId: '', domain: '' } }
  } else { configs.cloudflare = { tunnelId: '', domain: '' } }
  // DB config
  try {
    const db = readDB()
    configs.db = db.settings?.nodeConfig?.dbConfig || { name: 'terver_db', user: 'terver', pass: '' }
  } catch { configs.db = { name: 'terver_db', user: 'terver', pass: '' } }
  return { ok: true, configs }
})

ipcMain.handle('stats:ping', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  try {
    const out = execSync('ping -c 1 -W 2 8.8.8.8 2>/dev/null || ping -n 1 8.8.8.8 2>/dev/null', { timeout: 5000, encoding: 'utf8' })
    const match = out.match(/time[=<](\d+\.?\d*)/i)
    return { ok: true, ms: match ? parseFloat(match[1]) : 0 }
  } catch {
    return { ok: true, ms: -1 }
  }
})

let prevNet = null
ipcMain.handle('stats:network', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const fs2 = require('fs')
  try {
    const raw = fs2.readFileSync('/proc/net/dev', 'utf8')
    const lines = raw.split('\n').filter(l => l.trim() && !l.includes('lo:'))
    let rxBytes = 0, txBytes = 0
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 10) continue
      rxBytes += parseInt(parts[1]) || 0
      txBytes += parseInt(parts[9]) || 0
    }
    const now = Date.now()
    if (prevNet && (now - prevNet.time) > 0) {
      const elapsed = (now - prevNet.time) / 1000
      const rxSpeed = Math.max(0, (rxBytes - prevNet.rx) / elapsed)
      const txSpeed = Math.max(0, (txBytes - prevNet.tx) / elapsed)
      prevNet = { rx: rxBytes, tx: txBytes, time: now }
      return { ok: true, rxSpeed, txSpeed, rxTotal: rxBytes, txTotal: txBytes }
    }
    prevNet = { rx: rxBytes, tx: txBytes, time: now }
    return { ok: true, rxSpeed: 0, txSpeed: 0, rxTotal: rxBytes, txTotal: txBytes }
  } catch {
    return { ok: true, rxSpeed: 0, txSpeed: 0, rxTotal: 0, txTotal: 0 }
  }
})

const prevServerNet = new Map()
ipcMain.handle('stats:serverNetwork', async (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  if (!serverId) return { ok: false, rxSpeed: 0, txSpeed: 0 }
  try {
    const data = await wingsApiCall('GET', `/api/servers/${serverId}`)
    const net = data?.utilization?.network
    if (!net) return { ok: false, rxSpeed: 0, txSpeed: 0 }
    const rx = Number(net.rx_bytes) || 0
    const tx = Number(net.tx_bytes) || 0
    const now = Date.now()
    const prev = prevServerNet.get(serverId)
    let rxSpeed = 0, txSpeed = 0
    if (prev && now > prev.time) {
      const elapsed = (now - prev.time) / 1000
      if (rx >= prev.rx) rxSpeed = Math.max(0, (rx - prev.rx) / elapsed)
      if (tx >= prev.tx) txSpeed = Math.max(0, (tx - prev.tx) / elapsed)
    }
    prevServerNet.set(serverId, { rx, tx, time: now })
    return { ok: true, rxSpeed, txSpeed, rxTotal: rx, txTotal: tx, state: data?.state || 'unknown' }
  } catch {
    return { ok: false, rxSpeed: 0, txSpeed: 0 }
  }
})

ipcMain.handle('wings:status', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const fs2 = require('fs')
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const wingsDir = (paths.wings || '').replace(/^~/, os.homedir())
    const wingsConfigDir = (paths.wingsConfig || '').replace(/\/+$/, '')
    let binaryPath = wingsDir ? `${wingsDir}/bin/wings` : ''
    const configPath = wingsConfigDir ? `${wingsConfigDir}/config.yml` : ''
    let installed = false
    if (binaryPath) { try { fs2.accessSync(binaryPath, fs2.constants.F_OK | fs2.constants.X_OK); installed = true } catch {} }
    if (!installed) {
      try {
        const sysBin = execSync('which wings 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
        if (sysBin && fs2.existsSync(sysBin)) { binaryPath = sysBin; installed = true }
      } catch {}
    }
    let running = false, version = ''
    if (installed) {
      try {
        const out = execSync(`${binaryPath} --version 2>&1 || true`, { timeout: 5000, encoding: 'utf8' })
        const match = out.match(/(\d+\.\d+\.\d+)/)
        if (match) version = match[1]
      } catch {}
    }
    let hasConfig = false
    if (configPath) { try { hasConfig = fs2.existsSync(configPath) } catch {} }
    let hasService = false
    try { hasService = fs2.existsSync('/etc/systemd/system/lunarspace-wings.service') } catch {}
    if (hasService) {
      try {
        const status = execSync('systemctl is-active lunarspace-wings 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
        running = status === 'active'
      } catch {}
    }
    return { ok: true, installed, running, version, arch: '', hasConfig, hasService, binaryPath, configPath }
  } catch {
    return { ok: true, installed: false, running: false, version: '', arch: '', hasConfig: false, hasService: false, binaryPath: '', configPath: '' }
  }
})

ipcMain.handle('wings:install', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync, spawn } = require('child_process')
  const fs2 = require('fs')
  const https = require('https')
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const wingsDir = (paths.wings || '').replace(/^~/, os.homedir())
    const wingsConfigDir = (paths.wingsConfig || '').replace(/\/+$/, '')
    if (!wingsDir || !wingsConfigDir) {
      return { ok: false, error: 'Chưa chọn đường dẫn Wings. Hãy Setup trước.' }
    }
    const archMap = { x86_64: 'x86_64', aarch64: 'aarch64', armv7l: 'armv7l', ppc64le: 'ppc64le', riscv64: 'riscv64' }
    let arch = 'x86_64'
    try { arch = archMap[execSync('uname -m', { encoding: 'utf8' }).trim()] || 'x86_64' } catch {}
    const binaryPath = `${wingsDir}/bin/wings`
    const configPath = `${wingsConfigDir}/config.yml`

    sendProgress('wings', 2, 'Dừng Wings process...')
    stopWingsProcess()

    if (fs2.existsSync(binaryPath)) {
      sendProgress('wings', 3, 'Xóa binary cũ...')
      try { fs2.unlinkSync(binaryPath) } catch {}
    }

  return new Promise(async (resolve) => {
    try {
      sendProgress('wings', 5, `Phát hiện kiến trúc: ${arch}`)
      sendProgress('wings', 10, 'Đang tra cứu phiên bản mới nhất trên GitHub...')
      let tagData
      try {
        const tagRes = await fetch('https://api.github.com/repos/foxstudio-201/lunarspacewinglunar/releases/latest')
        tagData = await tagRes.json()
      } catch (fetchErr) {
        resolve({ ok: false, error: `Không thể kết nối GitHub: ${fetchErr.message}` })
        return
      }
      if (!tagData || !tagData.tag_name) {
        resolve({ ok: false, error: 'Không tìm thấy release nào trên GitHub. Hãy kiểm tra lại repo foxstudio-201/lunarspacewinglunar' })
        return
      }
      const tagName = tagData.tag_name
      const assetName = `wings-rs-${arch}-linux`
      const downloadUrl = `https://github.com/foxstudio-201/lunarspacewinglunar/releases/download/${tagName}/${assetName}`
      sendProgress('wings', 15, `Phiên bản: ${tagName} — đang chuẩn bị tải...`)

      const tmpDir = '/tmp/terver-wings-install'
      if (!fs2.existsSync(tmpDir)) fs2.mkdirSync(tmpDir, { recursive: true })
      const tmpPath = `${tmpDir}/wings-rs-${arch}-linux`

      const downloadFile = (url, dest, redirectCount = 0) => new Promise((res, rej) => {
        if (redirectCount > 10) { rej(new Error('Quá nhiều redirect')); return }
        const req = https.get(url, { headers: { 'User-Agent': 'TerverPanel' }, timeout: 300000 }, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            response.resume()
            sendProgress('wings', 20, `Chuyển hướng... (${redirectCount + 1})`)
            res(downloadFile(response.headers.location, dest, redirectCount + 1))
            return
          }
          if (response.statusCode !== 200) {
            response.destroy()
            rej(new Error(`HTTP ${response.statusCode}`))
            return
          }
          const totalBytes = parseInt(response.headers['content-length'] || '0')
          let downloadedBytes = 0
          const startTime = Date.now()
          const file = fs2.createWriteStream(dest)
          file.on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
          response.on('data', (chunk) => {
            downloadedBytes += chunk.length
            if (totalBytes > 0) {
              const pct = Math.round(20 + (downloadedBytes / totalBytes) * 50)
              const speed = downloadedBytes / ((Date.now() - startTime) / 1000)
              const speedKB = (speed / 1024).toFixed(0)
              const remain = speed > 0 ? Math.ceil((totalBytes - downloadedBytes) / speed) : '?'
              sendProgress('wings', pct, `Tải Wings: ${(downloadedBytes / 1024 / 1024).toFixed(1)}/${(totalBytes / 1024 / 1024).toFixed(1)}MB (${pct}%) — ${speedKB}KB/s — còn ~${remain}s`)
            } else {
              sendProgress('wings', 20 + Math.min(50, Math.round(downloadedBytes / 1024 / 1024)), `Tải Wings: ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB...`)
            }
          })
          response.pipe(file)
          file.on('finish', () => { file.close(); res() })
          file.on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        }).on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        req.on('timeout', () => { req.destroy(); fs2.unlink(dest, () => {}); rej(new Error('Download timeout')) })
      })

      sendProgress('wings', 20, 'Bắt đầu tải Wings binary...')
      await downloadFile(downloadUrl, tmpPath)
      execSync(`chmod +x ${tmpPath}`)

      sendProgress('wings', 72, 'Kiểm tra binary...')
      const fileSize = fs2.statSync(tmpPath).size
      if (fileSize < 1000000) {
        fs2.unlinkSync(tmpPath)
        resolve({ ok: false, error: `Binary quá nhỏ (${fileSize} bytes) — tải bị lỗi. Hãy thử lại.` })
        return
      }
      try {
        execSync(`chmod +x ${tmpPath}`)
        const verOut = execSync(`${tmpPath} --version 2>&1 || true`, { timeout: 10000, encoding: 'utf8' })
        const combined = (verOut || '').toLowerCase()
        if (combined.includes('segmentation') || combined.includes('segfault') || combined.includes('core dumped') || combined.includes('signal 11')) {
          fs2.unlinkSync(tmpPath)
          resolve({ ok: false, error: `Binary bị corrupt (segfault). File size: ${(fileSize/1024/1024).toFixed(1)}MB. Hãy thử lại.` })
          return
        }
      } catch (verifyErr) {
        if (verifyErr.message && (verifyErr.message.includes('segmentation') || verifyErr.message.includes('segfault'))) {
          try { fs2.unlinkSync(tmpPath) } catch {}
          resolve({ ok: false, error: 'Binary bị corrupt (segfault). Hãy thử lại.' })
          return
        }
      }

      sendProgress('wings', 75, `Cài binary vào ${binaryPath}...`)
      try {
        fs2.mkdirSync(path.dirname(binaryPath), { recursive: true })
        fs2.copyFileSync(tmpPath, binaryPath)
        fs2.chmodSync(binaryPath, 0o755)
      } catch (copyErr) {
        throw new Error('Không thể cài binary Wings')
      }
      fs2.unlinkSync(tmpPath)

      sendProgress('wings', 80, 'Đang tạo thư mục cấu hình...')
      fs2.mkdirSync(wingsConfigDir, { recursive: true })

      sendProgress('wings', 82, 'Đang kiểm tra phiên bản Wings...')
      const versionOut = execSync(`${binaryPath} --version 2>&1 || true`, { timeout: 5000, encoding: 'utf8' })
      const versionMatch = versionOut.match(/(\d+\.\d+\.\d+)/)

      sendProgress('wings', 100, `Cài thành công Wings ${versionMatch ? versionMatch[1] : 'unknown'} (${arch})`)
      resolve({ ok: true, version: versionMatch ? versionMatch[1] : 'unknown', arch })
    } catch (err) {
      sendProgress('wings', 0, `Lỗi: ${err.message}`)
      resolve({ ok: false, error: err.message })
    }
  })
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('wings:start', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    sudoExec('systemctl start lunarspace-wings')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('wings:stop', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    sudoExec('systemctl stop lunarspace-wings')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('systemd:status', async (e, serviceName) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const fs2 = require('fs')
    const isSystemd = fs2.existsSync('/run/systemd/system')
    if (!isSystemd) return { ok: true, running: false, status: 'unknown', logs: '' }
    let status = 'unknown'
    try { status = execSync(`systemctl is-active ${serviceName} 2>/dev/null`, { timeout: 5000, encoding: 'utf8' }).trim() } catch { status = 'inactive' }
    const running = status === 'active'
    let logs = ''
    try { logs = execSync(`journalctl -u ${serviceName} -n 80 --no-pager --output=short-iso 2>/dev/null`, { timeout: 8000, encoding: 'utf8' }).trim() } catch {}
    let failed = ''
    try { failed = execSync(`systemctl show ${serviceName} --property=ActiveState,SubState,Result,ExecMainStartTimestamp 2>/dev/null`, { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
    return { ok: true, running, status, logs, failed }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('systemd:start', async (e, serviceName) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const fs2 = require('fs')
    const isSystemd = fs2.existsSync('/run/systemd/system')
    if (!isSystemd) return { ok: false, error: 'Không tìm thấy systemd' }
    let actualName = serviceName
    if (serviceName === 'docker') {
      try { execSync('systemctl list-unit-files terver-docker.service 2>/dev/null | grep terver-docker', { encoding: 'utf8' }); actualName = 'terver-docker' } catch {}
    }
    let startOutput = ''
    try { startOutput = sudoExec(`systemctl start ${actualName} 2>&1`).output || '' } catch (err) { startOutput = err.message }
    let newStatus = ''
    try { newStatus = execSync(`systemctl is-active ${actualName} 2>/dev/null`, { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
    let logs = ''
    try { logs = execSync(`journalctl -u ${actualName} -n 80 --no-pager --output=short-iso 2>/dev/null`, { timeout: 8000, encoding: 'utf8' }).trim() } catch {}
    return { ok: newStatus === 'active', status: newStatus, logs, startOutput }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('systemd:stop', async (e, serviceName) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const fs2 = require('fs')
    const isSystemd = fs2.existsSync('/run/systemd/system')
    if (!isSystemd) return { ok: false, error: 'Không tìm thấy systemd' }
    let actualName = serviceName
    if (serviceName === 'docker') {
      try { execSync('systemctl list-unit-files terver-docker.service 2>/dev/null | grep terver-docker', { encoding: 'utf8' }); actualName = 'terver-docker' } catch {}
    }
    let stopOutput = ''
    try { stopOutput = sudoExec(`systemctl stop ${actualName} 2>&1`).output || '' } catch (err) { stopOutput = err.message }
    let newStatus = ''
    try { newStatus = execSync(`systemctl is-active ${actualName} 2>/dev/null`, { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
    let logs = ''
    try { logs = execSync(`journalctl -u ${actualName} -n 80 --no-pager --output=short-iso 2>/dev/null`, { timeout: 8000, encoding: 'utf8' }).trim() } catch {}
    return { ok: newStatus === 'inactive' || newStatus === 'failed', status: newStatus, logs, stopOutput }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('systemd:logs', async (e, serviceName, lines = 80) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const fs2 = require('fs')
  try {
    const isSystemd = fs2.existsSync('/run/systemd/system')
    if (!isSystemd) return { ok: true, logs: '' }
    let actualName = serviceName
    if (serviceName === 'docker') {
      try { execSync('systemctl list-unit-files terver-docker.service 2>/dev/null | grep terver-docker', { encoding: 'utf8' }); actualName = 'terver-docker' } catch {}
    }
    let logs = ''
    try { logs = execSync(`journalctl -u ${actualName} -n ${lines} --no-pager --output=short-iso 2>/dev/null`, { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
    return { ok: true, logs }
  } catch {
    return { ok: true, logs: '' }
  }
})

ipcMain.handle('docker:start', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    let svc = 'docker'
    try { execSync('systemctl list-unit-files terver-docker.service 2>/dev/null | grep terver-docker', { encoding: 'utf8' }); svc = 'terver-docker' } catch {}
    sudoExec(`systemctl start ${svc}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('docker:stop', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    let svc = 'docker'
    try { execSync('systemctl list-unit-files terver-docker.service 2>/dev/null | grep terver-docker', { encoding: 'utf8' }); svc = 'terver-docker' } catch {}
    sudoExec(`systemctl stop ${svc}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflared:start', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())
    const binPath = cfDir ? `${cfDir}/bin/cloudflared` : 'cloudflared'
    const credDir = cfDir ? `${cfDir}/credentials` : path.join(os.homedir(), '.cloudflared')
    if (cloudflaredProcess) { try { cloudflaredProcess.kill('SIGTERM') } catch {} cloudflaredProcess = null }
    cloudflaredProcess = spawn(binPath, ['tunnel', '--config', `${credDir}/config.yml`, 'run'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: cfDir ? `${cfDir}/bin:${process.env.PATH}` : process.env.PATH },
    })
    cloudflaredProcess.on('exit', () => { cloudflaredProcess = null })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflared:stop', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    if (cloudflaredProcess) { try { cloudflaredProcess.kill('SIGTERM') } catch {} cloudflaredProcess = null }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ─── Wings API Server ────────────────────────────────────────────────
// Runs on port 6543 so Wings can talk to us as if we're a Pterodactyl panel.
let wingsApiServer = null
let wingsApiToken = null
let wingsApiTokenId = null

function startWingsApiServer() {
  if (wingsApiServer) return
  try {
    const express = require('express')
    const jwt = require('jsonwebtoken')
    const cors = require('cors')
    const apiApp = express()
    apiApp.use(cors())
    apiApp.use(express.json({ limit: '10mb' }))

    // Generate or load token
    const tokenStorePath = path.join(app.getPath('userData'), 'wings-api-token.json')
    if (fs.existsSync(tokenStorePath)) {
      const stored = JSON.parse(fs.readFileSync(tokenStorePath, 'utf8'))
      wingsApiTokenId = stored.tokenId
      wingsApiToken = stored.token
    } else {
      wingsApiTokenId = '1'
      wingsApiToken = crypto.randomBytes(32).toString('hex')
      fs.mkdirSync(path.dirname(tokenStorePath), { recursive: true })
      fs.writeFileSync(tokenStorePath, JSON.stringify({ tokenId: wingsApiTokenId, token: wingsApiToken }))
    }

    // Auth middleware — Bearer {tokenId}.{token}
    apiApp.use('/api/remote', (req, res, next) => {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const bearerToken = authHeader.slice(7)
      const [reqId, reqToken] = bearerToken.split('.')
      if (reqId !== wingsApiTokenId || reqToken !== wingsApiToken) {
        return res.status(403).json({ error: 'Invalid token' })
      }
      next()
    })

    // resolveDockerImage is defined at module top level (shared with ensureJava)

    // Helper: read servers from DB
    function getServers() {
      try {
        const db = readDB()
        const servers = db.servers || []
        return servers.map(s => {
          const res = s.resources || {}
          const env = s.config || {}
          const startupCmd = s.startup || 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}'
          const jarFile = env.SERVER_JARFILE || 'server.jar'
          const resolvedStartup = startupCmd.replace(/\{\{SERVER_JARFILE\}\}/g, jarFile)
            .replace(/\{\{SERVER_MEMORY\}\}/g, String(res.memory || 1024))
          const memFlag = `-Xms128M -Xmx${res.memory || 1024}M`
          const finalStartup = resolvedStartup.replace(/-Xms\d+M -Xmx\d+M/, memFlag)

          return {
            settings: {
              uuid: s.id,
              start_on_completion: false,
               meta: { name: s.name, description: s.name, startup_command: finalStartup, egg: { id: '00000000-0000-0000-0000-000000000001' } },
              suspended: false,
              invocation: finalStartup,
              skip_egg_scripts: false,
              entrypoint: null,
              environment: env,
              labels: {},
              backups: [],
              schedules: (readDB().schedules || []).filter(sch => sch.serverId === s.id).map(sch => ({
                id: sch.id, name: sch.name, cron: sch.cron,
                is_active: !!sch.isActive, is_processing: !!sch.isProcessing,
                last_run_at: sch.lastRunAt, next_run_at: sch.nextRunAt,
              })),
              allocations: {
                force_outgoing_ip: false,
                default: { ip: '0.0.0.0', port: s.port || 25565 },
                mappings: {}
              },
              build: {
                memory_limit: res.memory || 1024,
                overhead_memory: 0,
                swap: 0,
                io_weight: null,
                cpu_limit: res.cpuPercent || 100,
                disk_space: res.disk || 10240,
                threads: res.cpuCores ? String(res.cpuCores) : null,
                oom_disabled: false
              },
              mounts: [],
              firewall: [],
              egg: { id: '00000000-0000-0000-0000-000000000001', file_denylist: [] },
              container: {
                image: resolveDockerImage(s),
                timezone: null,
                hugepages_passthrough_enabled: false,
                kvm_passthrough_enabled: false,
                seccomp: { remove_allowed: [] }
              },
              auto_kill: { enabled: false, seconds: 0 },
              auto_start_behavior: 'never',
              features: { startup_cpu_boost: null, runtime_cpu_boost: null }
            },
            process_configuration: {
              startup: { done: [s.donePattern || ')! For help, type'], strip_ansi: false },
              stop: { type: 'tag', value: s.stopCommand || 'stop' },
              configs: []
            }
          }
        })
      } catch { return [] }
    }

    function getServer(uuid) {
      return getServers().find(s => s.settings?.uuid === uuid) || null
    }

    // ─── Endpoints ───────────────────────────────────────────────────
    // List servers
    apiApp.get('/api/remote/servers', (req, res) => {
      const page = parseInt(req.query.page) || 1
      const perPage = parseInt(req.query.per_page) || 50
      const allServers = getServers()
      const start = (page - 1) * perPage
      const servers = allServers.slice(start, start + perPage)
      const totalPages = Math.ceil(allServers.length / perPage)
      res.json({
        data: servers,
        meta: {
          current_page: page,
          from: allServers.length > 0 ? (start + 1) : 0,
          last_page: totalPages,
          per_page: perPage,
          path: '/api/remote/servers',
          to: Math.min(start + perPage, allServers.length),
          total: allServers.length
        }
      })
    })

    // Get single server
     apiApp.get('/api/remote/servers/:uuid', (req, res) => {
       const server = getServer(req.params.uuid)
       if (!server) return res.status(404).json({ error: 'Server not found', errors: [] })
       res.json(server)
     })

    // Get install script
    apiApp.get('/api/remote/servers/:uuid/install', (req, res) => {
      const server = getServer(req.params.uuid)
      if (!server) return res.status(404).json({ error: 'Server not found' })
      const dbServer = getServerByUuid(req.params.uuid)
      if (!dbServer || dbServer.installedAt) return res.json({ command: '', done: true })
      const eggId = dbServer?.eggId || ''
      try {
        const eggsDir = path.join(__dirname, 'eggs')
        const parts = eggId.split('/')
        const filePath = path.join(eggsDir, parts[0], parts[1] + '.json')
        const raw = fs.readFileSync(filePath, 'utf8')
        const egg = JSON.parse(raw)
        const install = egg.scripts?.installation || {}
        const envVars = {}
        if (egg.variables) {
          for (const v of egg.variables) {
            if (v.env_variable && v.default_value !== undefined) {
              envVars[v.env_variable] = v.default_value
            }
          }
        }
        if (dbServer.config) Object.assign(envVars, dbServer.config)
        res.json({
          script: install.script || '',
          container_image: install.container || 'ghcr.io/pelican-eggs/installers:alpine',
          entrypoint: install.entrypoint || 'ash',
          done: false,
          environment: envVars,
        })
      } catch {
        res.json({ command: '', done: true })
      }
    })

    // Report install status
    apiApp.post('/api/remote/servers/:uuid/install', (req, res) => {
      const body = req.body || {}
      const dbServer = getServerByUuid(req.params.uuid)
      if (dbServer) {
        if (body.successful !== false) {
          updateServerConfig(dbServer.id, {
            status: 'stopped',
            installedAt: new Date().toISOString(),
          })
          sendServerProgress(dbServer.id, 100, 'Installation complete!')
          sendServerLog(dbServer.id, '[Install] Wings installation completed successfully!')
        } else {
          updateServerConfig(dbServer.id, { status: 'error', installError: 'Wings install failed' })
          sendServerProgress(dbServer.id, 0, 'Installation failed!')
          sendServerLog(dbServer.id, '[Install] Wings installation failed!')
        }
      }
      res.json({ successful: true, reinstall: false })
    })

    // Reset state on boot
    apiApp.post('/api/remote/servers/reset', (req, res) => {
      res.json({ data: [] })
    })

    // Activity data
    apiApp.post('/api/remote/activity', (req, res) => {
      res.json({ ok: true })
    })

    // Schedule (panel runs its own cron runner; just acknowledge Wings callbacks)
    apiApp.post('/api/remote/schedule', (req, res) => {
      res.json({ ok: true })
    })

    // SFTP auth
    apiApp.post('/api/remote/sftp/auth', (req, res) => {
      res.status(401).json({ error: 'SFTP not supported in local mode' })
    })

    // Startup variable
    apiApp.put('/api/remote/servers/:uuid/startup/variables', (req, res) => {
      res.json({ data: {} })
    })

    // Startup command
    apiApp.put('/api/remote/servers/:uuid/startup/command', (req, res) => {
      res.json({ data: {} })
    })

    // Startup docker image
    apiApp.put('/api/remote/servers/:uuid/startup/docker-image', (req, res) => {
      res.json({ data: {} })
    })

    // Backup endpoints
    apiApp.post('/api/remote/backups/:uuid', (req, res) => { res.json({ data: {} }) })
    apiApp.post('/api/remote/backups/:uuid/deletion', (req, res) => { res.json({ data: {} }) })
    apiApp.post('/api/remote/backups/:uuid/restore', (req, res) => { res.json({ data: {} }) })
    apiApp.post('/api/remote/backups/:uuid/database/restore', (req, res) => { res.json({ data: {} }) })
    apiApp.get('/api/remote/backups/:uuid/database/source', (req, res) => { res.status(404).json({ error: 'Not available' }) })
    apiApp.get('/api/remote/backups/:uuid', (req, res) => { res.json({ parts: [] }) })
    apiApp.get('/api/remote/backups/:uuid/s3/parts', (req, res) => { res.json({ parts: [] }) })
    apiApp.get('/api/remote/backups/:uuid/restic', (req, res) => { res.json({ repository: '' }) })
    apiApp.get('/api/remote/backups/:uuid/pbs', (req, res) => { res.json({}) })
    apiApp.get('/api/remote/backups/:uuid/kopia', (req, res) => { res.json({}) })
    apiApp.post('/api/remote/servers/:uuid/backups', (req, res) => { res.json({ data: {} }) })
    apiApp.post('/api/remote/servers/:uuid/backups/restore', (req, res) => { res.json({ data: {} }) })
    apiApp.post('/api/remote/servers/:uuid/backups/restore-database', (req, res) => { res.json({ data: {} }) })
    apiApp.delete('/api/remote/servers/:uuid/backups', (req, res) => { res.json({ data: {} }) })
    apiApp.patch('/api/remote/servers/:uuid/backups', (req, res) => { res.json({ data: {} }) })

    // Tundra (tunnel) endpoints
    apiApp.get('/api/remote/tunnel/state', (req, res) => { res.json({ enabled: false, config: {} }) })
    apiApp.post('/api/remote/tunnel/cert', (req, res) => { res.json({ ok: true }) })
    apiApp.get('/api/remote/tunnel/connect-token', (req, res) => { res.json({ token: '' }) })

    // Start server
    const PORT = 6543
    wingsApiServer = apiApp.listen(PORT, '127.0.0.1', () => {
      console.log(`[Wings API] Listening on http://127.0.0.1:${PORT}`)
    })
    wingsApiServer.on('error', (err) => {
      console.error(`[Wings API] Error: ${err.message}`)
      wingsApiServer = null
    })
  } catch (err) {
    console.error(`[Wings API] Failed to start: ${err.message}`)
  }
}

function stopWingsApiServer() {
  if (wingsApiServer) {
    wingsApiServer.close()
    wingsApiServer = null
    console.log('[Wings API] Stopped')
  }
}

// ─── Wings Config Generate (with remote URL) ────────────────────────
ipcMain.handle('wings:config:generate', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const fs2 = require('fs')
  const yaml = require('js-yaml')
  try {
    startWingsApiServer()
    const settings = readSettings()
    const paths = settings.paths || {}
    const configDir = (paths.wingsConfig || '/etc/lunarspace-wings').replace(/\/+$/, '')
    const dataDir = (paths.wings || '~/.local/share/terver/wings').replace(/\/+$/, '')
    const configPath = `${configDir}/config.yml`
    fs.mkdirSync(configDir, { recursive: true })
    const config = {
      uuid: require('crypto').randomUUID(),
      token_id: wingsApiTokenId || '1',
      token: wingsApiToken || crypto.randomBytes(32).toString('hex'),
      remote: `http://127.0.0.1:6543`,
      api: { host: '0.0.0.0', port: 8080, ssl: { enabled: false }, send_offline_server_logs: true, websocket_log_count: 500 },
      system: {
        root_directory: dataDir,
        data: `${dataDir}/servers`,
        log_directory: `${dataDir}/logs`,
        diffs_directory: `${dataDir}/diffs`,
        vmount_directory: `${dataDir}/vmounts`,
        archive_directory: `${dataDir}/archives`,
        backup_directory: `${dataDir}/backups`,
        tmp_directory: `${dataDir}/tmp`,
        username: 'lunarspace',
      },
      allowed_mounts: ['/home', `${dataDir}/servers`],
      docker: { network: { interface: 'wings0', name: 'lunarspace-net', mode: 'lunarspace-net', subnet: '172.18.0.0/16' } },
    }
    fs.writeFileSync(configPath, yaml.dump(config), { mode: 0o600 })
    return { ok: true, path: configPath, token: config.token, uuid: config.uuid }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflare:check', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const fs2 = require('fs')
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())

    let installed = false
    let version = ''
    let running = false
    let usingSystem = false

    if (cfDir) {
      const binPath = `${cfDir}/bin/cloudflared`
      try { fs2.accessSync(binPath, fs2.constants.F_OK | fs2.constants.X_OK); installed = true } catch {}
      if (installed) {
        try { version = execSync(`${binPath} --version 2>/dev/null`, { timeout: 5000, encoding: 'utf8' }).trim() } catch {}
        try { const s = execSync('systemctl is-active terver-cloudflare 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); running = s === 'active' } catch {}
        if (!running) {
          try { const s = execSync('systemctl is-active cloudflared 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); if (s === 'active') { running = true; usingSystem = true } } catch {}
        }
      }
    }

    if (!installed) {
      try {
        version = execSync('cloudflared --version 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
        installed = true
        usingSystem = true
        try { const s = execSync('systemctl is-active cloudflared 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim(); running = s === 'active' } catch {}
      } catch {}
    }

    return { ok: true, installed, version, running, usingSystem }
  } catch {
    return { ok: true, installed: false, version: '', running: false }
  }
})

ipcMain.handle('cloudflare:install', async (e, arch) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const fs2 = require('fs')
  const https = require('https')
  const settings = readSettings()
  const paths = settings.paths || {}
  const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())
  if (!cfDir) return { ok: false, error: 'Chưa chọn đường dẫn Cloudflare. Hãy Setup trước.' }
  const binDir = `${cfDir}/bin`
  const binaryPath = `${binDir}/cloudflared`
  const tmpPath = path.join(os.tmpdir(), 'terver-cloudflared')
  return new Promise((resolve) => {
    try {
      const archMap = { x86_64: 'amd64', aarch64: 'arm64', armv7l: 'arm', ppc64le: 'ppc64le' }
      const realArch = archMap[arch] || 'amd64'
      const downloadUrl = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${realArch}`
      sendProgress('cloudflare', 5, `Phát hiện kiến trúc: ${realArch}`)
      sendProgress('cloudflare', 10, 'Đang tạo thư mục...')
      fs.mkdirSync(binDir, { recursive: true })
      sendProgress('cloudflare', 15, 'Đang tải cloudflared từ GitHub...')

      const downloadFile = (url, dest, redirectCount = 0) => new Promise((res, rej) => {
        if (redirectCount > 5) { rej(new Error('Quá nhiều redirect')); return }
        const file = fs2.createWriteStream(dest)
        file.on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        const req = https.get(url, { headers: { 'User-Agent': 'TerverPanel' }, timeout: 30000 }, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            file.close(); fs2.unlink(dest, () => {})
            sendProgress('cloudflare', 15, 'Đang chuyển hướng download...')
            downloadFile(response.headers.location, dest, redirectCount + 1).then(res, rej)
            return
          }
          if (response.statusCode !== 200) {
            file.close(); response.destroy()
            rej(new Error(`HTTP ${response.statusCode}`))
            return
          }
          const totalBytes = parseInt(response.headers['content-length'] || '0')
          let downloadedBytes = 0
          const startTime = Date.now()
          response.on('data', (chunk) => {
            downloadedBytes += chunk.length
            if (totalBytes > 0) {
              const pct = Math.round(15 + (downloadedBytes / totalBytes) * 55)
              const speed = downloadedBytes / ((Date.now() - startTime) / 1000)
              const speedMB = (speed / 1024 / 1024).toFixed(1)
              const remain = speed > 0 ? Math.ceil((totalBytes - downloadedBytes) / speed) : '?'
              sendProgress('cloudflare', pct, `Tải Cloudflared: ${(downloadedBytes / 1024 / 1024).toFixed(1)}/${(totalBytes / 1024 / 1024).toFixed(1)}MB (${pct}%) — ${speedMB}MB/s — còn ~${remain}s`)
            } else {
              sendProgress('cloudflare', 15 + Math.min(55, Math.round(downloadedBytes / 1024 / 1024)), `Tải Cloudflared: ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB...`)
            }
          })
          response.pipe(file)
          file.on('finish', () => { file.close(); res() })
          file.on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        }).on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        req.on('timeout', () => { req.destroy(); fs2.unlink(dest, () => {}); rej(new Error('Download timeout')) })
      })

      downloadFile(downloadUrl, tmpPath).then(() => {
        sendProgress('cloudflare', 72, 'Tải xong — đang set quyền thực thi...')
        try { fs2.chmodSync(tmpPath, 0o755) } catch (_) {}
        sendProgress('cloudflare', 75, `Đang cài binary vào ${binaryPath}...`)
        try {
          fs2.copyFileSync(tmpPath, binaryPath)
          fs2.chmodSync(binaryPath, 0o755)
        } catch (copyErr) {
          fs2.unlink(tmpPath, () => {})
          sendProgress('cloudflare', 0, `Lỗi: ${copyErr.message}`)
          resolve({ ok: false, error: copyErr.message })
          return
        }
        fs2.unlink(tmpPath, () => {})
        sendProgress('cloudflare', 90, 'Đang xác minh phiên bản...')
        try {
          const out = execSync(`${binaryPath} --version 2>&1`, { timeout: 5000, encoding: 'utf8' }).trim()
          sendProgress('cloudflare', 100, `Cài thành công: ${out}`)
          resolve({ ok: true, version: out })
        } catch (verErr) {
          sendProgress('cloudflare', 100, 'Cài xong nhưng chưa xác minh được phiên bản')
          resolve({ ok: false, error: 'Cài xong nhưng không thể xác minh phiên bản: ' + verErr.message })
        }
      }).catch((err) => {
        sendProgress('cloudflare', 0, `Lỗi tải: ${err.message}`)
        resolve({ ok: false, error: err.message })
      })
    } catch (err) {
      sendProgress('cloudflare', 0, `Lỗi: ${err.message}`)
      resolve({ ok: false, error: err.message })
    }
  })
})

ipcMain.handle('cloudflare:tunnel:create', async (e, tunnelName, appDomain) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync, exec: execAsync } = require('child_process')
  const settings = readSettings()
  const paths = settings.paths || {}
  const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())

    const sudoRun = async (cmd) => {
      try {
        const result = execSync(cmd, { timeout: 30000, encoding: 'utf8' })
        return { ok: true, output: result || '' }
      } catch (err) {
        return { ok: false, error: err.message, output: err.stdout || '' }
      }
    }

  try {
    const binPath = cfDir ? `${cfDir}/bin/cloudflared` : 'cloudflared'
    try { execSync(`test -x ${binPath}`, { stdio: 'ignore' }) } catch {
      return { ok: false, error: 'cloudflared chưa được cài đặt. Hãy cài trước.' }
    }

    const credDir = cfDir ? `${cfDir}/credentials` : path.join(os.homedir(), '.cloudflared')
    try { fs.mkdirSync(credDir, { recursive: true }) } catch {}
    const certPath = `${credDir}/cert.pem`

    let hasCert = false
    try { hasCert = fs.existsSync(certPath) } catch {}

    if (!hasCert) {
      return { ok: false, error: 'Chưa xác thực Cloudflare. Hãy bấm "Đăng nhập" trên tab Trạng thái trước.' }
    }

    const createResult = await sudoRun(`${binPath} tunnel create ${tunnelName} 2>&1`)
    if (!createResult.ok) {
      return { ok: false, error: `Không thể tạo tunnel: ${createResult.error || createResult.output || 'Lỗi không xác định'}` }
    }

    const listResult = await sudoRun(`${binPath} tunnel list -o json 2>&1`)
    let id = ''
    try {
      const tunnels = JSON.parse(listResult.output || '[]')
      const t = tunnels.find(t => t.name === tunnelName)
      if (t) id = t.id
    } catch (parseErr) {
      return { ok: false, error: `Không thể đọc danh sách tunnel: ${parseErr.message}` }
    }

    if (!id) return { ok: false, error: `Không tìm thấy tunnel "${tunnelName}" sau khi tạo.` }

    if (appDomain) {
      const routeResult = await sudoRun(`${binPath} tunnel route dns ${tunnelName} ${appDomain} 2>&1`)
      if (!routeResult.ok && routeResult.error && !routeResult.error.includes('already exists')) {
        return { ok: false, error: `Route DNS thất bại: ${routeResult.error}` }
      }
    }

    const ingressRules = appDomain
      ? `  - hostname: ${appDomain}\n    service: http://localhost:8000`
      : '  - service: http_status:404'
    const configContent = `tunnel: ${id}\ncredentials-file: ${credDir}/${id}.json\ningress:\n${ingressRules}\n  - service: http_status:404`
    await fs.promises.writeFile(`${credDir}/config.yml`, configContent)

    const tunnelProc = spawn(binPath, ['tunnel', '--config', `${credDir}/config.yml`, 'run', tunnelName], {
      stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    })
    tunnelProc.unref()

    return { ok: true, tunnelId: id, message: `Tunnel "${tunnelName}" đã tạo${appDomain ? `, route: ${appDomain}` : ''}` }
  } catch (err) {
    return { ok: false, error: `Lỗi: ${err.message}` }
  }
})


ipcMain.handle('cloudflare:tunnel:install-service', async (e, token) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())
    const binPath = cfDir ? `${cfDir}/bin/cloudflared` : 'cloudflared'
    const credDir = cfDir ? `${cfDir}/credentials` : path.join(os.homedir(), '.cloudflared')
    const configPath = `${credDir}/config.yml`

    if (cloudflaredProcess) { try { cloudflaredProcess.kill('SIGTERM') } catch {} cloudflaredProcess = null }
    cloudflaredProcess = spawn(binPath, ['tunnel', '--config', configPath, 'run'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: cfDir ? `${cfDir}/bin:${process.env.PATH}` : process.env.PATH },
    })
    cloudflaredProcess.stdout?.on('data', (d) => console.log('[Cloudflare]', d.toString().trim()))
    cloudflaredProcess.stderr?.on('data', (d) => console.error('[Cloudflare]', d.toString().trim()))
    cloudflaredProcess.on('exit', () => { cloudflaredProcess = null })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflare:tunnel:login', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { spawn, execSync } = require('child_process')
  const fs2 = require('fs')
  try {
    const settings = readSettings()
    const paths = settings.paths || {}
    const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())
    if (!cfDir) return { ok: false, error: 'Chưa chọn đường dẫn Cloudflare. Hãy Setup trước.' }
    const binPath = `${cfDir}/bin/cloudflared`
    try { execSync(`test -x ${binPath}`, { stdio: 'ignore' }) } catch {
      return { ok: false, error: 'cloudflared chưa được cài đặt. Hãy cài trước.' }
    }
    const realHome = '/home/neo'
    const certDir = `${realHome}/.cloudflared`
    fs2.mkdirSync(certDir, { recursive: true })
    const child = spawn(binPath, ['tunnel', 'login'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, HOME: realHome }
    })
    child.unref()
    return { ok: true, message: 'Đang mở trình duyệt Cloudflare... Sau khi đăng nhập xong, bấm "Kiểm tra" để xác nhận.' }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflare:tunnel:check-auth', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const fs2 = require('fs')
    const settings = readSettings()
    const paths = settings.paths || {}
    const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())
    const locations = [
      cfDir ? `${cfDir}/cert.pem` : null,
      '/home/neo/.cloudflared/cert.pem',
      '/root/.cloudflared/cert.pem',
    ].filter(Boolean)
    for (const loc of locations) {
      if (fs2.existsSync(loc)) {
        if (cfDir && !fs2.existsSync(`${cfDir}/cert.pem`) && loc !== `${cfDir}/cert.pem`) {
          try { fs.mkdirSync(cfDir, { recursive: true }); fs.copyFileSync(loc, `${cfDir}/cert.pem`); fs.chmodSync(`${cfDir}/cert.pem`, 0o644) } catch {}
        }
        if (loc !== '/home/neo/.cloudflared/cert.pem' && fs2.existsSync('/home/neo/.cloudflared/cert.pem')) {
          // cert already in user home
        }
        return { ok: true, authenticated: true }
      }
    }
    return { ok: true, authenticated: false }
  } catch {
    return { ok: true, authenticated: false }
  }
})

ipcMain.handle('system:cleanup', async (e, type) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const results = []
  try {
    if (type === 'docker' || type === 'all') {
      const settings = readSettings()
      const paths = settings.paths || {}
      const dockerDir = (paths.docker || '').replace(/^~/, os.homedir())
      results.push('Docker: Đang dừng service...')
      sudoExec('systemctl stop terver-docker 2>/dev/null || true')
      sudoExec('systemctl disable terver-docker 2>/dev/null || true')
      if (dockerDir) {
        results.push('Docker: Đang dừng containers...')
        const sock = `${dockerDir}/docker.sock`
        try {
          sudoExec(`DOCKER_HOST=unix://${sock} docker rm -f $(DOCKER_HOST=unix://${sock} docker ps -aq) 2>/dev/null || true`)
          sudoExec(`DOCKER_HOST=unix://${sock} docker rmi -f $(DOCKER_HOST=unix://${sock} docker images -aq) 2>/dev/null || true`)
          sudoExec(`DOCKER_HOST=unix://${sock} docker volume rm $(DOCKER_HOST=unix://${sock} docker volume ls -q) 2>/dev/null || true`)
        } catch {}
        results.push('Docker: Đang xóa binary + config + data...')
        sudoExec(`rm -rf ${dockerDir}`)
      }
      sudoExec('rm -f /etc/systemd/system/terver-docker.service')
      sudoExec('systemctl daemon-reload 2>/dev/null || true')
      results.push('Docker: Đã gỡ xong')
      results.push('Docker: Đang gỡ package...')
      sudoExec('apt purge -y docker docker.io containerd runc 2>/dev/null || dnf remove -y docker docker-ce 2>/dev/null || pacman -Rns --noconfirm docker 2>/dev/null || true')
      results.push('Docker: Đã xóa hoàn toàn')
    }
    if (type === 'wings' || type === 'all') {
      const settings = readSettings()
      const paths = settings.paths || {}
      const wingsDir = (paths.wings || '').replace(/^~/, os.homedir())
      const wingsConfigDir = (paths.wingsConfig || '').replace(/\/+$/, '')
      results.push('Wings: Đang dừng service...')
      sudoExec('systemctl stop lunarspace-wings 2>/dev/null || rc-service lunarspace-wings stop 2>/dev/null || true')
      sudoExec('systemctl disable lunarspace-wings 2>/dev/null || true')
      results.push('Wings: Đang xóa binary + config + data + logs...')
      if (wingsDir) sudoExec(`rm -rf ${wingsDir}`)
      if (wingsConfigDir) sudoExec(`rm -rf ${wingsConfigDir}`)
      sudoExec('rm -f /etc/systemd/system/lunarspace-wings.service')
      sudoExec('systemctl daemon-reload 2>/dev/null || true')
      results.push('Wings: Đã xóa hoàn toàn')
    }
    if (type === 'cloudflare' || type === 'all') {
      const settings = readSettings()
      const paths = settings.paths || {}
      const cfDir = (paths.cloudflare || '').replace(/^~/, os.homedir())
      results.push('Cloudflare: Đang dừng service...')
      sudoExec('systemctl stop terver-cloudflare 2>/dev/null || true')
      sudoExec('systemctl disable terver-cloudflare 2>/dev/null || true')
      if (cfDir) {
        results.push('Cloudflare: Đang xóa binary + cert + config + tunnels...')
        sudoExec(`rm -rf ${cfDir}`)
      }
      sudoExec('rm -f /etc/systemd/system/terver-cloudflare.service')
      sudoExec('systemctl daemon-reload 2>/dev/null || true')
      results.push('Cloudflare: Đã xóa hoàn toàn')
    }
    if (type === 'database' || type === 'all') {
      results.push('Database: Đang dừng PostgreSQL...')
      sudoExec('systemctl stop postgresql 2>/dev/null || true')
      sudoExec('systemctl disable postgresql 2>/dev/null || true')
      results.push('Database: Đang xóa database + data + config...')
      sudoExec('rm -rf /var/lib/postgresql /etc/postgresql /var/log/postgresql /var/run/postgresql')
      sudoExec('apt purge -y postgresql postgresql-* 2>/dev/null || dnf remove -y postgresql-server 2>/dev/null || pacman -Rns --noconfirm postgresql 2>/dev/null || true')
      results.push('Database: Đã xóa hoàn toàn')
    }
    if (type === 'logs' || type === 'all') {
      results.push('Logs: Đang xoay + dọn logs...')
      sudoExec('journalctl --rotate 2>/dev/null || true')
      sudoExec('journalctl --vacuum-time=1s 2>/dev/null || true')
      sudoExec('rm -rf /var/log/*.log /var/log/*.gz /var/log/*.* 2>/dev/null || true')
      results.push('Logs: Đã dọn sạch')
    }
    return { ok: true, results }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('database:setup', async (e, dbName, dbUser, dbPass) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const isRunning = sudoExec('systemctl is-active postgresql').output?.includes('active')
    if (!isRunning) {
      sudoExec('systemctl enable --now postgresql')
      await new Promise(r => setTimeout(r, 3000))
    }
    const escDbUser = dbUser.replace(/'/g, "''")
    const escDbPass = dbPass.replace(/'/g, "''")
    const escDbName = dbName.replace(/'/g, "''")
    sudoExec(`su - postgres -c "psql -c \\"CREATE USER ${escDbUser} WITH PASSWORD '${escDbPass}'\\"" 2>/dev/null || true`)
    sudoExec(`su - postgres -c "psql -c \\"CREATE DATABASE ${escDbName} OWNER ${escDbUser}\\"" 2>/dev/null || true`)
    sudoExec(`su - postgres -c "psql -c \\"GRANT ALL PRIVILEGES ON DATABASE ${escDbName} TO ${escDbUser}\\""`)
    return { ok: true, message: `Database ${dbName} ready` }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('database:install', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const fs2 = require('fs')
  const settings = readSettings()
  const paths = settings.paths || {}
  const dbDir = (paths.database || '').replace(/^~/, os.homedir())
  if (!dbDir) return { ok: false, error: 'Chưa chọn đường dẫn Database. Hãy Setup trước.' }
  try {
    let pgInstalled = false
    try { execSync('which psql 2>/dev/null', { stdio: 'ignore' }); pgInstalled = true } catch {}
    sendProgress('database', 5, 'Đang phát hiện hệ điều hành...')
    const distro = execSync('cat /etc/os-release 2>/dev/null || true', { timeout: 5000, encoding: 'utf8' })
    if (pgInstalled) {
      sendProgress('database', 10, 'PostgreSQL đã có — đang cấu hình...')
    } else if (distro.includes('Arch') || distro.includes('Manjaro')) {
      sendProgress('database', 10, 'Phát hiện Arch/Manjaro — đang cài bằng pacman...')
      sudoExec('pacman -S --noconfirm postgresql')
    } else if (distro.includes('Alpine')) {
      sendProgress('database', 10, 'Phát hiện Alpine — đang cài bằng apk...')
      sudoExec('apk add postgresql postgresql-client')
    } else {
      sendProgress('database', 10, 'Phát hiện distro phổ thông — đang cài bằng apt...')
      sudoExec('apt-get update -qq && apt-get install -y -qq postgresql postgresql-contrib')
    }
    sendProgress('database', 50, 'Đang tạo thư mục data...')
    sudoExec(`mkdir -p ${dbDir}/data ${dbDir}/log ${dbDir}/run`)
    const hasData = fs2.existsSync(`${dbDir}/data/PG_VERSION`)
    if (!hasData) {
      sendProgress('database', 60, 'Đang khởi tạo database...')
      sudoExec(`su - postgres -c "initdb -D ${dbDir}/data" 2>/dev/null || true`)
    } else {
      sendProgress('database', 60, 'Database đã tồn tại — bỏ qua initdb')
    }
    sudoExec(`chown -R postgres:postgres ${dbDir}`)
    sendProgress('database', 70, 'Đang cấu hình PostgreSQL...')
    sudoExec(`sed -i "s|#data_directory = .*|data_directory = '${dbDir}/data'|" ${dbDir}/data/postgresql.conf 2>/dev/null || true`)
    sudoExec(`sed -i "s|#log_directory = .*|log_directory = '${dbDir}/log'|" ${dbDir}/data/postgresql.conf 2>/dev/null || true`)
    sudoExec(`sed -i "s|#unix_socket_directories = .*|unix_socket_directories = '${dbDir}/run'|" ${dbDir}/data/postgresql.conf 2>/dev/null || true`)
    sendProgress('database', 85, 'Đang enable + start PostgreSQL...')
    if (distro.includes('Alpine')) {
      sudoExec('rc-update add postgresql default')
      sudoExec('rc-service postgresql start')
    } else {
      sudoExec('systemctl enable --now postgresql')
    }
    sendProgress('database', 95, 'Đang xác minh...')
    const version = execSync('psql --version 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
    sendProgress('database', 100, `Cài thành công: ${version} — Data: ${dbDir}`)
    return { ok: true, version, dataDir: dbDir }
  } catch (err) {
    sendProgress('database', 0, `Lỗi: ${err.message}`)
    return { ok: false, error: err.message }
  }
})

// ─── Schedules (cron + multi-step like Calagopus) ───────────────────
function listSchedules(serverId) {
  const db = readDB()
  return (db.schedules || []).filter(s => !serverId || s.serverId === serverId)
}

function writeSchedules(list) {
  const db = readDB()
  db.schedules = list
  writeDB(db)
}

function getScheduleById(id) {
  return listSchedules().find(s => s.id === id) || null
}

function saveSchedule(schedule) {
  const list = listSchedules()
  const idx = list.findIndex(s => s.id === schedule.id)
  schedule.updatedAt = Date.now()
  if (idx >= 0) list[idx] = schedule
  else list.push(schedule)
  writeSchedules(list)
  return schedule
}

function parseCronField(field, min, max) {
  const values = new Set()
  for (const part of String(field || '').split(',')) {
    const p = part.trim()
    if (!p) continue
    if (p === '*') {
      for (let i = min; i <= max; i++) values.add(i)
      continue
    }
    const stepMatch = p.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/)
    if (stepMatch) {
      const step = parseInt(stepMatch[2], 10)
      if (!step || step < 1) continue
      let start = min
      let end = max
      if (stepMatch[1] !== '*') {
        const range = stepMatch[1].split('-')
        start = parseInt(range[0], 10)
        end = range.length > 1 ? parseInt(range[1], 10) : max
      }
      for (let i = start; i <= end; i += step) {
        if (i >= min && i <= max) values.add(i)
      }
      continue
    }
    const rangeMatch = p.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const a = parseInt(rangeMatch[1], 10)
      const b = parseInt(rangeMatch[2], 10)
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
        if (i >= min && i <= max) values.add(i)
      }
      continue
    }
    const n = parseInt(p, 10)
    if (!Number.isNaN(n) && n >= min && n <= max) values.add(n)
  }
  return values
}

function isValidCron(cron) {
  const parts = String(cron || '').trim().split(/\s+/)
  if (parts.length !== 5) return false
  const mins = parseCronField(parts[0], 0, 59)
  const hours = parseCronField(parts[1], 0, 23)
  const doms = parseCronField(parts[2], 1, 31)
  const mons = parseCronField(parts[3], 1, 12)
  const dows = parseCronField(parts[4], 0, 7)
  return mins.size > 0 && hours.size > 0 && doms.size > 0 && mons.size > 0 && dows.size > 0
}

function cronMatches(cron, date) {
  const parts = String(cron || '').trim().split(/\s+/)
  if (parts.length !== 5) return false
  const mins = parseCronField(parts[0], 0, 59)
  const hours = parseCronField(parts[1], 0, 23)
  const doms = parseCronField(parts[2], 1, 31)
  const mons = parseCronField(parts[3], 1, 12)
  const dows = parseCronField(parts[4], 0, 7)
  const dow = date.getDay()
  const domMatch = doms.has(date.getDate())
  const dowMatch = dows.has(dow) || dows.has(7)
  // Standard cron: if both dom and dow are restricted (not *), OR them
  const domAll = parts[2] === '*'
  const dowAll = parts[4] === '*'
  const dayOk = (domAll && dowAll) || (!domAll && !dowAll && (domMatch || dowMatch)) || (!domAll && dowAll && domMatch) || (domAll && !dowAll && dowMatch)
  return mins.has(date.getMinutes()) && hours.has(date.getHours()) && mons.has(date.getMonth() + 1) && dayOk
}

function nextCronRun(cron, from = Date.now()) {
  const start = new Date(from)
  start.setSeconds(0, 0)
  start.setMinutes(start.getMinutes() + 1)
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const d = new Date(start.getTime() + i * 60000)
    if (cronMatches(cron, d)) return d.getTime()
  }
  return null
}

function humanizeCron(cron) {
  const parts = String(cron || '').trim().split(/\s+/)
  if (parts.length !== 5) return cron || ''
  const [min, hour, dom, mon, dow] = parts
  if (min === '*' && hour === '*') return 'Every minute'
  if (/^\*\/\d+$/.test(min) && hour === '*') return `Every ${min.slice(2)} minutes`
  if (min === '0' && hour === '*') return 'Every hour (on the hour)'
  if (min === '0' && /^\*\/\d+$/.test(hour)) return `Every ${hour.slice(2)} hours`
  if (min !== '*' && /^\d+$/.test(min) && hour !== '*' && /^\d+$/.test(hour) && dom === '*' && mon === '*' && dow === '*') {
    const h = parseInt(hour, 10)
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `Daily at ${h12}:${min.padStart(2, '0')} ${ampm}`
  }
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '*') return 'Daily at 00:00'
  if (min === '0' && hour === '0' && dom === '1' && mon === '*' && dow === '*') return 'Monthly on day 1 at 00:00'
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && (dow === '0' || dow === '7')) return 'Weekly on Sunday at 00:00'
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '1') return 'Weekly on Monday at 00:00'
  return `Cron: ${cron}`
}

async function executeScheduleStep(serverId, step) {
  const action = step.action || 'command'
  if (action === 'power') {
    const power = step.power || 'start'
    ensureEula(serverId)
    if (power === 'start' || power === 'restart') ensureJava(serverId)
    await wingsApiCall('POST', `/api/servers/${serverId}/power`, { action: power, wait_seconds: 0 })
    if (power === 'start' || power === 'restart') {
      updateServerConfig(serverId, { status: 'starting' })
      appendServerHistory(serverId, power === 'restart' ? 'restart' : 'start')
      beginLogSession(serverId)
      sendServerLog(serverId, `[Schedule] Power → ${power}`)
      startLogStream(serverId, { boot: true, baseline: true })
      ensureWingsWs(serverId)
    } else if (power === 'stop') {
      updateServerConfig(serverId, { status: 'stopping' })
      appendServerHistory(serverId, 'stop')
      stopTpsPoller(serverId)
      clearServerTps(serverId)
      sendServerLog(serverId, '[Schedule] Power → stop')
      stopLogStream(serverId)
      startLogStream(serverId, { baseline: true })
      ensureWingsWs(serverId)
      scheduleStopCleanup(serverId, 15000)
    } else if (power === 'kill') {
      updateServerConfig(serverId, { status: 'stopped' })
      appendServerHistory(serverId, 'kill')
      stopTpsPoller(serverId)
      clearServerTps(serverId)
      sendServerLog(serverId, '[Schedule] Power → kill')
      stopLogStream(serverId)
      await wingsApiCall('POST', `/api/servers/${serverId}/power`, { action: 'kill', wait_seconds: 0 })
      closeWingsWs(serverId, { reconnect: false })
    }
    return true
  }
  if (action === 'command') {
    const cmd = String(step.command || '').trim()
    if (!cmd) throw new Error('Empty command')
    sendServerLog(serverId, `[Schedule] > ${cmd}`)
    await wingsApiCall('POST', `/api/servers/${serverId}/commands`, { commands: [cmd] })
    return true
  }
  if (action === 'backup') {
    const server = getServerByUuid(serverId)
    if (!server) throw new Error('Server not found')
    const srcDir = path.join(WINGS_DATA_DIR, serverId)
    const backupsDir = path.join(srcDir, 'backups')
    if (!fs.existsSync(srcDir)) throw new Error('Server directory missing')
    fs.mkdirSync(backupsDir, { recursive: true, mode: 0o755 })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outName = `schedule-${stamp}.tar.gz`
    const outPath = path.join(backupsDir, outName)
    const res = await runProc('tar', ['-czf', outPath, '-C', srcDir, '--exclude=backups', '.'], { timeout: 120000 })
    if (res.status !== 0) throw new Error(res.stderr || 'Backup failed')
    sendServerLog(serverId, `[Schedule] Backup created: ${outName}`)
    return true
  }
  throw new Error(`Unknown action: ${action}`)
}

async function runScheduleNow(scheduleId, { manual = false } = {}) {
  const schedule = getScheduleById(scheduleId)
  if (!schedule) return { ok: false, error: 'Schedule not found' }
  if (schedule.isProcessing) return { ok: false, error: 'Already running' }
  const server = getServerByUuid(schedule.serverId)
  if (!server) return { ok: false, error: 'Server not found' }

  schedule.isProcessing = true
  schedule.lastRunAt = Date.now()
  schedule.lastStatus = 'running'
  schedule.lastError = null
  saveSchedule(schedule)
  emitScheduleUpdate(schedule)

  const steps = Array.isArray(schedule.steps) ? schedule.steps : []
  let failed = null
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.delay > 0) {
      await new Promise(r => setTimeout(r, Math.min(step.delay, 600000) * 1000))
    }
    try {
      await executeScheduleStep(schedule.serverId, step)
      sendServerLog(schedule.serverId, `[Schedule] "${schedule.name}" step ${i + 1}/${steps.length} OK`)
    } catch (err) {
      const cont = !!step.continueOnFailure
      sendServerLog(schedule.serverId, `[Schedule] "${schedule.name}" step ${i + 1} FAILED: ${err.message}`)
      if (!cont) {
        failed = err.message
        break
      }
    }
  }

  const fresh = getScheduleById(scheduleId) || schedule
  fresh.isProcessing = false
  fresh.lastStatus = failed ? 'failed' : 'success'
  fresh.lastError = failed
  fresh.nextRunAt = fresh.isActive ? nextCronRun(fresh.cron) : null
  saveSchedule(fresh)
  emitScheduleUpdate(fresh)
  if (manual) {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('schedule:ran', { id: fresh.id, ok: !failed, error: failed })
    }
  }
  return { ok: !failed, error: failed }
}

function emitScheduleUpdate(schedule) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('schedule:update', schedule)
  }
}

const _scheduleRunning = new Set()

function scheduleTick() {
  try {
    const now = Date.now()
    const list = listSchedules()
    for (const s of list) {
      if (!s.isActive || s.isProcessing) continue
      if (_scheduleRunning.has(s.id)) continue
      if (!s.nextRunAt) {
        s.nextRunAt = nextCronRun(s.cron)
        saveSchedule(s)
        continue
      }
      if (now >= s.nextRunAt) {
        // catch up: advance nextRun first to avoid double-fire
        s.nextRunAt = nextCronRun(s.cron, now)
        saveSchedule(s)
        _scheduleRunning.add(s.id)
        runScheduleNow(s.id)
          .catch(() => {})
          .finally(() => _scheduleRunning.delete(s.id))
      }
    }
  } catch (err) {
    console.error('[Schedule] tick error:', err.message)
  }
}

let _scheduleTimer = null
function startScheduler() {
  if (_scheduleTimer) return
  // seed nextRun for any active schedules missing it
  try {
    const list = listSchedules()
    let dirty = false
    for (const s of list) {
      if (s.isActive && !s.nextRunAt) {
        s.nextRunAt = nextCronRun(s.cron)
        dirty = true
      }
      if (!s.isActive) s.nextRunAt = null
    }
    if (dirty) writeSchedules(list)
  } catch {}
  _scheduleTimer = setInterval(scheduleTick, 30000)
  scheduleTick()
}

ipcMain.handle('schedule:list', (e, serverId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const schedules = listSchedules(serverId).map(s => ({
      ...s,
      humanCron: humanizeCron(s.cron),
    }))
    return { ok: true, schedules }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('schedule:create', (e, serverId, data) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const server = getServerByUuid(serverId)
    if (!server) return { ok: false, error: 'Server not found' }
    const cron = String(data?.cron || '').trim()
    if (!isValidCron(cron)) return { ok: false, error: 'Invalid cron' }
    const name = String(data?.name || '').trim() || 'Schedule'
    const steps = (Array.isArray(data?.steps) ? data.steps : [])
      .filter(s => s && (s.action === 'command' || s.action === 'power' || s.action === 'backup'))
      .map(s => ({
        id: generateUUID(),
        action: s.action,
        command: s.action === 'command' ? String(s.command || '') : undefined,
        power: s.action === 'power' ? String(s.power || 'start') : undefined,
        delay: Math.max(0, Math.min(600, Number(s.delay) || 0)),
        continueOnFailure: !!s.continueOnFailure,
      }))
    if (steps.length === 0) return { ok: false, error: 'At least one step required' }
    const isActive = data?.isActive !== false
    const schedule = {
      id: generateUUID(),
      serverId: server.id,
      name,
      cron,
      isActive,
      isProcessing: false,
      steps,
      lastRunAt: null,
      nextRunAt: isActive ? nextCronRun(cron) : null,
      lastStatus: null,
      lastError: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    saveSchedule(schedule)
    emitScheduleUpdate(schedule)
    return { ok: true, schedule: { ...schedule, humanCron: humanizeCron(cron) } }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('schedule:update', (e, scheduleId, data) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const schedule = getScheduleById(scheduleId)
    if (!schedule) return { ok: false, error: 'Schedule not found' }
    if (data?.name !== undefined) schedule.name = String(data.name).trim() || schedule.name
    if (data?.cron !== undefined) {
      const cron = String(data.cron).trim()
      if (!isValidCron(cron)) return { ok: false, error: 'Invalid cron' }
      schedule.cron = cron
      schedule.nextRunAt = schedule.isActive ? nextCronRun(cron) : null
    }
    if (data?.isActive !== undefined) {
      schedule.isActive = !!data.isActive
      schedule.nextRunAt = schedule.isActive ? nextCronRun(schedule.cron) : null
    }
    if (Array.isArray(data?.steps)) {
      const steps = data.steps
        .filter(s => s && (s.action === 'command' || s.action === 'power' || s.action === 'backup'))
        .map(s => ({
          id: s.id || generateUUID(),
          action: s.action,
          command: s.action === 'command' ? String(s.command || '') : undefined,
          power: s.action === 'power' ? String(s.power || 'start') : undefined,
          delay: Math.max(0, Math.min(600, Number(s.delay) || 0)),
          continueOnFailure: !!s.continueOnFailure,
        }))
      if (steps.length === 0) return { ok: false, error: 'At least one step required' }
      schedule.steps = steps
    }
    saveSchedule(schedule)
    emitScheduleUpdate(schedule)
    return { ok: true, schedule: { ...schedule, humanCron: humanizeCron(schedule.cron) } }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('schedule:delete', (e, scheduleId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const list = listSchedules().filter(s => s.id !== scheduleId)
    writeSchedules(list)
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('schedule:deleted', { id: scheduleId })
    }
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('schedule:toggle', (e, scheduleId, isActive) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const schedule = getScheduleById(scheduleId)
    if (!schedule) return { ok: false, error: 'Schedule not found' }
    schedule.isActive = isActive !== false
    schedule.nextRunAt = schedule.isActive ? nextCronRun(schedule.cron) : null
    saveSchedule(schedule)
    emitScheduleUpdate(schedule)
    return { ok: true, schedule: { ...schedule, humanCron: humanizeCron(schedule.cron) } }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('schedule:run', async (e, scheduleId) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    return await runScheduleNow(scheduleId, { manual: true })
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('schedule:preview', (e, cron) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const c = String(cron || '').trim()
    const valid = isValidCron(c)
    return {
      ok: true,
      valid,
      human: valid ? humanizeCron(c) : '',
      nextRunAt: valid ? nextCronRun(c) : null,
    }
  } catch (err) { return { ok: false, error: err.message } }
})

app.whenReady().then(() => {
  const { session } = require('electron')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' http://localhost:5173 blob: data:;" +
          "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: http://localhost:5173;" +
          "font-src 'self' data:;" +
          "img-src 'self' data: blob: https:;" +
          "connect-src 'self' blob: http://localhost:5173 ws://localhost:5173 https://mcjars.app https://versions.mcjars.app https://xyris.fr https://api.modrinth.com;" +
          "style-src 'self' 'unsafe-inline' blob:;"
        ],
      },
    })
  })

  createMainWindow()
  createTray()
  startWingsApiServer()
  startScheduler()

  // Auto-start services based on settings
  setTimeout(() => {
    try {
      const settings = readSettings()
      const autoStart = settings.autoStart || {}

      if (autoStart.docker) {
        sudoExec('systemctl start terver-docker 2>/dev/null || true')
      }
      if (autoStart.wings) {
        sudoExec('systemctl start lunarspace-wings 2>/dev/null || true')
      }
      if (autoStart.cloudflare) {
        sudoExec('systemctl start terver-cloudflare 2>/dev/null || true')
      }
      if (autoStart.database) {
        sudoExec('systemctl start postgresql 2>/dev/null || true')
      }
      if (autoStart.database) {
        sudoExec('systemctl start postgresql 2>/dev/null || true')
      }
    } catch {}
  }, 2000)

  // Sync all servers to Wings daemon after services are up
  setTimeout(async () => {
    try {
      const servers = listServerConfigs()
      console.log(`[App] Syncing ${servers.length} servers to Wings...`)
      for (const s of servers) {
        if (s.status === 'stopped' || s.status === 'running') {
          await syncServerToWings(s.id)
        }
      }
    } catch (err) {
      console.error('[App] Sync failed:', err.message)
    }
  }, 8000)
})

app.on('before-quit', () => {
  if (cloudflaredProcess) { try { cloudflaredProcess.kill('SIGTERM') } catch {} cloudflaredProcess = null }
  for (const id of Array.from(_wingsWs.keys())) closeWingsWs(id, { reconnect: false })
  stopWingsApiServer()
})

// ─── Wings Local API Proxy ──────────────────────────────────────────
function getWingsLocalToken() {
  try {
    const tokenStorePath = path.join(app.getPath('userData'), 'wings-api-token.json')
    if (fs.existsSync(tokenStorePath)) {
      return JSON.parse(fs.readFileSync(tokenStorePath, 'utf8'))
    }
  } catch {}
  return null
}

async function wingsApiCall(method, endpoint, body) {
  const tokenData = getWingsLocalToken()
  const token = tokenData?.token || ''
  const url = `http://127.0.0.1:8080${endpoint}`
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.pterodactyl.v1+json',
  }
  const opts = { method, headers, timeout: 15000 }
  if (body && method !== 'GET') opts.body = JSON.stringify(body)
  const resp = await fetch(url, opts)
  const text = await resp.text()
  if (resp.status === 404) throw new Error('server not found')
  if (!resp.ok) throw new Error(`Wings API ${resp.status}: ${text}`)
  try { return JSON.parse(text) } catch { return { raw: text } }
}

async function syncServerToWings(serverId) {
  try {
    console.log(`[Wings] Syncing server ${serverId} to Wings daemon...`)
    const result = await wingsApiCall('POST', '/api/servers', {
      uuid: serverId,
      start_on_completion: false,
      skip_scripts: false,
    })
    console.log(`[Wings] Server synced successfully:`, JSON.stringify(result))
    return true
  } catch (err) {
    console.error(`[Wings] Sync failed:`, err.message)
    return false
  }
}

ipcMain.handle('wings:server:state', async (e, uuid) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const data = await wingsApiCall('GET', `/api/servers/${uuid}`)
    return { ok: true, state: data?.state || data?.configuration?.state || 'stopped' }
  } catch { return { ok: false, state: 'offline' } }
})

ipcMain.handle('wings:server:power', async (e, uuid, action) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const eulaFixed = (action === 'start' || action === 'restart') ? ensureEula(uuid) : false
    const javaFixed = (action === 'start' || action === 'restart') ? ensureJava(uuid) : null
    const data = await wingsApiCall('POST', `/api/servers/${uuid}/power`, { action, wait_seconds: 0 })
    if (action === 'start' || action === 'restart') {
      updateServerConfig(uuid, { status: 'starting' })
      appendServerHistory(uuid, action === 'restart' ? 'restart' : 'start')
      beginLogSession(uuid)
      if (eulaFixed) sendServerLog(uuid, '[Daemon] Ensured eula=true in eula.txt')
      if (javaFixed) sendServerLog(uuid, `[Daemon] Switched Docker image ${javaFixed.from} → ${javaFixed.to} (needs Java ${javaFixed.need})`)
      sendServerLog(uuid, `[Daemon] ${action === 'restart' ? 'Restarting' : 'Starting'} server...`)
      startLogStream(uuid, { boot: true, baseline: true })
      ensureWingsWs(uuid)
    } else if (action === 'stop') {
      updateServerConfig(uuid, { status: 'stopping' })
      appendServerHistory(uuid, 'stop')
      stopTpsPoller(uuid)
      clearServerTps(uuid)
      sendServerLog(uuid, '[Daemon] Stopping server...')
      stopLogStream(uuid)
      startLogStream(uuid, { baseline: true })
      ensureWingsWs(uuid)
      scheduleStopCleanup(uuid, 15000)
    } else if (action === 'kill') {
      updateServerConfig(uuid, { status: 'stopped' })
      appendServerHistory(uuid, 'kill')
      stopTpsPoller(uuid)
      clearServerTps(uuid)
      sendServerLog(uuid, '[Daemon] Killed server')
      stopLogStream(uuid)
      cancelStopCleanup(uuid)
      closeWingsWs(uuid, { reconnect: false })
    }
    return { ok: true, data }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:server:command', async (e, uuid, command) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const data = await wingsApiCall('POST', `/api/servers/${uuid}/commands`, { commands: [command] })
    return { ok: true, data }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:server:logs', async (e, uuid, lines) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const tokenData = getWingsLocalToken()
    const token = tokenData?.token || ''
    const n = Number(lines) > 0 ? Number(lines) : 500
    const resp = await fetch(`http://127.0.0.1:8080/api/servers/${uuid}/logs?lines=${n}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/plain, application/json',
      },
      timeout: 10000,
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      if (resp.status === 404) return { ok: false, logs: '', error: 'server not found' }
      return { ok: false, logs: '', error: errText || `HTTP ${resp.status}` }
    }
    const text = await resp.text()
    let logs = text
    try {
      const json = JSON.parse(text)
      if (typeof json === 'string') logs = json
      else if (json && typeof json.logs === 'string') logs = json.logs
      else if (json && typeof json.data === 'string') logs = json.data
      else if (json && Array.isArray(json.lines)) logs = json.lines.join('\n')
      else if (json && Array.isArray(json.data)) logs = json.data.join('\n')
      else if (text && text !== '{}' && text !== 'null') logs = text
    } catch {}
    return { ok: true, logs: logs || '' }
  } catch (err) {
    return { ok: false, logs: '', error: err.message }
  }
})

ipcMain.handle('wings:server:files', async (e, uuid, dirPath) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const tokenData = getWingsLocalToken()
    const token = tokenData?.token || ''
    const dir = dirPath || '.'
    const url = `http://127.0.0.1:8080/api/servers/${uuid}/files/list?directory=${encodeURIComponent(dir)}&per_page=500&page=1`
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      timeout: 15000,
    })
    if (resp.ok) {
      const data = await resp.json().catch(() => null)
      const entries = data?.entries || data?.data || (Array.isArray(data) ? data : [])
      if (Array.isArray(entries) && entries.length > 0) {
        const entryIsDir = (en) => {
          if (en.directory === true || en.is_dir === true || en.is_directory === true) return true
          if (en.file === true) return false
          if (en.mime === 'inode/directory') return true
          const t = String(en.type || '').toLowerCase()
          if (t === 'dir' || t === 'directory' || t === 'folder') return true
          if (String(en.mode || '').startsWith('d')) return true
          return false
        }
        const files = entries.map(en => ({
          name: en.name || en.basename || String(en.path || '').split('/').pop(),
          is_dir: entryIsDir(en),
          size: en.size ?? en.physical_size ?? en.size_physical ?? 0,
          modified: en.modified || en.mtime || en.created || new Date().toISOString(),
        })).sort((a, b) => (b.is_dir - a.is_dir) || String(a.name).localeCompare(String(b.name)))
        return { ok: true, files }
      }
      if (data && data.error && !data.entries) {
        // path not found etc. — still try local fallback below
      }
    }
  } catch {}
  const serverDir = path.join(WINGS_DATA_DIR, uuid)
  const targetDir = path.join(serverDir, dirPath || '/')
  try {
    if (!fs.existsSync(targetDir)) return { ok: true, files: [] }
    if (!fs.statSync(targetDir).isDirectory()) return { ok: false, error: 'Not a directory', files: [] }
    const entries = fs.readdirSync(targetDir, { withFileTypes: true })
    const files = entries.map(e => ({
      name: e.name,
      is_dir: e.isDirectory(),
      size: e.isFile() ? (fs.statSync(path.join(targetDir, e.name)).size || 0) : 0,
      modified: fs.statSync(path.join(targetDir, e.name)).mtime.toISOString(),
    })).sort((a, b) => (b.is_dir - a.is_dir) || a.name.localeCompare(b.name))
    return { ok: true, files }
  } catch (err) { return { ok: true, files: [], error: err.message } }
})

ipcMain.handle('wings:server:readFile', async (e, uuid, filePath) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const fullPath = path.join(WINGS_DATA_DIR, uuid, filePath)
  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      return { ok: false, is_dir: true, content: '', error: 'EISDIR: directory' }
    }
  } catch {}
  try {
    const tokenData = getWingsLocalToken()
    const token = tokenData?.token || ''
    const url = `http://127.0.0.1:8080/api/servers/${uuid}/files/contents?file=${encodeURIComponent(filePath)}&download=false`
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/plain, application/json, */*',
      },
      timeout: 15000,
    })
    if (resp.ok) {
      const text = await resp.text()
      if (text) {
        try {
          const json = JSON.parse(text)
          if (typeof json === 'string') return { ok: true, content: json }
          if (json && typeof json.content === 'string') return { ok: true, content: json.content }
          if (json && typeof json.data === 'string') return { ok: true, content: json.data }
          if (json && (json.directory === true || json.is_dir === true)) {
            return { ok: false, is_dir: true, content: '', error: 'EISDIR: directory' }
          }
        } catch {
          return { ok: true, content: text }
        }
        return { ok: true, content: text }
      }
    } else {
      const errText = await resp.text().catch(() => '')
      if (resp.status === 404 || /not found|directory|EISDIR/i.test(errText)) {
        try {
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            return { ok: false, is_dir: true, content: '', error: 'EISDIR: directory' }
          }
        } catch {}
        return { ok: false, content: '', error: errText || `HTTP ${resp.status}` }
      }
    }
  } catch {}
  try {
    const content = fs.readFileSync(fullPath, 'utf-8')
    return { ok: true, content }
  } catch (err) {
    if (err && err.code === 'EISDIR') return { ok: false, is_dir: true, content: '', error: 'EISDIR: directory' }
    return { ok: false, content: '', error: err.message }
  }
})

ipcMain.handle('wings:server:writeFile', async (e, uuid, filePath, content) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const tokenData = getWingsLocalToken()
    const token = tokenData?.token || ''
    const user = '00000000-0000-0000-0000-000000000001'
    const url = `http://127.0.0.1:8080/api/servers/${uuid}/files/write?file=${encodeURIComponent(filePath)}&user=${user}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/json',
      },
      body: typeof content === 'string' ? content : String(content ?? ''),
      timeout: 15000,
    })
    if (resp.ok) return { ok: true }
    const errText = await resp.text().catch(() => '')
    if (resp.status !== 404) return { ok: false, error: errText || `HTTP ${resp.status}` }
  } catch (err) {
    // fall through to local write
  }
  const fullPath = path.join(WINGS_DATA_DIR, uuid, filePath)
  try {
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:server:deleteFile', async (e, uuid, filePath) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const data = await wingsApiCall('DELETE', `/api/servers/${uuid}/files/delete?files[]=${encodeURIComponent(filePath)}`)
    return { ok: true, data }
  } catch {}
  const fullPath = path.join(WINGS_DATA_DIR, uuid, filePath)
  try {
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) fs.rmSync(fullPath, { recursive: true })
    else fs.unlinkSync(fullPath)
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

function localJoinPath(dir, name) {
  const base = (dir || '/').replace(/\/+$/, '') || ''
  return `${base}/${name}`.replace(/\/+/g, '/')
}

ipcMain.handle('wings:server:createFile', async (e, uuid, dirPath, fileName) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const name = String(fileName || '').trim()
  if (!name || name.includes('/') || name.includes('\\')) return { ok: false, error: 'Invalid name' }
  const rel = localJoinPath(dirPath || '/', name)
  try {
    const tokenData = getWingsLocalToken()
    const token = tokenData?.token || ''
    const user = '00000000-0000-0000-0000-000000000001'
    const url = `http://127.0.0.1:8080/api/servers/${uuid}/files/write?file=${encodeURIComponent(rel)}&user=${user}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: '',
      timeout: 10000,
    })
    if (resp.ok) return { ok: true, path: rel }
  } catch {}
  try {
    const fullPath = path.join(WINGS_DATA_DIR, uuid, rel)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, '', 'utf-8')
    return { ok: true, path: rel }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:server:createFolder', async (e, uuid, dirPath, folderName) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const name = String(folderName || '').trim()
  if (!name || name.includes('/') || name.includes('\\')) return { ok: false, error: 'Invalid name' }
  const rel = localJoinPath(dirPath || '/', name)
  try {
    const tokenData = getWingsLocalToken()
    const token = tokenData?.token || ''
    const user = '00000000-0000-0000-0000-000000000001'
    const url = `http://127.0.0.1:8080/api/servers/${uuid}/files/create-folder?file=${encodeURIComponent(rel)}&user=${user}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      timeout: 10000,
    })
    if (resp.ok) return { ok: true, path: rel }
  } catch {}
  try {
    const fullPath = path.join(WINGS_DATA_DIR, uuid, rel)
    fs.mkdirSync(fullPath, { recursive: true })
    return { ok: true, path: rel }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:server:sync', async (e, uuid, config) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const data = await wingsApiCall('POST', `/api/servers/${uuid}/sync`, config)
    return { ok: true, data }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:server:reinstall', async (e, uuid) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const data = await wingsApiCall('POST', `/api/servers/${uuid}/reinstall`)
    return { ok: true, data }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:server:delete', async (e, uuid) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    removeServerConfig(uuid)
    const serverDir = path.join(WINGS_DATA_DIR, uuid)
    if (fs.existsSync(serverDir)) {
      fs.rmSync(serverDir, { recursive: true, force: true })
    }
    try { await wingsApiCall('DELETE', `/api/servers/${uuid}`) } catch {}
    restartWings()
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:server:create', async (e, uuid) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const data = await wingsApiCall('POST', '/api/servers', { uuid, start_on_completion: false, skip_scripts: false })
    return { ok: true, data }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('wings:servers:list', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const data = await wingsApiCall('GET', '/api/servers')
    return { ok: true, servers: data?.data || data || [] }
  } catch { return { ok: true, servers: [] } }
})

app.on('window-all-closed', () => {})
