import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const iconsDir = join(publicDir, 'icons')
const resourcesDir = join(root, 'resources')

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon.png', size: 32 },
]

const resizePng = (buffer, size, background = { r: 0, g: 0, b: 0, alpha: 0 }) =>
  sharp(buffer)
    .resize(size, size, { fit: 'contain', background })
    .png()
    .toBuffer()

async function resolveLogoSource() {
  const pngPath = join(publicDir, 'logo.png')
  const svgPath = join(publicDir, 'logo.svg')

  try {
    await access(pngPath)
    return { path: pngPath, label: 'logo.png' }
  } catch {
    /* try svg */
  }

  try {
    await access(svgPath)
    return { path: svgPath, label: 'logo.svg' }
  } catch {
    throw new Error('public/logo.png veya public/logo.svg bulunamadı.')
  }
}

const { path: sourcePath, label } = await resolveLogoSource()
const sourceBuffer = await readFile(sourcePath)
const brandBg = { r: 15, g: 40, b: 71, alpha: 1 }

await mkdir(iconsDir, { recursive: true })
await mkdir(resourcesDir, { recursive: true })

for (const { name, size } of sizes) {
  await writeFile(join(iconsDir, name), await resizePng(sourceBuffer, size))
}

await writeFile(join(publicDir, 'logo.png'), await resizePng(sourceBuffer, 512))
await writeFile(join(resourcesDir, 'icon.png'), await resizePng(sourceBuffer, 1024, brandBg))
await writeFile(join(resourcesDir, 'splash.png'), await resizePng(sourceBuffer, 2732, brandBg))

console.log(`Kaynak: ${label}`)
console.log('Üretildi: public/logo.png, public/icons/*, resources/*')
