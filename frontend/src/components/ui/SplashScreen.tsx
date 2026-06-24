import { useEffect, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'

export function useSplash() {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem('splash-shown'))
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      setVisible(false)
      sessionStorage.setItem('splash-shown', '1')
    }, 1500)
    return () => clearTimeout(t)
  }, [visible])
  return visible
}

export function SplashScreen({ src = '/icon-512.png', srcLight, rounded = true }: { src?: string; srcLight?: string; rounded?: boolean }) {
  const { theme } = useTheme()
  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  const isLight = effectiveTheme === 'light'
  const logoSrc = isLight && srcLight ? srcLight : src

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: isLight ? '#f5f4fc' : '#000613' }}
    >
      <style>{`
        @keyframes cp-splash {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(20,255,180,0)); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 24px rgba(20,255,180,0.35)); }
        }
      `}</style>
      <img
        src={logoSrc}
        alt="CoachPilot"
        style={{
          width: rounded ? 112 : 220,
          height: 'auto',
          borderRadius: rounded ? '22%' : 0,
          animation: 'cp-splash 1s ease-in-out infinite',
        }}
      />
    </div>
  )
}
