import { Facebook, Globe, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react'

export interface SocialLinksProps {
  instagramUrl?: string
  tiktokUrl?: string
  youtubeUrl?: string
  linkedinUrl?: string
  facebookUrl?: string
  xUrl?: string
  siteUrl?: string
  className?: string
}

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82c-.96-.66-1.6-1.71-1.72-2.92h-3.14v13.3c0 1.45-1.18 2.62-2.62 2.62a2.62 2.62 0 0 1 0-5.24c.26 0 .51.04.74.11V10.6a5.83 5.83 0 0 0-.74-.05 5.78 5.78 0 1 0 5.76 6.07V9.4a8.9 8.9 0 0 0 4.92 1.49V7.75a5.4 5.4 0 0 1-3.2-1.93Z" />
    </svg>
  )
}

const LINK_BASE =
  'w-9 h-9 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center text-accent-hover transition-colors'

export function SocialLinks({
  instagramUrl,
  tiktokUrl,
  youtubeUrl,
  linkedinUrl,
  facebookUrl,
  xUrl,
  siteUrl,
  className = '',
}: SocialLinksProps) {
  const links = [
    { url: instagramUrl, label: 'Instagram', icon: <Instagram size={18} /> },
    { url: tiktokUrl, label: 'TikTok', icon: <TikTokIcon /> },
    { url: youtubeUrl, label: 'YouTube', icon: <Youtube size={18} /> },
    { url: linkedinUrl, label: 'LinkedIn', icon: <Linkedin size={18} /> },
    { url: facebookUrl, label: 'Facebook', icon: <Facebook size={18} /> },
    { url: xUrl, label: 'X (Twitter)', icon: <Twitter size={18} /> },
    { url: siteUrl, label: 'Site', icon: <Globe size={18} /> },
  ].filter((l) => l.url)

  if (links.length === 0) return null

  return (
    <div className={`flex items-center gap-2 flex-wrap justify-center ${className}`}>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          title={l.label}
          className={LINK_BASE}
        >
          {l.icon}
        </a>
      ))}
    </div>
  )
}
