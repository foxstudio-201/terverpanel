const MCJARS_BASE = 'https://mcjars.app'

const TYPE_MAP = {
  paper: 'PAPER',
  vanilla: 'VANILLA',
  fabric: 'FABRIC',
  forge: 'FORGE',
  purpur: 'PURPUR',
  spigot: 'SPIGOT',
}

export async function fetchMcJarsVersions(eggType) {
  const mcjarsType = TYPE_MAP[eggType]
  if (!mcjarsType) return {}
  try {
    const res = await fetch(`${MCJARS_BASE}/api/v2/builds/${mcjarsType}`)
    if (!res.ok) return {}
    const data = await res.json()
    return data.builds || {}
  } catch {
    return {}
  }
}

export async function fetchMcJarsBuilds(eggType, version) {
  const mcjarsType = TYPE_MAP[eggType]
  if (!mcjarsType) return []
  try {
    const res = await fetch(`${MCJARS_BASE}/api/v2/builds/${mcjarsType}/${version}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.builds || []
  } catch {
    return []
  }
}

export function detectJavaVersion(version) {
  const v = (version || '').toLowerCase()
  if (v.includes('1.20.5') || v.includes('1.20.6') || v.includes('1.21') || v.includes('1.22')) return 21
  if (v.includes('1.17') || v.includes('1.18') || v.includes('1.19') || v.includes('1.20')) return 17
  if (v.includes('1.16') || v.includes('1.15') || v.includes('1.14') || v.includes('1.13')) return 16
  return 8
}

export function detectDockerImageKey(dockerImages, javaVersion) {
  const keys = Object.keys(dockerImages || {})
  if (keys.length === 0) return ''
  const jKey = keys.find(k => k.toLowerCase().includes(String(javaVersion)))
  if (jKey) return jKey
  if (javaVersion >= 21) {
    const j21 = keys.find(k => k.toLowerCase().includes('21'))
    if (j21) return j21
  }
  if (javaVersion >= 17) {
    const j17 = keys.find(k => k.toLowerCase().includes('17'))
    if (j17) return j17
  }
  return keys[keys.length - 1]
}
