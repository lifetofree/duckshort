import { Html, Head, Body, Scripts } from 'hono/html'

interface Props {
  title: string
  children?: any
}

export default function Layout({ title, children }: Props) {
  return (
    <Html lang="en">
      <Head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'JetBrains Mono', monospace; 
            background: #0B0E14; 
            color: #00F2FF; 
            min-height: 100vh;
          }
          h1, h2, h3 { font-family: 'Orbitron', sans-serif; }
          .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
          .btn {
            background: #FF0055;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-family: 'Orbitron', sans-serif;
            cursor: pointer;
            border-radius: 4px;
          }
          .btn:hover { opacity: 0.9; }
          .grid-bg {
            background: linear-gradient(rgba(0,242,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,242,255,0.03) 1px, transparent 1px);
            background-size: 50px 50px;
          }
        `}</style>
      </Head>
      <Body class="grid-bg">
        {children}
        <Scripts />
      </Body>
    </Html>
  )
}