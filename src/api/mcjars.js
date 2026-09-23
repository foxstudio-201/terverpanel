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
  const v = String(version || '').trim()
  const low = v.toLowerCase()
  // New MC versioning: 25.x / 26.x / 27.x … (dropped the leading 1.)
  const m = low.match(/^(\d+)\.(\d+)/)
  if (m) {
    const major = parseInt(m[1], 10)
    const minor = parseInt(m[2], 10)
    if (major >= 25) return 25
    if (major === 1) {
      if (minor >= 21) {
        // 1.21.9+ / experimental builds may require Java 25
        const patch = parseInt((low.split('.')[2] || '0').replace(/\D.*/, ''), 10) || 0
        if (minor > 21 || (minor === 21 && patch >= 9)) return 25
        return 21
      }
      if (minor === 20) {
        const patch = parseInt((low.split('.')[2] || '0').replace(/\D.*/, ''), 10) || 0
        if (patch >= 5) return 21
        return 17
      }
      if (minor >= 17) return 17
      if (minor >= 13) return 16
      return 8
    }
    if (major >= 21 && major <= 24) return 21
  }
  if (low.includes('1.20.5') || low.includes('1.20.6') || low.includes('1.21') || low.includes('1.22')) return 21
  if (low.includes('1.17') || low.includes('1.18') || low.includes('1.19') || low.includes('1.20')) return 17
  if (low.includes('1.16') || low.includes('1.15') || low.includes('1.14') || low.includes('1.13')) return 16
  return 8
}

export function detectDockerImageKey(dockerImages, javaVersion) {
  const keys = Object.keys(dockerImages || {})
  if (keys.length === 0) return ''
  const want = Number(javaVersion) || 8
  const exact = keys.find(k => k.toLowerCase().includes(String(want)))
  if (exact) return exact
  // Prefer the highest available Java image that is >= required version
  const nums = keys.map(k => {
    const m = k.match(/(\d+)/)
    return { key: k, n: m ? parseInt(m[1], 10) : 0 }
  }).filter(x => x.n > 0).sort((a, b) => a.n - b.n)
  const ge = nums.filter(x => x.n >= want)
  if (ge.length) return ge[0].key
  if (nums.length) return nums[nums.length - 1].key
  return keys[keys.length - 1]
}

export function yolksImageForJava(javaVersion) {
  const j = Number(javaVersion) || 21
  return `ghcr.io/pelican-eggs/yolks:java_${j}`
}
