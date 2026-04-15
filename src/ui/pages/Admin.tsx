/** @jsxImportSource hono/jsx */
import Layout from '../Layout'
import config from '../config.json'

export default function Admin() {
  const { admin, theme } = config
  return (
    <Layout title={admin.title}>
      <div class="container">
        <h1 style="margin-bottom: 2rem;">{admin.heading}</h1>
        <div id="login-form">
          <input type="password" id="secret" placeholder={admin.secret_placeholder} 
            style={`padding: 0.75rem; background: ${theme.colors.card}; border: 1px solid ${theme.colors.primary}; color: ${theme.colors.primary}; border-radius: 4px; margin-right: 0.5rem;`} />
          <button onclick="login()" class="btn">{admin.login_button}</button>
        </div>
        <div id="admin-content" style="display: none;">
          <button onclick="logout()" class="btn" style="margin-bottom: 1rem; background: #333;">{admin.logout_button}</button>
          <div id="links-list"></div>
        </div>
      </div>
      <script src="/assets/admin.js"></script>
    </Layout>
  )
}