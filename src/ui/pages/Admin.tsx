import Layout from '../Layout'

export default function Admin() {
  return (
    <Layout title="DuckShort Admin">
      <div class="container">
        <h1 style="margin-bottom: 2rem;">Admin Dashboard</h1>
        <div id="login-form">
          <input type="password" id="secret" placeholder="Admin Secret" 
            style="padding: 0.75rem; background: #1a1f2e; border: 1px solid #00F2FF; color: #00F2FF; border-radius: 4px; margin-right: 0.5rem;" />
          <button onclick="login()" class="btn">Login</button>
        </div>
        <div id="admin-content" style="display: none;">
          <button onclick="logout()" class="btn" style="margin-bottom: 1rem; background: #333;">Logout</button>
          <div id="links-list"></div>
        </div>
      </div>
      <script src="/assets/admin.js"></script>
    </Layout>
  )
}