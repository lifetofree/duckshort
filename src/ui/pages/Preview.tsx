/** @jsxImportSource hono/jsx */
import Layout from '../Layout'

interface Props {
  id: string
  destination: string
}

export default function Preview({ id, destination }: Props) {
  return (
    <Layout title="DuckShort | Preview">
      <div class="container" style="text-align: center; padding-top: 6rem;">
        <h1 style="font-size: 1.5rem; margin-bottom: 0.5rem; opacity: 0.6; font-family: 'JetBrains Mono', monospace;">
          You are about to visit
        </h1>
        <p style="font-size: 1rem; word-break: break-all; background: #1a1f2e; border: 1px solid #00F2FF; padding: 1rem; border-radius: 4px; margin: 1.5rem auto; max-width: 600px;">
          {destination}
        </p>
        <a
          href={`/${id}`}
          style="display: inline-block; padding: 0.85rem 2rem; background: #FF0055; color: white; text-decoration: none; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: bold;"
        >
          Proceed
        </a>
        <p style="margin-top: 1.5rem; font-size: 0.8rem; opacity: 0.4;">
          DuckShort does not control the destination. Visit only if you trust the source.
        </p>
      </div>
    </Layout>
  )
}
