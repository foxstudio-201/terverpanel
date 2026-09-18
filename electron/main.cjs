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
  return safe
}

function readSettings() {
  const db = readDB()
  return sanitizeSettings(db.settings || {})
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
  try {
    const version = execSync('docker --version', { timeout: 5000, encoding: 'utf8' }).trim()
    let composeVersion = ''
    try {
      composeVersion = execSync('docker compose version', { timeout: 5000, encoding: 'utf8' }).trim()
    } catch {
      try {
        composeVersion = execSync('docker-compose --version', { timeout: 5000, encoding: 'utf8' }).trim()
      } catch {}
    }
    let running = false
    try {
      const info = execSync('docker info --format "{{.ServerVersion}}" 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
      running = !!info
    } catch {}
    let containers = 0
    try {
      containers = parseInt(execSync('docker ps -q 2>/dev/null | wc -l', { timeout: 5000, encoding: 'utf8' }).trim()) || 0
    } catch {}
    return { ok: true, installed: true, running, version, composeVersion, containers }
  } catch {
    return { ok: true, installed: false, running: false, version: '', composeVersion: '', containers: 0 }
  }
})

ipcMain.handle('docker:install', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const platform = os.platform()
  try {
    if (platform === 'linux') {
      const distro = execSync('cat /etc/os-release 2>/dev/null || true', { timeout: 5000, encoding: 'utf8' })
      if (distro.includes('Alpine')) {
        execSync('apk add docker docker-cli-compose', { timeout: 120000 })
        execSync('rc-update add docker', { timeout: 10000 })
        execSync('rc-service docker start', { timeout: 10000 })
      } else if (distro.includes('Arch') || distro.includes('Manjaro')) {
        execSync('pacman -S --noconfirm docker docker-compose', { timeout: 120000 })
        execSync('systemctl enable --now docker', { timeout: 10000 })
      } else {
        execSync('curl -sSL https://get.docker.com/ | CHANNEL=stable bash', { timeout: 300000, shell: '/bin/bash' })
      }
    } else {
      return { ok: false, error: `Unsupported platform: ${platform}. Please install Docker Desktop manually.` }
    }
    const version = execSync('docker --version', { timeout: 5000, encoding: 'utf8' }).trim()
    return { ok: true, version }
  } catch (err) {
    return { ok: false, error: err.message || 'Installation failed' }
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
    const out = execSync('docker info --format "{{.ServerVersion}}" 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
    const containers = execSync('docker ps -q 2>/dev/null | wc -l', { timeout: 5000, encoding: 'utf8' }).trim()
    return { ok: true, running: true, version: out, containers: parseInt(containers) || 0 }
  } catch {
    return { ok: true, running: false, version: '', containers: 0 }
  }
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
    const archMap = { x86_64: 'x86_64', aarch64: 'aarch64', armv7l: 'armv7l', ppc64le: 'ppc64le', riscv64: 'riscv64' }
    let arch = 'x86_64'
    try { arch = archMap[execSync('uname -m', { encoding: 'utf8' }).trim()] || 'x86_64' } catch {}
    const binaryPath = '/usr/local/bin/wings'
    const configPath = '/etc/lunarspace-wings/config.yml'
    let installed = false
    try { fs2.accessSync(binaryPath, fs2.constants.F_OK | fs2.constants.X_OK); installed = true } catch {}
    let running = false, version = ''
    if (installed) {
      try {
        const out = execSync(`${binaryPath} --version 2>&1 || true`, { timeout: 5000, encoding: 'utf8' })
        const match = out.match(/(\d+\.\d+\.\d+)/)
        if (match) version = match[1]
      } catch {}
    }
    let hasConfig = false
    try { hasConfig = fs2.existsSync(configPath) } catch {}
    const serviceFile = '/etc/systemd/system/lunarspace-wings.service'
    let hasService = false
    try { hasService = fs2.existsSync(serviceFile) } catch {}
    if (!hasService) {
      try { hasService = fs2.existsSync('/etc/init.d/lunarspace-wings') } catch {}
    }
    if (hasService) {
      try {
        const status = execSync('systemctl is-active lunarspace-wings 2>/dev/null || rc-service lunarspace-wings status 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
        running = status === 'active' || status === 'started'
      } catch {}
    }
    return { ok: true, installed, running, version, arch, hasConfig, hasService, binaryPath, configPath }
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
    const archMap = { x86_64: 'x86_64', aarch64: 'aarch64', armv7l: 'armv7l', ppc64le: 'ppc64le', riscv64: 'riscv64' }
    let arch = 'x86_64'
    try { arch = archMap[execSync('uname -m', { encoding: 'utf8' }).trim()] || 'x86_64' } catch {}
    const binaryPath = '/usr/local/bin/wings'
    const configDir = '/etc/lunarspace-wings'
    const configPath = `${configDir}/config.yml`

  return new Promise(async (resolve) => {
    try {
      const tagRes = await fetch('https://api.github.com/repos/foxstudio-201/LunarSpaceWingLunar/releases/latest')
      const tagData = await tagRes.json()
      const tagName = tagData.tag_name
      const assetName = `wings-rs-${arch}-linux`
      const downloadUrl = `https://github.com/foxstudio-201/LunarSpaceWingLunar/releases/download/${tagName}/${assetName}`

      const tmpDir = '/tmp/terver-wings-install'
      if (!fs2.existsSync(tmpDir)) fs2.mkdirSync(tmpDir, { recursive: true })
      const tmpPath = `${tmpDir}/wings-rs-${arch}-linux`

      const downloadFile = (url, dest) => new Promise((res, rej) => {
        const req = https.get(url, { headers: { 'User-Agent': 'TerverPanel' } }, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            res(downloadFile(response.headers.location, dest))
            return
          }
          if (response.statusCode !== 200) {
            response.destroy()
            rej(new Error(`HTTP ${response.statusCode}`))
            return
          }
          const file = fs2.createWriteStream(dest)
          file.on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
          response.pipe(file)
          file.on('finish', () => { file.close(); res() })
          file.on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        }).on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        req.setTimeout(60000, () => { req.destroy(); rej(new Error('Download timeout')) })
      })

      await downloadFile(downloadUrl, tmpPath)
      execSync(`chmod +x ${tmpPath}`)

      let installRes = ''
      try {
        fs2.copyFileSync(tmpPath, binaryPath)
        execSync(`chmod +x ${binaryPath}`)
      } catch (copyErr) {
        if (copyErr.code === 'EACCES' || copyErr.code === 'EPERM') {
          const cpResult = sudoExec(`cp -p ${tmpPath} ${binaryPath} && chmod +x ${binaryPath}`)
          if (!cpResult.ok) throw new Error('Permission denied. Need sudo to write to /usr/local/bin/')
        } else {
          throw copyErr
        }
      }
      fs2.unlinkSync(tmpPath)

      if (!fs2.existsSync(configDir)) {
        const mkdirResult = sudoExec(`mkdir -p ${configDir}`)
        if (!mkdirResult.ok) { /* ignore */ }
      }

      const versionOut = execSync(`${binaryPath} --version 2>&1 || true`, { timeout: 5000, encoding: 'utf8' })
      const versionMatch = versionOut.match(/(\d+\.\d+\.\d+)/)

      const initSystem = fs2.existsSync('/run/systemd/system') ? 'systemd' : 'openrc'
      let serviceContent
      if (initSystem === 'systemd') {
        serviceContent = `[Unit]
Description=LunarSpace Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
KillMode=process
LimitNOFILE=4096
PIDFile=/run/lunarspace-wings/daemon.pid
ExecStart=${binaryPath}
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
`
        sudoExec(`cat > /etc/systemd/system/lunarspace-wings.service << 'SERVICEEOF'\n${serviceContent}\nSERVICEEOF`)
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

      resolve({ ok: true, version: versionMatch ? versionMatch[1] : 'unknown', arch, initSystem })
    } catch (err) {
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

ipcMain.handle('wings:config:generate', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const fs2 = require('fs')
  const yaml = require('js-yaml')
  const configDir = '/etc/lunarspace-wings'
  const configPath = `${configDir}/config.yml`
  try {
    const mkdirResult = sudoExec(`mkdir -p ${configDir}`)
    const config = {
      uuid: require('crypto').randomUUID(),
      token_id: '1',
      token: require('crypto').randomBytes(16).toString('hex'),
      api: { host: '0.0.0.0', port: 8080, ssl: { enabled: false } },
      system: {
        data: '/var/lib/lunarspace-wings/servers',
        log_dir: '/var/log/lunarspace-wings',
        tmp_dir: '/tmp/lunarspace-wings',
        backup: { storage: '/var/lib/lunarspace-wings/backups' },
      },
      allowed_mounts: ['/home', '/var/lib/lunarspace-wings/servers'],
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
  try {
    const out = execSync('cloudflared --version 2>/dev/null', { timeout: 5000, encoding: 'utf8' }).trim()
    return { ok: true, installed: true, version: out }
  } catch {
    return { ok: true, installed: false, version: '' }
  }
})

ipcMain.handle('cloudflare:install', async (e, arch) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const { execSync } = require('child_process')
  const fs2 = require('fs')
  const https = require('https')
  const os = require('os')
  const binaryPath = '/usr/local/bin/cloudflared'
  const tmpPath = path.join(os.tmpdir(), 'terver-cloudflared')
  return new Promise((resolve) => {
    try {
      const archMap = { x86_64: 'amd64', aarch64: 'arm64', armv7l: 'arm', ppc64le: 'ppc64le' }
      const realArch = archMap[arch] || 'amd64'
      const downloadUrl = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${realArch}`

      const downloadFile = (url, dest) => new Promise((res, rej) => {
        const file = fs2.createWriteStream(dest)
        file.on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        https.get(url, { headers: { 'User-Agent': 'TerverPanel' } }, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            downloadFile(response.headers.location, dest).then(res, rej)
            return
          }
          if (response.statusCode !== 200) {
            file.close()
            response.destroy()
            rej(new Error(`HTTP ${response.statusCode}`))
            return
          }
          response.pipe(file)
          file.on('finish', () => { file.close(); res() })
          file.on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
        }).on('error', (err) => { fs2.unlink(dest, () => {}); rej(err) })
      })

      downloadFile(downloadUrl, tmpPath).then(() => {
        try {
          fs2.chmodSync(tmpPath, 0o755)
        } catch (_) {}
        try {
          fs2.copyFileSync(tmpPath, binaryPath)
          fs2.chmodSync(binaryPath, 0o755)
        } catch (copyErr) {
          if (copyErr.code === 'EACCES' || copyErr.code === 'EPERM') {
            const cpResult = sudoExec(`cp -p ${tmpPath} ${binaryPath} && chmod +x ${binaryPath}`)
            if (!cpResult.ok) {
              fs2.unlink(tmpPath, () => {})
              resolve({ ok: false, error: (lang === 'vi' ? 'Cần quyền sudo để cài đặt cloudflared' : 'Need sudo to install cloudflared') + '\n' + (cpResult.error || '') })
              return
            }
          } else {
            fs2.unlink(tmpPath, () => {})
            resolve({ ok: false, error: copyErr.message })
            return
          }
        }
        fs2.unlink(tmpPath, () => {})
        try {
          const out = execSync(`${binaryPath} --version 2>&1`, { timeout: 5000, encoding: 'utf8' }).trim()
          resolve({ ok: true, version: out })
        } catch (verErr) {
          resolve({ ok: false, error: (lang === 'vi' ? 'Cài đặt xong nhưng không thể xác minh phiên bản: ' : 'Installed but could not verify version: ') + verErr.message })
        }
      }).catch((err) => {
        resolve({ ok: false, error: err.message })
      })
    } catch (err) {
      resolve({ ok: false, error: err.message })
    }
  })
})

ipcMain.handle('cloudflare:tunnel:create', async (e, tunnelName, token, appDomain) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const credDir = '/root/.cloudflared'
    sudoExec(`mkdir -p ${credDir}`)
    const ingressRules = appDomain
      ? `  - hostname: ${appDomain}\n    service: http://localhost:8000`
      : '  - service: http_status:404'
    const configContent = `tunnel: ${tunnelName}\ncredentials-file: ${credDir}/${tunnelName}.json\ningress:\n${ingressRules}\n  - service: http_status:404`
    sudoExec(`cat > ${credDir}/config.yml << 'CFEOF'\n${configContent}\nCFEOF`)
    const out = sudoExec(`cloudflared tunnel --config ${credDir}/config.yml run ${tunnelName}`)
    return { ok: true, output: out.output || '', credPath: credDir }
  } catch (err) {
    return { ok: false, error: err.message }
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
  const { spawn } = require('child_process')
  try {
    const credDir = '/root/.cloudflared'
    sudoExec(`mkdir -p ${credDir}`)
    const child = spawn('pkexec', ['cloudflared', 'tunnel', 'login'], { detached: true, stdio: 'ignore' })
    child.unref()
    return { ok: true, message: 'Opening browser for Cloudflare login...' }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('cloudflare:tunnel:check-auth', async (e) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  try {
    const certPath = '/root/.cloudflared/cert.pem'
    const exists = fs.existsSync(certPath)
    return { ok: true, authenticated: exists }
  } catch {
    return { ok: true, authenticated: false }
  }
})

ipcMain.handle('system:cleanup', async (e, type) => {
  if (!getTrustedWindow(e)) return { error: 'Unauthorized' }
  const results = []
  try {
    if (type === 'docker' || type === 'all') {
      sudoExec('systemctl stop docker docker.socket 2>/dev/null || true')
      sudoExec('systemctl disable docker docker.socket 2>/dev/null || true')
      sudoExec('rm -rf /var/lib/docker /var/run/docker.sock /etc/docker /usr/local/bin/docker* /usr/local/bin/containerd* /usr/local/bin/ctr* /usr/local/bin/crictl* /usr/local/bin/runc 2>/dev/null || true')
      sudoExec('apt purge -y docker docker.io containerd runc 2>/dev/null || dnf remove -y docker docker-ce 2>/dev/null || pacman -Rns --noconfirm docker 2>/dev/null || true')
      results.push('Docker: uninstalled')
    }
    if (type === 'wings' || type === 'all') {
      sudoExec('systemctl stop lunarspace-wings 2>/dev/null || rc-service lunarspace-wings stop 2>/dev/null || true')
      sudoExec('systemctl disable lunarspace-wings 2>/dev/null || true')
      sudoExec('rm -rf /usr/local/bin/wings /etc/lunarspace-wings /var/lib/lunarspace-wings /var/log/lunarspace-wings /tmp/lunarspace-wings /etc/systemd/system/lunarspace-wings.service /etc/init.d/lunarspace-wings /run/lunarspace-wings 2>/dev/null || true')
      sudoExec('systemctl daemon-reload 2>/dev/null || true')
      results.push('Wings: uninstalled')
    }
    if (type === 'cloudflare' || type === 'all') {
      sudoExec('systemctl stop cloudflared 2>/dev/null || true')
      sudoExec('systemctl disable cloudflared 2>/dev/null || true')
      sudoExec('rm -rf /usr/local/bin/cloudflared /root/.cloudflared /etc/systemd/system/cloudflared.service 2>/dev/null || true')
      sudoExec('systemctl daemon-reload 2>/dev/null || true')
      results.push('Cloudflare: uninstalled')
    }
    if (type === 'database' || type === 'all') {
      sudoExec('systemctl stop postgresql 2>/dev/null || true')
      sudoExec('systemctl disable postgresql 2>/dev/null || true')
      sudoExec('apt purge -y postgresql postgresql-* 2>/dev/null || dnf remove -y postgresql-server 2>/dev/null || pacman -Rns --noconfirm postgresql 2>/dev/null || true')
      sudoExec('rm -rf /var/lib/postgresql /etc/postgresql /var/log/postgresql 2>/dev/null || true')
      results.push('Database: uninstalled')
    }
    if (type === 'logs' || type === 'all') {
      sudoExec('journalctl --rotate 2>/dev/null || true')
      sudoExec('journalctl --vacuum-time=1s 2>/dev/null || true')
      sudoExec('rm -rf /var/log/*.log /var/log/*.gz 2>/dev/null || true')
      results.push('Logs: cleaned')
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
    }
    sudoExec(`su - postgres -c "psql -c \\"CREATE USER ${dbUser} WITH PASSWORD '${dbPass}'\\" 2>/dev/null || true"`)
    sudoExec(`su - postgres -c "psql -c \\"CREATE DATABASE ${dbName} OWNER ${dbUser}\\" 2>/dev/null || true"`)
    sudoExec(`su - postgres -c "psql -c \\"GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser}\\""`)
    return { ok: true, message: `Database ${dbName} ready` }
  } catch (err) {
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
})

app.on('window-all-closed', () => {})
