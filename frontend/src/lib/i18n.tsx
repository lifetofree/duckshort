import { createContext, useContext, ReactNode } from 'react'
import enTranslations from '../locales/lang-en.json'

type TranslationParams = Record<string, string | number>

interface Translations {
  [key: string]: string | Translations
}

interface I18nContextType {
  t: (key: string, params?: TranslationParams) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

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
  const t = (key: string, params?: TranslationParams): string => {
    const value = getNestedValue(enTranslations as Translations, key)
    
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
    <I18nContext.Provider value={{ t }}>
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
