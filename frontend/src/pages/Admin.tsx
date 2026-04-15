export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-[#00F2FF] font-mono">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Admin
        </h1>
        <p className="opacity-50 text-sm">Coming soon — use the Worker SSR admin at <a href="/admin-ssr" className="underline">/admin-ssr</a></p>
        <a href="/" className="mt-6 inline-block text-xs opacity-40 hover:opacity-70 underline">← Back</a>
      </div>
    </div>
  )
}
