import {
  Button,
  Card,
  NumberInput,
  Select,
  createTheme,
  type MantineThemeOverride,
} from '@mantine/core'

export type UiThemeKey = 'classic' | 'neon' | 'minimal' | 'paper'

export const classicTheme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif',
  shadows: {
    md: '0 8px 24px rgba(0, 0, 0, 0.25)',
  },
  components: {
    Select: Select.extend({
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        dropdown: {
          borderRadius: 12,
          boxShadow: '0 14px 30px rgba(0,0,0,.28)',
        },
      },
    }),
    NumberInput: NumberInput.extend({
      defaultProps: {
        radius: 'lg',
      },
    }),
    Button: Button.extend({
      defaultProps: {
        radius: 'lg',
      },
    }),
    Card: Card.extend({
      defaultProps: {
        radius: 'lg',
        withBorder: true,
      },
    }),
  },
})

export const neonTheme = createTheme({
  primaryColor: 'violet',
  defaultRadius: 'lg',
  fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif',
  shadows: {
    md: '0 12px 28px rgba(124, 58, 237, 0.35)',
    xl: '0 18px 48px rgba(236, 72, 153, 0.28)',
  },
  components: {
    Select: Select.extend({
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        dropdown: {
          borderRadius: 14,
          boxShadow: '0 18px 40px rgba(124,58,237,.36)',
        },
      },
    }),
    NumberInput: NumberInput.extend({
      defaultProps: {
        radius: 'lg',
      },
    }),
    Button: Button.extend({
      defaultProps: {
        radius: 'lg',
      },
    }),
    Card: Card.extend({
      defaultProps: {
        radius: 'lg',
        withBorder: true,
      },
    }),
  },
})

export const minimalTheme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
  fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif',
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.08)',
    md: '0 6px 18px rgba(0, 0, 0, 0.12)',
  },
  components: {
    Select: Select.extend({
      defaultProps: {
        radius: 'md',
      },
      styles: {
        dropdown: {
          borderRadius: 10,
          boxShadow: '0 10px 22px rgba(0,0,0,.16)',
        },
      },
    }),
    NumberInput: NumberInput.extend({
      defaultProps: {
        radius: 'md',
      },
    }),
    Button: Button.extend({
      defaultProps: {
        radius: 'md',
      },
    }),
    Card: Card.extend({
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
    }),
  },
})

export const paperTheme = createTheme({
  primaryColor: 'dark',
  defaultRadius: 'md',
  fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif',
  shadows: {
    sm: '0 2px 8px rgba(48, 47, 44, 0.08)',
    md: '0 8px 18px rgba(48, 47, 44, 0.12)',
  },
  components: {
    Select: Select.extend({
      defaultProps: {
        radius: 'md',
      },
      styles: {
        dropdown: {
          borderRadius: 10,
          boxShadow: '0 10px 22px rgba(48,47,44,.14)',
        },
      },
    }),
    NumberInput: NumberInput.extend({
      defaultProps: {
        radius: 'md',
      },
    }),
    Button: Button.extend({
      defaultProps: {
        radius: 'md',
      },
    }),
    Card: Card.extend({
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
    }),
  },
})

export const themeMap: Record<UiThemeKey, MantineThemeOverride> = {
  classic: classicTheme,
  neon: neonTheme,
  minimal: minimalTheme,
  paper: paperTheme,
}
