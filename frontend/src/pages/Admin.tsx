import { useTranslation } from '../lib/i18n'

export default function AdminPage() {
  const { t: translate } = useTranslation()
  
  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-[#00F2FF] font-mono">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          {translate('admin.title')}
        </h1>
        <p className="opacity-50 text-sm" dangerouslySetInnerHTML={{ __html: translate('admin.comingSoon') }}></p>
        <a href="/" className="mt-6 inline-block text-xs opacity-40 hover:opacity-70 underline">{translate('admin.back')}</a>
      </div>
    </div>
  )
}
