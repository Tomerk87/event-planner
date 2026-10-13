import { Globe } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { changeLanguage, getCurrentLanguage } from '../../i18n/i18n.ts'
import { isLanguage, LANGUAGES } from '../../i18n/languages.ts'
import { cx } from '../../shared/ui/cx.ts'
import { Select } from '../../shared/ui/Select.tsx'
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
      <Select
        id={id}
        className={styles.languageSelect}
        icon={<Globe />}
        value={getCurrentLanguage()}
        options={LANGUAGES.map((language) => ({
          value: language,
          label: t(`language.${language}`),
          lang: language,
        }))}
        onChange={(language) => {
          if (isLanguage(language)) {
            void changeLanguage(language)
          }
        }}
      />
    </div>
  )
}
