/** @jsxImportSource hono/jsx */
import Layout from '../Layout'
import config from '../config.json'

export default function Home() {
  const { home, theme } = config
  return (
    <Layout title={home.title}>
      <div class="container" style="text-align: center; padding-top: 4rem;">
        <DuckSvg />
        <h1 style={`font-size: 3rem; margin: 1rem 0; text-shadow: 0 0 20px ${theme.colors.primary};`}>
          {home.heading}
        </h1>
        <p style="margin-bottom: 2rem; opacity: 0.8;">
          {home.subheading}
        </p>

        <form id="shorten-form" style="display: flex; gap: 0.5rem; justify-content: center; max-width: 500px; margin: 0 auto;">
          <input 
            type="url" 
            name="url" 
            placeholder={home.input_placeholder} 
            required
            style={`flex: 1; padding: 0.75rem; background: ${theme.colors.card}; border: 1px solid ${theme.colors.primary}; color: ${theme.colors.primary}; border-radius: 4px; font-family: inherit;`}
          />
          <button type="submit" class="btn">{home.button_text}</button>
        </form>

        <div id="result" style="margin-top: 1rem;"></div>
        <div id="error" style={`color: ${theme.colors.accent}; margin-top: 1rem;`}></div>
      </div>

      <script src="/assets/index.js"></script>
    </Layout>
  )
}

function DuckSvg() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style="margin: 0 auto; display: block;">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="60" cy="60" r="50" fill="#0B0E14" stroke="#00F2FF" stroke-width="2" filter="url(#glow)"/>
      <ellipse cx="60" cy="65" rx="25" ry="20" fill="white"/>
      <ellipse cx="60" cy="55" rx="18" ry="15" fill="white"/>
      <ellipse cx="68" cy="52" rx="8" ry="6" fill="#00F2FF" filter="url(#glow)"/>
      <path d="M42 48 Q35 40, 50 35" stroke="#FF0055" stroke-width="8" fill="none" stroke-linecap="round"/>
    </svg>
  )
}