/** @jsxImportSource hono/jsx */

interface Props {
  title: string
  ogDescription?: string
  ogImage?: string
  ogUrl?: string
  children?: any
}

export default function Layout({ title, ogDescription, ogImage, ogUrl, children }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        {ogDescription && <meta property="og:description" content={ogDescription} />}
        {ogImage && <meta property="og:image" content={ogImage} />}
        {ogUrl && <meta property="og:url" content={ogUrl} />}
        {ogDescription && <meta name="description" content={ogDescription} />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --bg-primary: #0a0a0f;
            --bg-secondary: #12121a;
            --bg-tertiary: #1a1a25;
            --neon-cyan: #00f5ff;
            --neon-magenta: #ff00ff;
            --neon-purple: #bf00ff;
            --text-primary: #ffffff;
            --text-secondary: #a0a0b0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'JetBrains Mono', monospace; 
            background: var(--bg-primary); 
            color: var(--text-primary); 
            min-height: 100vh;
            overflow-x: hidden;
          }
          h1, h2, h3 { font-family: 'Orbitron', sans-serif; }
          .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
          
          .glass-card {
            background: rgba(18, 18, 26, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 242, 255, 0.1);
          }

          .grid-bg {
            background: linear-gradient(rgba(0, 242, 255, 0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 242, 255, 0.05) 1px, transparent 1px);
            background-size: 40px 40px;
            background-color: var(--bg-primary);
          }

          .neon-glow-cyan {
            text-shadow: 0 0 10px var(--neon-cyan);
          }
          .neon-glow-magenta {
            text-shadow: 0 0 10px var(--neon-magenta);
          }
        `}</style>
      </head>
      <body class="grid-bg">
        {children}
      </body>
    </html>
  )
}
