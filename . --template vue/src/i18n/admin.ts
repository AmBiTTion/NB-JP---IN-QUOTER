import adminZh from './adminZh'

type Dict = Record<string, unknown>

function getByPath(obj: Dict, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Dict)) {
      return (acc as Dict)[key]
    }
    return undefined
  }, obj)

  return typeof value === 'string' ? value : undefined
}

export function ta(key: string): string {
  const value = getByPath(adminZh as unknown as Dict, key)
  if (value !== undefined) return value
  console.warn(`[i18n-admin] missing key: ${key}`)
  return key
}

export function tf(key: string, params: Record<string, string | number>): string {
  const tpl = ta(key)
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    tpl,
  )
}

