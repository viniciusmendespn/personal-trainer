import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeChoice = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'pt:theme'

function getEffective(choice: ThemeChoice): 'dark' | 'light' {
  if (choice === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return choice
}

function applyTheme(effective: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', effective)
  document.documentElement.style.colorScheme = effective
}

const ThemeContext = createContext<{
  theme: ThemeChoice
  setTheme: (t: ThemeChoice) => void
}>({ theme: 'system', setTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeChoice) || 'system'
  )

  useEffect(() => {
    applyTheme(getEffective(theme))

    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(getEffective('system'))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  function setTheme(t: ThemeChoice) {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
