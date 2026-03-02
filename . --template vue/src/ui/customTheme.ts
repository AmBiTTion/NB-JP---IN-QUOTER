export const CUSTOM_THEME_STORAGE_KEY = 'ui_theme_custom_overrides_v1'

export type CustomThemeOverrides = {
  bg0: string
  bg1: string
  text: string
  textDim: string
  surface1: string
  surface2: string
  border1: string
  primary: string
  accent: string
  accent2: string
  fontFamily: string
  backgroundImage: string
  glassIntensity: number
}

export const defaultCustomThemeOverrides: CustomThemeOverrides = {
  bg0: '#efede3',
  bg1: '#f5f3ea',
  text: '#302f2c',
  textDim: '#615f59',
  surface1: '#ffffff',
  surface2: '#ffffff',
  border1: '#cfcac0',
  primary: '#302f2c',
  accent: '#302f2c',
  accent2: '#56534d',
  fontFamily:
    '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif',
  backgroundImage: '',
  glassIntensity: 0.2,
}

const hexToRgbCsv = (hex: string): string => {
  const h = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '48,47,44'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r},${g},${b}`
}

export const loadCustomThemeOverrides = (): CustomThemeOverrides => {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY)
    if (!raw) return { ...defaultCustomThemeOverrides }
    const parsed = JSON.parse(raw) as Partial<CustomThemeOverrides>
    return { ...defaultCustomThemeOverrides, ...parsed }
  } catch {
    return { ...defaultCustomThemeOverrides }
  }
}

export const saveCustomThemeOverrides = (overrides: CustomThemeOverrides): void => {
  localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(overrides))
}

export const applyCustomThemeOverrides = (overrides: CustomThemeOverrides): void => {
  const root = document.documentElement
  const intensity = Math.max(0, Math.min(1, Number(overrides.glassIntensity ?? 0.2)))
  const blurMain = 7 + intensity * 9
  const blurSub = 5 + intensity * 7
  const satMain = 102 + intensity * 22
  const satSub = 100 + intensity * 16
  const highlight = 0.03 + intensity * 0.08
  const shadow = 0.16 + intensity * 0.2
  root.style.setProperty('--bg0', overrides.bg0)
  root.style.setProperty('--bg1', overrides.bg1)
  root.style.setProperty('--text', overrides.text)
  root.style.setProperty('--text-dim', overrides.textDim)
  root.style.setProperty('--surface-1', overrides.surface1)
  root.style.setProperty('--surface-2', overrides.surface2)
  root.style.setProperty('--border-1', overrides.border1)
  root.style.setProperty('--primary', overrides.primary)
  root.style.setProperty('--primaryGrad', `linear-gradient(135deg, ${overrides.primary}, ${overrides.accent2})`)
  root.style.setProperty('--accent-rgb', hexToRgbCsv(overrides.accent))
  root.style.setProperty('--accent-2-rgb', hexToRgbCsv(overrides.accent2))
  root.style.setProperty('--focus-ring', `rgba(${hexToRgbCsv(overrides.accent)},.22)`)
  root.style.setProperty('--focus-glow', `rgba(${hexToRgbCsv(overrides.accent2)},.14)`)
  root.style.setProperty('--hover-glow', `rgba(${hexToRgbCsv(overrides.accent)},.18)`)
  root.style.setProperty('--dropdown-text', overrides.text)
  root.style.setProperty('--dropdown-bg', overrides.surface2)
  root.style.setProperty(
    '--custom-bg-image',
    overrides.backgroundImage ? `url("${overrides.backgroundImage}")` : 'none',
  )
  root.style.setProperty('--app-font-family', overrides.fontFamily)
  root.style.setProperty('--glass-blur-main', `${blurMain.toFixed(2)}px`)
  root.style.setProperty('--glass-blur-sub', `${blurSub.toFixed(2)}px`)
  root.style.setProperty('--glass-sat-main', `${satMain.toFixed(1)}%`)
  root.style.setProperty('--glass-sat-sub', `${satSub.toFixed(1)}%`)
  root.style.setProperty('--glass-highlight-alpha', highlight.toFixed(3))
  root.style.setProperty('--glass-shadow-alpha', shadow.toFixed(3))
}

export const clearCustomThemeOverrides = (): void => {
  const root = document.documentElement
  ;[
    '--bg0',
    '--bg1',
    '--text',
    '--text-dim',
    '--surface-1',
    '--surface-2',
    '--border-1',
    '--primary',
    '--primaryGrad',
    '--accent-rgb',
    '--accent-2-rgb',
    '--focus-ring',
    '--focus-glow',
    '--hover-glow',
    '--dropdown-text',
    '--dropdown-bg',
    '--custom-bg-image',
    '--app-font-family',
    '--glass-blur-main',
    '--glass-blur-sub',
    '--glass-sat-main',
    '--glass-sat-sub',
    '--glass-highlight-alpha',
    '--glass-shadow-alpha',
  ].forEach((k) => root.style.removeProperty(k))
}
