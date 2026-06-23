import { useEffect, useState } from 'react'

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

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[200] bg-[#000613] flex items-center justify-center">
      <style>{`
        @keyframes cp-splash {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(20,255,180,0)); }
          50% { transform: scale(1.14); filter: drop-shadow(0 0 24px rgba(20,255,180,0.35)); }
        }
      `}</style>
      <img
        src="/icon-512.png"
        alt="CoachPilot"
        style={{ width: 112, height: 112, borderRadius: '22%', animation: 'cp-splash 1s ease-in-out infinite' }}
      />
    </div>
  )
}
