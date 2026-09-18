/**
 * Dino Isekai — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - This software is provided as-is without warranty of any kind.
 *   - Do not redistribute or resell without explicit permission from FoxStudio.
 *   - If you use or reference this code, please credit FoxStudio.
 *   - Minecraft is a trademark of Mojang Studios / Microsoft. This project is not affiliated with Mojang.
 */
/**
 * Dino Isekai — Minecraft Launcher
 * Created by FoxStudio. AI-assisted development.
 *
 * Source code : https://github.com/foxstudio-201/VoxelXLauncher
 * Website     : https://voxxelxclient.vercel.app
 *
 * NOTICE:
 *   - Dành cho mấy cháu cứ thích phỉ báng.
 *   - Launcher sử dụng ai đi kèm trong việc tạo, bản thân người tạo không tự nhận là code toàn bộ do có sự hỗ trợ của ai.
 *   - Giỏi giang thì tự code bằng năng lực của mình đang video làm toàn bộ từ đầu đến cuối, còn không làm được đừng có kích đểu ảnh hưởng đến người sử dụng.
 *   - Bạn chẳng phải là anh hùng mặc áo choàng đỏ mặc quần xịt như thằng trẻ trâu rồi lên mạng ra vẻ ta đây là người tốt, là anh hùng, là người bảo vệ công lý gì đâu :).
 *   - Vậy nên bớt ảo tưởng đi.
 *   - Nếu có sử dụng hoặc tham khảo code này, hãy ghi công cho FoxStudio.
 *   - Minecraft là một thương hiệu của Mojang Studios / Microsoft. Dự án này không liên kết với Mojang.
 */
const crypto = require('crypto')
const fs     = require('fs')
const path   = require('path')

const OUT_FILE = path.join(__dirname, '../electron/app-secret.cjs')

if (fs.existsSync(OUT_FILE)) {
  console.log('[gen-secret] app-secret.cjs đã tồn tại, bỏ qua.')
  process.exit(0)
}

const secret = crypto.randomBytes(48).toString('base64url')
const appId  = 'com.dinoisekai.launcher'

const mid    = Math.floor(secret.length / 2)
const part1  = secret.slice(0, mid)
const part2  = secret.slice(mid)
const xorKey = 0x5A

const part2Encoded = Array.from(part2).map(c => c.charCodeAt(0) ^ xorKey)

const content = `// AUTO-GENERATED — DO NOT EDIT — DO NOT COMMIT
'use strict'
const _a = ${JSON.stringify(part1)}
const _b = ${JSON.stringify(part2Encoded)}.map(c => String.fromCharCode(c ^ ${xorKey})).join('')
const _id = ${JSON.stringify(appId)}
module.exports = { secret: _a + _b, appId: _id }
`

fs.writeFileSync(OUT_FILE, content, { encoding: 'utf-8', mode: 0o600 })
console.log('[gen-secret] Đã tạo app-secret.cjs')
