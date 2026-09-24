const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  quitApp: () => ipcRenderer.send('quit-app'),

  getVersion: () => ipcRenderer.invoke('app:version'),
  clipboardWrite: (text) => ipcRenderer.invoke('clipboard:write', text),

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
  getServerConfig: (serverId) => ipcRenderer.invoke('server:getConfig', serverId),
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
  getServerNetworkStats: (serverId) => ipcRenderer.invoke('stats:serverNetwork', serverId),

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

  // Wings local API proxy
  wingsServerState: (uuid) => ipcRenderer.invoke('wings:server:state', uuid),
  wingsServerPower: (uuid, action) => ipcRenderer.invoke('wings:server:power', uuid, action),
  wingsServerCommand: (uuid, command) => ipcRenderer.invoke('wings:server:command', uuid, command),
  wingsServerLogs: (uuid, lines) => ipcRenderer.invoke('wings:server:logs', uuid, lines),
  wingsListFiles: (uuid, dir) => ipcRenderer.invoke('wings:server:files', uuid, dir),
  wingsReadFile: (uuid, path) => ipcRenderer.invoke('wings:server:readFile', uuid, path),
  wingsWriteFile: (uuid, path, content) => ipcRenderer.invoke('wings:server:writeFile', uuid, path, content),
  wingsDeleteFile: (uuid, path) => ipcRenderer.invoke('wings:server:deleteFile', uuid, path),
  wingsCreateFile: (uuid, dir, name) => ipcRenderer.invoke('wings:server:createFile', uuid, dir, name),
  wingsCreateFolder: (uuid, dir, name) => ipcRenderer.invoke('wings:server:createFolder', uuid, dir, name),
  wingsUploadFile: (uuid, path, data) => ipcRenderer.invoke('wings:server:uploadFile', uuid, path, data),
  wingsMoveFile: (uuid, from, to) => ipcRenderer.invoke('wings:server:moveFile', uuid, from, to),
  wingsSyncConfig: (uuid, config) => ipcRenderer.invoke('wings:server:sync', uuid, config),
  wingsReinstall: (uuid) => ipcRenderer.invoke('wings:server:reinstall', uuid),
  wingsDeleteServer: (uuid) => ipcRenderer.invoke('wings:server:delete', uuid),
  wingsCreateServer: (uuid) => ipcRenderer.invoke('wings:server:create', uuid),
  wingsListServers: () => ipcRenderer.invoke('wings:servers:list'),

  // Backups (Calagopus-style)
  backupList: (serverId) => ipcRenderer.invoke('backup:list', serverId),
  backupCreate: (serverId, opts) => ipcRenderer.invoke('backup:create', serverId, opts),
  backupUpdate: (serverId, backupId, patch) => ipcRenderer.invoke('backup:update', serverId, backupId, patch),
  backupDelete: (serverId, backupId) => ipcRenderer.invoke('backup:delete', serverId, backupId),
  backupRestore: (serverId, backupId, opts) => ipcRenderer.invoke('backup:restore', serverId, backupId, opts),
  backupDownload: (serverId, backupId) => ipcRenderer.invoke('backup:download', serverId, backupId),
  onBackupUpdate: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('backup:update', handler)
    return () => { ipcRenderer.removeListener('backup:update', handler) }
  },

  // Schedules
  scheduleList: (serverId) => ipcRenderer.invoke('schedule:list', serverId),
  scheduleCreate: (serverId, data) => ipcRenderer.invoke('schedule:create', serverId, data),
  scheduleUpdate: (scheduleId, data) => ipcRenderer.invoke('schedule:update', scheduleId, data),
  scheduleDelete: (scheduleId) => ipcRenderer.invoke('schedule:delete', scheduleId),
  scheduleToggle: (scheduleId, isActive) => ipcRenderer.invoke('schedule:toggle', scheduleId, isActive),
  scheduleRun: (scheduleId) => ipcRenderer.invoke('schedule:run', scheduleId),
  schedulePreview: (cron) => ipcRenderer.invoke('schedule:preview', cron),
  onScheduleUpdate: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('schedule:update', handler)
    return () => { ipcRenderer.removeListener('schedule:update', handler) }
  },
  onScheduleDeleted: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('schedule:deleted', handler)
    return () => { ipcRenderer.removeListener('schedule:deleted', handler) }
  },
  onScheduleRan: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('schedule:ran', handler)
    return () => { ipcRenderer.removeListener('schedule:ran', handler) }
  },

  // Server lifecycle
  installServer: (serverId) => ipcRenderer.invoke('server:install', serverId),
  startGameServer: (serverId) => ipcRenderer.invoke('server:start', serverId),
  stopGameServer: (serverId) => ipcRenderer.invoke('server:stop', serverId),
  killGameServer: (serverId) => ipcRenderer.invoke('server:kill', serverId),
  getServerStatus: (serverId) => ipcRenderer.invoke('server:status', serverId),
  getServerHistory: (serverId) => ipcRenderer.invoke('server:history', serverId),
  getServerTps: (serverId) => ipcRenderer.invoke('server:tps', serverId),
  onServerTps: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('server:tps', handler)
    return () => { ipcRenderer.removeListener('server:tps', handler) }
  },

  onInstallProgress: (callback) => ipcRenderer.on('install:progress', (_, data) => callback(data)),
  onServerProgress: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('server:progress', handler)
    return () => { ipcRenderer.removeListener('server:progress', handler) }
  },
  onServerLog: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('server:log', handler)
    return () => { ipcRenderer.removeListener('server:log', handler) }
  },
  onServerLogSnapshot: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('server:log-snapshot', handler)
    return () => { ipcRenderer.removeListener('server:log-snapshot', handler) }
  },
  onServerLogReset: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('server:log-reset', handler)
    return () => { ipcRenderer.removeListener('server:log-reset', handler) }
  },

  onServerBootLine: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('server:boot-line', handler)
    return () => { ipcRenderer.removeListener('server:boot-line', handler) }
  },
  serverGetLogs: (serverId) => ipcRenderer.invoke('server:getLogs', serverId),

  // Wings WebSocket console
  wingsWsConnect: (serverId) => ipcRenderer.invoke('wings:ws-connect', serverId),
  wingsWsDisconnect: (serverId) => ipcRenderer.invoke('wings:ws-disconnect', serverId),
  wingsWsSend: (serverId, event, args) => ipcRenderer.invoke('wings:ws-send', serverId, event, args),
  wingsWsStatus: (serverId) => ipcRenderer.invoke('wings:ws-status', serverId),
  onWingsWsEvent: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('wings:ws-event', handler)
    return () => { ipcRenderer.removeListener('wings:ws-event', handler) }
  },
})
