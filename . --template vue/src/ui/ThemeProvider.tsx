import {
  MantineProvider,
  type MantineColorScheme,
} from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { themeMap, type UiThemeKey } from './theme'
import { applyCustomThemeOverrides, clearCustomThemeOverrides, loadCustomThemeOverrides } from './customTheme'

const STORAGE_KEY = 'ui_theme'

type ThemeContextValue = {
  uiThemeKey: UiThemeKey
  setUiThemeKey: (value: UiThemeKey) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  uiThemeKey: 'classic',
  setUiThemeKey: () => undefined,
})

function toThemeKey(value: unknown): UiThemeKey {
  if (value === 'classic' || value === 'neon' || value === 'minimal' || value === 'paper') return value
  return 'classic'
}

function toColorScheme(value: UiThemeKey): MantineColorScheme {
  if (value === 'minimal' || value === 'paper') return 'light'
  return 'dark'
}

export function useUiTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [uiThemeKey, setUiThemeKeyState] = useState<UiThemeKey>('classic')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setUiThemeKeyState(toThemeKey(saved))
    } catch {
      // Ignore storage failures
    }
  }, [])

  useEffect(() => {
    if (uiThemeKey === 'paper') {
      applyCustomThemeOverrides(loadCustomThemeOverrides())
      return
    }
    clearCustomThemeOverrides()
  }, [uiThemeKey])

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ uiTheme?: unknown }>
      const next = toThemeKey(customEvent.detail?.uiTheme)
      setUiThemeKeyState(next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Ignore storage failures
      }
    }
    window.addEventListener('ui-theme-change', handleThemeChange as EventListener)
    return () => window.removeEventListener('ui-theme-change', handleThemeChange as EventListener)
  }, [])

  const setUiThemeKey = (value: UiThemeKey) => {
    const next = toThemeKey(value)
    setUiThemeKeyState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore storage failures
    }
    window.dispatchEvent(new CustomEvent('ui-theme-change', { detail: { uiTheme: next } }))
  }

  const contextValue = useMemo(
    () => ({
      uiThemeKey,
      setUiThemeKey,
    }),
    [uiThemeKey],
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      <MantineProvider theme={themeMap[uiThemeKey]} defaultColorScheme={toColorScheme(uiThemeKey)}>
        <Notifications />
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  )
}
