interface AppLogoProps {
  size?: number
}

export function AppLogo({ size = 32 }: AppLogoProps) {
  return <img src="/coach-icon.png" width={size} height={size} alt="" aria-hidden="true" style={{ objectFit: 'contain', borderRadius: size * 0.25 }} />
}
