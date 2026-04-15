export function DuckLogo() {
  return (
    <div className="flex justify-center mb-6">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="duck-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Body */}
        <ellipse cx="36" cy="54" rx="22" ry="15" stroke="#00f2ff" strokeWidth="2" fill="rgba(0,242,255,0.05)" filter="url(#duck-glow)" />
        {/* Head */}
        <circle cx="56" cy="36" r="13" stroke="#00f2ff" strokeWidth="2" fill="rgba(0,242,255,0.05)" filter="url(#duck-glow)" />
        {/* Beak */}
        <path d="M67 36 L76 33.5 L76 39 L67 37.5 Z" fill="#ff006e" filter="url(#duck-glow)" />
        {/* Eye */}
        <circle cx="60" cy="31" r="2.5" fill="#00f2ff" />
        <circle cx="61" cy="30" r="1" fill="#0a0c10" />
        {/* Wing accent */}
        <path d="M22 52 Q34 44 48 50" stroke="#00f2ff" strokeWidth="1.5" fill="none" opacity="0.45" strokeLinecap="round" />
        {/* Neck */}
        <path d="M46 45 Q50 42 51 39" stroke="#00f2ff" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}
