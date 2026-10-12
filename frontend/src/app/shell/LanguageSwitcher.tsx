import { ChevronDown, Globe } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { changeLanguage, getCurrentLanguage } from '../../i18n/i18n.ts'
import { isLanguage, LANGUAGES } from '../../i18n/languages.ts'
import { cx } from '../../shared/ui/cx.ts'
import styles from './AppShell.module.css'

interface LanguageSwitcherProps {
  /** `light` for pages without the dark sidebar. */
  tone?: 'sidebar' | 'light'
}

export function LanguageSwitcher({ tone = 'sidebar' }: LanguageSwitcherProps) {
  const { t } = useTranslation()
  const id = useId()

  return (
    <div
      className={cx(styles.language, tone === 'light' && styles.languageLight)}
    >
      <label htmlFor={id} className="visually-hidden">
        {t('language.label')}
      </label>
      <Globe className={styles.languageIcon} aria-hidden="true" />
      <select
        id={id}
        className={styles.languageSelect}
        value={getCurrentLanguage()}
        onChange={(event) => {
          if (isLanguage(event.target.value)) {
            void changeLanguage(event.target.value)
          }
        }}
      >
        {LANGUAGES.map((language) => (
          <option key={language} value={language} lang={language}>
            {t(`language.${language}`)}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.languageChevron} aria-hidden="true" />
    </div>
  )
}
