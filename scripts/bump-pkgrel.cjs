const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '../packaging/aur/PKGBUILD')
if (!fs.existsSync(file)) process.exit(0)

const src = fs.readFileSync(file, 'utf8')
const m = src.match(/^pkgrel=(\d+)$/m)
if (!m) process.exit(0)

const next = parseInt(m[1], 10) + 1
fs.writeFileSync(file, src.replace(/^pkgrel=\d+$/m, `pkgrel=${next}`))
console.log(`[pkgrel] ${m[1]} → ${next}`)
