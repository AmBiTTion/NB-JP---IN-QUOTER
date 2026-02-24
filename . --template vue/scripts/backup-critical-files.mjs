import { mkdir, copyFile, access, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

const backupRoot = path.join(projectRoot, '_backups')
const backupDir = path.join(backupRoot, `backup-${stamp}`)

const copied = []
const warnings = []

async function exists(relPath) {
  try {
    await access(path.join(projectRoot, relPath))
    return true
  } catch {
    return false
  }
}

async function copyRel(relPath) {
  const src = path.join(projectRoot, relPath)
  const dst = path.join(backupDir, relPath)
  try {
    await access(src)
  } catch {
    warnings.push(`warning: missing ${relPath}`)
    return
  }
  await mkdir(path.dirname(dst), { recursive: true })
  await copyFile(src, dst)
  copied.push(relPath)
}

async function listFiles(relDir) {
  const absDir = path.join(projectRoot, relDir)
  try {
    const entries = await readdir(absDir, { withFileTypes: true })
    return entries.filter((e) => e.isFile()).map((e) => path.posix.join(relDir.replaceAll('\\', '/'), e.name))
  } catch {
    return []
  }
}

async function resolveFirst(candidates) {
  for (const rel of candidates) {
    if (await exists(rel)) return rel
  }
  return null
}

async function collectTargets() {
  const targets = new Set()

  const required = [
    'src/components/Admin.tsx',
    'src/App.tsx',
    'src/types/domain.ts',
    'electron/main.ts',
    'electron/exporters/exportExternalQuotationExcel.ts',
    'data.json',
    'package.json',
  ]

  for (const rel of required) targets.add(rel)

  const fieldLabels = await resolveFirst([
    'src/utils/FieldLabels.ts',
    'src/utils/fieldLabels.ts',
    'src/utils/FIELD_LABELS.ts',
  ])
  if (fieldLabels) targets.add(fieldLabels)
  else warnings.push('warning: missing src/utils/FieldLabels.ts (or actual field labels file)')

  const calculateQuote = await resolveFirst([
    'calculateQuote.ts',
    'src/calculateQuote.ts',
    'src/utils/calculateQuote.ts',
    'electron/calculateQuote.ts',
  ])
  if (calculateQuote) targets.add(calculateQuote)
  else warnings.push('warning: missing calculateQuote.ts (auto-detect failed)')

  const rootFiles = await listFiles('.')
  for (const rel of rootFiles) {
    const base = path.basename(rel)
    if (/^electron\.vite\.config\..+/i.test(base)) targets.add(base)
    if (/^vite\.config\..+/i.test(base)) targets.add(base)
    if (/^tsconfig.*\.json$/i.test(base)) targets.add(base)
    if (base.toLowerCase() === '.editorconfig') targets.add(base)
  }

  const exporterFiles = await listFiles('electron/exporters')
  for (const rel of exporterFiles) targets.add(rel)

  return [...targets]
}

async function main() {
  await mkdir(backupDir, { recursive: true })
  const targets = await collectTargets()

  for (const rel of targets) {
    await copyRel(rel)
  }

  console.log(`Backup directory: ${backupDir}`)
  console.log('Copied files:')
  if (copied.length === 0) {
    console.log('  (none)')
  } else {
    copied.sort().forEach((f) => console.log(`  - ${f}`))
  }

  if (warnings.length > 0) {
    console.log('Warnings:')
    warnings.forEach((w) => console.log(`  - ${w}`))
  }
}

main().catch((err) => {
  console.error('Backup failed:', err)
  process.exit(1)
})