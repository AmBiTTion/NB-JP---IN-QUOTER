import zh from './zh'

type Dict = Record<string, unknown>

const activeLocale = zh as unknown as Dict

function getByPath(obj: Dict, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Dict)) {
      return (acc as Dict)[key]
    }
    return undefined
  }, obj)

  return typeof value === 'string' ? value : undefined
}

export function t(key: string): string {
  const value = getByPath(activeLocale, key)
  if (value !== undefined) return value
  console.warn(`[i18n] missing key: ${key}`)
  return key
}
