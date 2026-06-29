import { createContext, useContext, useState, ReactNode } from 'react'
import enTranslations from '../locales/lang-en.json'
import thTranslations from '../locales/lang-th.json'

type TranslationParams = Record<string, string | number>
export type { TranslationParams }

export type Locale = 'en' | 'th'

interface Translations {
  [key: string]: string | Translations
}

interface I18nContextType {
  t: (key: string, params?: TranslationParams) => string
  locale: Locale
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const translationsMap: Record<Locale, Translations> = {
  en: enTranslations as Translations,
  th: thTranslations as Translations,
}

// Helper function to get nested value from object using dot notation
function getNestedValue(obj: Translations, path: string): string | Translations | undefined {
  const keys = path.split('.')
  let current: Translations | string | undefined = obj
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return undefined
    }
  }
  
  return current
}

// Replace {{param}} placeholders with actual values
function replaceParams(text: string, params?: TranslationParams): string {
  if (!params) return text
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match
  })
}

export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem('duckshort_locale')
      if (saved === 'en' || saved === 'th') {
        return saved
      }
    } catch {
      // Ignored
    }
    return 'en'
  })

  const setLocale = (newLocale: Locale) => {
    if (newLocale === 'en' || newLocale === 'th') {
      setLocaleState(newLocale)
      try {
        localStorage.setItem('duckshort_locale', newLocale)
      } catch {
        // Ignored
      }
    }
  }

  const t = (key: string, params?: TranslationParams): string => {
    // Attempt lookup in the current locale
    let value = getNestedValue(translationsMap[locale], key)
    
    // Fallback to English if not found and current locale is not English
    if (value === undefined && locale !== 'en') {
      value = getNestedValue(translationsMap['en'], key)
    }
    
    if (value === undefined) {
      console.warn(`Translation key not found: ${key}`)
      return key
    }
    
    if (typeof value === 'string') {
      return replaceParams(value, params)
    }
    
    console.warn(`Translation key is not a string: ${key}`)
    return key
  }

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return context
}
