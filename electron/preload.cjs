const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  quitApp: () => ipcRenderer.send('quit-app'),

  getVersion: () => ipcRenderer.invoke('app:version'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  openFolderPicker: (defaultPath) => ipcRenderer.invoke('dialog:openFolder', defaultPath),

  register: (username, password) => ipcRenderer.invoke('auth:register', { username, password }),
  login: (username, password, rememberMe) => ipcRenderer.invoke('auth:login', { username, password, rememberMe }),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSession: () => ipcRenderer.invoke('auth:getSession'),

  checkDocker: () => ipcRenderer.invoke('docker:check'),
  installDocker: () => ipcRenderer.invoke('docker:install'),
  getDockerConfig: () => ipcRenderer.invoke('docker:config:get'),
  saveDockerConfig: (config) => ipcRenderer.invoke('docker:config:save', config),

  startServer: (opts) => ipcRenderer.invoke('docker:startServer', opts),
  stopServer: (name) => ipcRenderer.invoke('docker:stopServer', name),
  listServers: () => ipcRenderer.invoke('docker:listServers'),
  getServerLogs: (name) => ipcRenderer.invoke('docker:getServerLogs', name),

  getServerConfigs: () => ipcRenderer.invoke('server:getConfigs'),
  addServerConfig: (config) => ipcRenderer.invoke('server:addConfig', config),
  removeServerConfig: (id) => ipcRenderer.invoke('server:removeConfig', id),

  getMcVersions: () => ipcRenderer.invoke('mc:getVersions'),
  getMcChangelog: (version) => ipcRenderer.invoke('mc:getChangelog', version),
  getModpacks: () => ipcRenderer.invoke('mc:getModpacks'),
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  listEggs: () => ipcRenderer.invoke('eggs:list'),
  getEgg: (eggId) => ipcRenderer.invoke('eggs:get', eggId),

  getDockerStatus: () => ipcRenderer.invoke('stats:docker'),
  getDatabaseStatus: () => ipcRenderer.invoke('stats:database'),
  loadNodeConfigs: () => ipcRenderer.invoke('node:loadConfigs'),
  getPing: () => ipcRenderer.invoke('stats:ping'),
  getNetworkStats: () => ipcRenderer.invoke('stats:network'),

  getWingsStatus: () => ipcRenderer.invoke('wings:status'),
  installWings: () => ipcRenderer.invoke('wings:install'),
  startWings: () => ipcRenderer.invoke('wings:start'),
  stopWings: () => ipcRenderer.invoke('wings:stop'),
  startDocker: () => ipcRenderer.invoke('docker:start'),
  stopDocker: () => ipcRenderer.invoke('docker:stop'),
  startCloudflared: () => ipcRenderer.invoke('cloudflared:start'),
  stopCloudflared: () => ipcRenderer.invoke('cloudflared:stop'),
  systemdStatus: (serviceName) => ipcRenderer.invoke('systemd:status', serviceName),
  systemdStart: (serviceName) => ipcRenderer.invoke('systemd:start', serviceName),
  systemdStop: (serviceName) => ipcRenderer.invoke('systemd:stop', serviceName),
  systemdLogs: (serviceName, lines) => ipcRenderer.invoke('systemd:logs', serviceName, lines),
  generateWingsConfig: () => ipcRenderer.invoke('wings:config:generate'),

  checkCloudflared: () => ipcRenderer.invoke('cloudflare:check'),
  installCloudflared: (arch) => ipcRenderer.invoke('cloudflare:install', arch),
  createTunnel: (tunnelName, appDomain) => ipcRenderer.invoke('cloudflare:tunnel:create', tunnelName, appDomain),
  installTunnelService: (token) => ipcRenderer.invoke('cloudflare:tunnel:install-service', token),
  cloudflaredLogin: () => ipcRenderer.invoke('cloudflare:tunnel:login'),
  cloudflaredCheckAuth: () => ipcRenderer.invoke('cloudflare:tunnel:check-auth'),

  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  systemAuth: (password) => ipcRenderer.invoke('system:auth', password),
  systemCheckAuth: () => ipcRenderer.invoke('system:checkAuth'),
  systemCleanup: (type) => ipcRenderer.invoke('system:cleanup', type),
  databaseSetup: (dbName, dbUser, dbPass) => ipcRenderer.invoke('database:setup', dbName, dbUser, dbPass),
  installDatabase: () => ipcRenderer.invoke('database:install'),

  onInstallProgress: (callback) => ipcRenderer.on('install:progress', (_, data) => callback(data)),
})
