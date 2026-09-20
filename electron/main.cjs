// TerverPanel - Electron Main Process
// Gaming Hosting Launcher for Minecraft

const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const os = require('os')

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

ipcMain.handle('server:addConfig', (e, serverConfig) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const server = { id: generateUUID(), ...serverConfig, createdAt: new Date().toISOString() }
  addServerConfig(server)
  return { ok: true, server }
})

ipcMain.handle('server:removeConfig', (e, id) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  removeServerConfig(id)
  return { ok: true }
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
    }
  }
  try {
    const result = execSync(`pkexec sh -c '${command.replace(/'/g, "'\\''")}' 2>&1`, { timeout, encoding: 'utf8' })
    return { ok: true, output: result }
  } catch (err) {
    return { ok: false, error: err.message }
  }
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
    sudoExec(`mkdir -p ${binDir} ${dataDir} ${configDir} ${logDir}`)

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

    sendProgress('docker', 50, 'Giải nén Docker binaries...')
    sudoExec(`tar -xzf ${tmpFile} -C /tmp/`)
    const bins = ['docker', 'dockerd', 'containerd', 'ctr', 'runc']
    let copied = 0
    for (const b of bins) {
      try { sudoExec(`cp /tmp/docker/${b} ${binDir}/${b} && chmod +x ${binDir}/${b}`); copied++ } catch {}
    }
    try { sudoExec(`cp /tmp/docker/docker-proxy ${binDir}/docker-proxy && chmod +x ${binDir}/docker-proxy`); copied++ } catch {}
    sudoExec(`rm -rf /tmp/docker ${tmpFile}`)
    sendProgress('docker', 62, `Đã copy ${copied} binaries vào ${binDir}`)

    sendProgress('docker', 65, 'Tạo daemon.json...')
    const daemonConfig = {
      'data-root': dataDir,
      'storage-driver': 'overlay2',
      'userland-proxy': false,
      'log-driver': 'json-file',
      'log-opts': { 'max-size': '10m', 'max-file': '3' },
    }
    sudoExec(`cat > ${configDir}/daemon.json << 'DEOF'\n${JSON.stringify(daemonConfig, null, 2)}\nDEOF`)

    sendProgress('docker', 72, 'Đang tạo containerd service...')
    const containerdService = `[Unit]
Description=Containerd (Terver Panel)
After=network.target

[Service]
Type=simple
ExecStart=${binDir}/containerd
Restart=on-failure
RestartSec=5
LimitNOFILE=infinity

[Install]
WantedBy=multi-user.target
`
    sudoExec(`cat > /etc/systemd/system/terver-containerd.service << 'SEOF'\n${containerdService}\nSEOF`)

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
    sudoExec(`cat > /etc/systemd/system/terver-docker.service << 'SEOF'\n${serviceContent}\nSEOF`)
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
      try { fs2.accessSync(binPath, fs2.constants.F_OK | fs2.constants.X_OK); installed = true } catch {}
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
      const raw = sudoExec(`cat ${wingsConfigPath}/config.yml 2>/dev/null`).output || ''
      const tokenMatch = raw.match(/token:\s*(.+)/)
      const uuidMatch = raw.match(/uuid:\s*(.+)/)
      configs.wings = { token: tokenMatch?.[1]?.trim() || '', uuid: uuidMatch?.[1]?.trim() || '' }
    } catch { configs.wings = { token: '', uuid: '' } }
  } else { configs.wings = { token: '', uuid: '' } }
  // Cloudflare config — from custom path
  if (cfDir) {
    try {
      const raw = sudoExec(`cat ${cfDir}/config.yml 2>/dev/null`).output || ''
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

    sendProgress('wings', 2, 'Dừng Wings service...')
    try { sudoExec('systemctl stop lunarspace-wings 2>/dev/null || true') } catch {}
    try { sudoExec('systemctl disable lunarspace-wings 2>/dev/null || true') } catch {}

    if (fs2.existsSync(binaryPath)) {
      sendProgress('wings', 3, 'Xóa binary cũ...')
      try { sudoExec(`rm -f ${binaryPath}`) } catch {}
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
      let installRes = ''
      try {
        sudoExec(`mkdir -p ${wingsDir}/bin`)
        sudoExec(`cp -p ${tmpPath} ${binaryPath} && chmod +x ${binaryPath}`)
      } catch (copyErr) {
        throw new Error('Không thể cài binary Wings')
      }
      fs2.unlinkSync(tmpPath)

      sendProgress('wings', 80, 'Đang tạo thư mục cấu hình...')
      sudoExec(`mkdir -p ${wingsConfigDir}`)

      sendProgress('wings', 82, 'Đang kiểm tra phiên bản Wings...')
      const versionOut = execSync(`${binaryPath} --version 2>&1 || true`, { timeout: 5000, encoding: 'utf8' })
      const versionMatch = versionOut.match(/(\d+\.\d+\.\d+)/)

      const initSystem = fs2.existsSync('/run/systemd/system') ? 'systemd' : 'openrc'
      sendProgress('wings', 85, `Phát hiện init system: ${initSystem} — đang tạo service file...`)
      let serviceContent
      if (initSystem === 'systemd') {
        serviceContent = `[Unit]
Description=LunarSpace Wings Daemon
After=network.target docker.service docker.socket
Wants=docker.socket

[Service]
User=root
KillMode=process
LimitNOFILE=4096
PIDFile=/run/lunarspace-wings/daemon.pid
ExecStartPre=/bin/bash -c 'for i in $(seq 1 15); do [ -S /run/docker.sock ] && exit 0; sleep 1; done; echo "Docker socket not ready"; exit 1'
ExecStart=${binaryPath} --config ${configPath}
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
`
        sudoExec(`cat > /etc/systemd/system/lunarspace-wings.service << 'SERVICEEOF'\n${serviceContent}\nSERVICEEOF`)
        sendProgress('wings', 92, 'Đang reload daemon + enable service...')
        sudoExec('systemctl daemon-reload')
      } else {
        serviceContent = `#!/sbin/openrc-run
description="LunarSpace Wings Daemon"
command="${binaryPath}"
supervisor="supervise-daemon"
pidfile="/run/lunarspace-wings.pid"
rc_ulimit="-n 4096"
respawn_delay=5
respawn_max=30
respawn_period=180
depend() {
    need net docker
}
`
        sudoExec(`cat > /etc/init.d/lunarspace-wings << 'SERVICEEOF'\n${serviceContent}\nSERVICEEOF`)
        sudoExec('chmod +x /etc/init.d/lunarspace-wings')
      }

      sendProgress('wings', 100, `Cài thành công Wings ${versionMatch ? versionMatch[1] : 'unknown'} (${arch})`)
      resolve({ ok: true, version: versionMatch ? versionMatch[1] : 'unknown', arch, initSystem })
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
  const fs2 = require('fs')
  try {
    if (fs2.existsSync('/run/systemd/system')) {
      sudoExec('systemctl start lunarspace-wings')
    } else {
      sudoExec('rc-service lunarspace-wings start')
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('wings:stop', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const fs2 = require('fs')
  try {
    if (fs2.existsSync('/run/systemd/system')) {
      sudoExec('systemctl stop lunarspace-wings')
    } else {
      sudoExec('rc-service lunarspace-wings stop')
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('systemd:status', async (e, serviceName) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
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
  const { execSync } = require('child_process')
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
  const { execSync } = require('child_process')
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
    const { execSync } = require('child_process')
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
    const { execSync } = require('child_process')
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
    const { execSync } = require('child_process')
    let svc = 'cloudflared'
    try { execSync('systemctl list-unit-files terver-cloudflare.service 2>/dev/null | grep terver-cloudflare', { encoding: 'utf8' }); svc = 'terver-cloudflare' } catch {}
    sudoExec(`systemctl start ${svc}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflared:stop', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const { execSync } = require('child_process')
    let svc = 'cloudflared'
    try { execSync('systemctl list-unit-files terver-cloudflare.service 2>/dev/null | grep terver-cloudflare', { encoding: 'utf8' }); svc = 'terver-cloudflare' } catch {}
    sudoExec(`systemctl stop ${svc}`)
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

    // Helper: read servers from DB
    function getServers() {
      try {
        const db = readDB()
        return Object.values(db.servers || {}).map(s => ({
          settings: {
            uuid: s.uuid || s.id,
            start_on_completion: false,
            meta: { name: s.name, description: s.name },
            suspended: false,
            invocation: s.startup || 'java -Xms512M -Xmx1G -jar server.jar nogui',
            skip_egg_scripts: false,
            entrypoint: null,
            environment: {},
            labels: {},
            backups: [],
            schedules: [],
            allocations: {
              force_outgoing_ip: false,
              default: { ip: '0.0.0.0', port: s.port || 25565 },
              mappings: {}
            },
            build: {
              memory_limit: s.ram || 1024,
              overhead_memory: 0,
              swap: 0,
              io_weight: null,
              cpu_limit: s.cpu || 100,
              disk_space: s.disk || 10240,
              threads: null,
              oom_disabled: false
            },
            mounts: [],
            firewall: [],
            egg: { id: '00000000-0000-0000-0000-000000000001', file_denylist: [] },
            container: {
              image: s.image || 'itzg/minecraft-server',
              timezone: null,
              hugepages_passthrough_enabled: false,
              kvm_passthrough_enabled: false,
              seccomp: { remove_allowed: [] }
            },
            auto_kill: { enabled: false, seconds: 0 },
            auto_start_behavior: 'always',
            features: { startup_cpu_boost: null, runtime_cpu_boost: null }
          },
          process_configuration: {
            startup: { done: null, strip_ansi: false },
            stop: { type: 'tag', value: null },
            configs: []
          }
        }))
      } catch { return [] }
    }

    function getServer(uuid) {
      return getServers().find(s => s.uuid === uuid) || null
    }

    // ─── Endpoints ───────────────────────────────────────────────────
    // List servers
    apiApp.get('/api/remote/servers', (req, res) => {
      const page = parseInt(req.query.page) || 1
      const perPage = parseInt(req.query.per_page) || 50
      const allServers = getServers()
      const start = (page - 1) * perPage
      const servers = allServers.slice(start, start + perPage)
      res.json({ data: servers, meta: { current_page: page, per_page: perPage, total: allServers.length } })
    })

    // Get single server
    apiApp.get('/api/remote/servers/:uuid', (req, res) => {
      const server = getServer(req.params.uuid)
      if (!server) return res.status(404).json({ error: 'Server not found' })
      res.json({ data: server })
    })

    // Get install script
    apiApp.get('/api/remote/servers/:uuid/install', (req, res) => {
      const server = getServer(req.params.uuid)
      if (!server) return res.status(404).json({ error: 'Server not found' })
      res.json({ command: '', done: true })
    })

    // Report install status
    apiApp.post('/api/remote/servers/:uuid/install', (req, res) => {
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

    // Schedule
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
    sudoExec(`mkdir -p ${configDir}`)
    const config = {
      uuid: require('crypto').randomUUID(),
      token_id: wingsApiTokenId || '1',
      token: wingsApiToken || crypto.randomBytes(32).toString('hex'),
      remote: `http://127.0.0.1:6543`,
      api: { host: '0.0.0.0', port: 8080, ssl: { enabled: false } },
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
      docker: { network: { interface: 'wings0', name: 'lunarspace-net', subnet: '172.18.0.0/16' } },
    }
    sudoExec(`cat > ${configPath} << 'YAMLEOF'\n${yaml.dump(config)}\nYAMLEOF`)
    sudoExec(`chmod 600 ${configPath}`)
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
      sudoExec(`mkdir -p ${binDir}`)
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
          if (copyErr.code === 'EACCES' || copyErr.code === 'EPERM') {
            const cpResult = sudoExec(`cp -p ${tmpPath} ${binaryPath} && chmod +x ${binaryPath}`)
            if (!cpResult.ok) {
              fs2.unlink(tmpPath, () => {})
              sendProgress('cloudflare', 0, `Lỗi quyền: ${cpResult.error}`)
              resolve({ ok: false, error: 'Cần quyền sudo để cài cloudflared' + '\n' + (cpResult.error || '') })
              return
            }
          } else {
            fs2.unlink(tmpPath, () => {})
            sendProgress('cloudflare', 0, `Lỗi: ${copyErr.message}`)
            resolve({ ok: false, error: copyErr.message })
            return
          }
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
      const result = sudoExec(`bash -c '${cmd.replace(/'/g, "'\\''")}' 2>&1`)
      return { ok: true, output: result.output || '' }
    } catch (err) {
      return { ok: false, error: err.message, output: '' }
    }
  }

  try {
    const binPath = cfDir ? `${cfDir}/bin/cloudflared` : 'cloudflared'
    try { execSync(`test -x ${binPath}`, { stdio: 'ignore' }) } catch {
      return { ok: false, error: 'cloudflared chưa được cài đặt. Hãy cài trước.' }
    }

    const credDir = cfDir ? `${cfDir}/credentials` : '/root/.cloudflared'
    if (cfDir) sudoExec(`mkdir -p ${credDir}`)
    const certPath = `${credDir}/cert.pem`

    let hasCert = false
    try {
      const checkResult = await sudoRun(`test -f ${certPath} && echo "EXISTS"`)
      hasCert = checkResult.ok && checkResult.output && checkResult.output.includes('EXISTS')
    } catch {}

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
    await sudoRun(`cat > ${credDir}/config.yml << 'CFEOF'\n${configContent}\nCFEOF`)

    await sudoRun(`nohup ${binPath} tunnel --config ${credDir}/config.yml run ${tunnelName} > /dev/null 2>&1 &`)

    return { ok: true, tunnelId: id, message: `Tunnel "${tunnelName}" đã tạo${appDomain ? `, route: ${appDomain}` : ''}` }
  } catch (err) {
    return { ok: false, error: `Lỗi: ${err.message}` }
  }
})

ipcMain.handle('cloudflare:tunnel:install-service', async (e, token) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    sudoExec(`cloudflared service install ${token || ''}`)
    sudoExec('systemctl daemon-reload')
    sudoExec('systemctl enable --now cloudflared')
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
          sudoExec(`mkdir -p ${cfDir} && cp ${loc} ${cfDir}/cert.pem && chmod 644 ${cfDir}/cert.pem`)
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

  // Auto-start services based on settings
  setTimeout(() => {
    try {
      const settings = readSettings()
      const autoStart = settings.autoStart || {}
      const paths = settings.paths || {}

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
    } catch {}
  }, 2000)
})

app.on('window-all-closed', () => {})
