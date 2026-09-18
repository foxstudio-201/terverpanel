const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  quitApp: () => ipcRenderer.send('quit-app'),

  getVersion: () => ipcRenderer.invoke('app:version'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),

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
  getPing: () => ipcRenderer.invoke('stats:ping'),
  getNetworkStats: () => ipcRenderer.invoke('stats:network'),

  getWingsStatus: () => ipcRenderer.invoke('wings:status'),
  installWings: () => ipcRenderer.invoke('wings:install'),
  startWings: () => ipcRenderer.invoke('wings:start'),
  stopWings: () => ipcRenderer.invoke('wings:stop'),
  generateWingsConfig: () => ipcRenderer.invoke('wings:config:generate'),

  checkCloudflared: () => ipcRenderer.invoke('cloudflare:check'),
  installCloudflared: (arch) => ipcRenderer.invoke('cloudflare:install', arch),
  createTunnel: (tunnelName, token, appDomain) => ipcRenderer.invoke('cloudflare:tunnel:create', tunnelName, token, appDomain),
  installTunnelService: (token) => ipcRenderer.invoke('cloudflare:tunnel:install-service', token),
  cloudflaredLogin: () => ipcRenderer.invoke('cloudflare:tunnel:login'),
  cloudflaredCheckAuth: () => ipcRenderer.invoke('cloudflare:tunnel:check-auth'),

  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  systemAuth: (password) => ipcRenderer.invoke('system:auth', password),
  systemCheckAuth: () => ipcRenderer.invoke('system:checkAuth'),
  systemCleanup: (type) => ipcRenderer.invoke('system:cleanup', type),
  databaseSetup: (dbName, dbUser, dbPass) => ipcRenderer.invoke('database:setup', dbName, dbUser, dbPass),
})
