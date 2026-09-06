import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'photospec:theme'

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Private browsing and blocked site data both throw here. Not a problem:
    // the OS preference is a perfectly good default.
  }
  return 'system'
}

/**
 * Remembers the user's theme choice, falling back to the operating system.
 *
 * 'system' deliberately removes the attribute rather than writing a value, so
 * the CSS media query takes over and the page follows the OS if it changes
 * while the tab is open.
 */
export function useTheme(): { theme: ThemeChoice; toggle: () => void } {
  const [theme, setTheme] = useState<ThemeChoice>(read)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)

    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Storage is a convenience here, never load-bearing.
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => {
      if (current === 'system') {
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        return systemIsDark ? 'light' : 'dark'
      }
      return current === 'dark' ? 'light' : 'dark'
    })
  }, [])

  return { theme, toggle }
}
