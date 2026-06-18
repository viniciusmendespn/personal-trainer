interface AppLogoProps {
  size?: number
  /** Corner radius in the 64x64 viewBox space (default 16 = matches app icon proportions). */
  radius?: number
}

export function AppLogo({ size = 32, radius = 16 }: AppLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="coachpilot-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#0a0e1a" />
        </linearGradient>
        <linearGradient id="coachpilot-bar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx={radius} fill="url(#coachpilot-bg)" />
      <rect x="20" y="29" width="24" height="6" rx="3" fill="url(#coachpilot-bar)" />
      <rect x="10" y="20" width="8" height="24" rx="4" fill="url(#coachpilot-bar)" />
      <rect x="14" y="24" width="6" height="16" rx="3" fill="#5eead4" opacity="0.9" />
      <rect x="46" y="20" width="8" height="24" rx="4" fill="url(#coachpilot-bar)" />
      <rect x="44" y="24" width="6" height="16" rx="3" fill="#5eead4" opacity="0.9" />
    </svg>
  )
}
