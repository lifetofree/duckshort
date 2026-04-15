import Layout from '../Layout'

export default function NotFound() {
  return (
    <Layout title="404 | DuckShort">
      <div class="container" style="text-align: center; padding-top: 4rem;">
        <h1 style="font-size: 6rem; color: #FF0055; text-shadow: 0 0 30px #FF0055;">404</h1>
        <p style="font-size: 1.5rem; margin: 1rem 0;">Page not found</p>
        <a href="/" style="color: #00F22FF; text-decoration: underline;">Back to home</a>
      </div>
    </Layout>
  )
}