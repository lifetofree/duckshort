/** @jsxImportSource hono/jsx */
import Layout from '../Layout'

interface Props {
  id: string
  error: string | null
}

export default function PasswordEntry({ id, error }: Props) {
  return (
    <Layout title="DuckShort | Protected Link">
      <div class="container" style="text-align: center; padding-top: 6rem;">
        <h1 style="font-size: 2rem; margin-bottom: 0.5rem; text-shadow: 0 0 20px #00F2FF;">
          Protected Link
        </h1>
        <p style="opacity: 0.6; margin-bottom: 2rem; font-size: 0.9rem;">
          This link requires a password to continue.
        </p>

        {error && (
          <p style="color: #FF0055; margin-bottom: 1rem; font-size: 0.9rem;">{error}</p>
        )}

        <form method="post" action={`/password/${id}`} style="max-width: 360px; margin: 0 auto;">
          <input
            type="password"
            name="password"
            placeholder="Enter password"
            required
            autofocus
            style="width: 100%; padding: 0.75rem 1rem; background: #1a1f2e; border: 1px solid #00F2FF; color: #00F2FF; border-radius: 4px; font-family: 'JetBrains Mono', monospace; margin-bottom: 0.75rem;"
          />
          <button
            type="submit"
            style="width: 100%; padding: 0.75rem; background: #FF0055; color: white; border: none; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: bold; cursor: pointer;"
          >
            Unlock
          </button>
        </form>
      </div>
    </Layout>
  )
}
