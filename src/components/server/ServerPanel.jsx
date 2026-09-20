import ConsolePage from './ConsolePage'
import FileManagerPage from './FileManagerPage'
import DatabasePage from './DatabasePage'
import SchedulePage from './SchedulePage'
import UserPage from './UserPage'
import BackupPage from './BackupPage'
import NetworkPage from './NetworkPage'
import StartupPage from './StartupPage'
import ServerSettingsPage from './ServerSettingsPage'

export default function ServerPanel({ server, theme, lang, displayPage, onBack, onServerDeleted }) {
  const props = { server, theme, lang }

  switch (displayPage) {
    case 'server-console': return <ConsolePage {...props} />
    case 'server-files': return <FileManagerPage {...props} />
    case 'server-databases': return <DatabasePage {...props} />
    case 'server-schedules': return <SchedulePage {...props} />
    case 'server-users': return <UserPage {...props} />
    case 'server-backups': return <BackupPage {...props} />
    case 'server-network': return <NetworkPage {...props} />
    case 'server-startup': return <StartupPage {...props} />
    case 'server-settings': return <ServerSettingsPage {...props} onBack={onBack} onServerDeleted={onServerDeleted} />
    default: return <ConsolePage {...props} />
  }
}
