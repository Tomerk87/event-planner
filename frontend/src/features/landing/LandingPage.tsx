import {
  ArrowRight,
  Armchair,
  CalendarCheck,
  LogIn,
  Mail,
  Menu as MenuIcon,
  MessageCircle,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LanguageSwitcher } from '../../app/shell/LanguageSwitcher.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { Menu } from '../../shared/ui/Menu.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useDocumentTitle } from '../../shared/useDocumentTitle.ts'
import styles from './LandingPage.module.css'
import { ProductPreview } from './ProductPreview.tsx'
import { useSession } from '../../app/session/sessionContext.ts'
import { useEnterDemo } from './useEnterDemo.ts'

const FEATURES = [
  { id: 'guests', icon: Users, tone: 'violet' },
  { id: 'rsvp', icon: Mail, tone: 'blue' },
  { id: 'whatsapp', icon: MessageCircle, tone: 'green' },
  { id: 'seating', icon: Armchair, tone: 'violet' },
] as const satisfies readonly { id: string; icon: LucideIcon; tone: string }[]

export function LandingPage() {
  const { t } = useTranslation()
  const demo = useEnterDemo()
  const { demoAvailable, accountsAvailable, demoEnded } = useSession()
  useDocumentTitle(t('landing.documentTitle'))

  const tryDemo = (size: 'md' | 'lg' = 'md') => (
    <Button
      size={size}
      icon={<ArrowRight />}
      iconPosition="end"
      loading={demo.isPending}
      onClick={demo.enter}
    >
      {t('landing.tryDemo')}
    </Button>
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <CalendarCheck aria-hidden="true" />
          <span>{t('app.name')}</span>
        </Link>
        <nav aria-label={t('landing.nav')} className={styles.headerNav}>
          <a href="#features" className={styles.headerLink}>
            {t('landing.features.link')}
          </a>
        </nav>
        <div className={styles.headerEnd}>
          <div className={styles.language}>
            <LanguageSwitcher tone="light" />
          </div>
          {accountsAvailable ? (
            <>
              <div className={styles.headerActions}>
                <ButtonLink to="/signin" variant="secondary">
                  {t('auth.signIn.action')}
                </ButtonLink>
                <ButtonLink to="/signup" variant="soft">
                  {t('auth.signUp.action')}
                </ButtonLink>
                {demoAvailable && tryDemo()}
              </div>
              <div className={styles.headerMenu}>
                <Menu
                  label={t('nav.openMenu')}
                  triggerClassName={styles.menuButton}
                  items={[
                    {
                      id: 'signin',
                      label: t('auth.signIn.action'),
                      icon: <LogIn />,
                      to: '/signin',
                    },
                    {
                      id: 'signup',
                      label: t('auth.signUp.action'),
                      icon: <UserPlus />,
                      to: '/signup',
                    },
                    ...(demoAvailable
                      ? [
                          {
                            id: 'demo',
                            label: t('landing.tryDemo'),
                            icon: <Sparkles />,
                            onSelect: demo.enter,
                          },
                        ]
                      : []),
                  ]}
                >
                  <MenuIcon aria-hidden="true" />
                </Menu>
              </div>
            </>
          ) : (
            // A demo-only site (D102): Try Demo is the one action; on a
            // phone the hero's button is just below.
            <div className={styles.headerActions}>{tryDemo()}</div>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className={styles.main}>
        {demoEnded && (
          // The demo ended on its own (D99); say why, and offer a new one.
          <Notice
            tone="info"
            title={t('demo.ended.title')}
            action={demoAvailable ? tryDemo() : undefined}
            announce
          >
            {t(`demo.ended.${demoEnded}`)}
          </Notice>
        )}
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.headline}>
              {t('landing.headline.first')}{' '}
              <span className={styles.headlineAccent}>
                {t('landing.headline.second')}
              </span>
            </h1>
            <p className={styles.lead}>{t('landing.lead')}</p>
            <div className={styles.heroActions}>
              {demoAvailable ? (
                tryDemo('lg')
              ) : (
                <ButtonLink to="/signup" size="lg">
                  {t('auth.signUp.action')}
                </ButtonLink>
              )}
              {accountsAvailable && (
                <ButtonLink to="/signin" variant="secondary" size="lg">
                  {t('auth.signIn.action')}
                </ButtonLink>
              )}
            </div>
            {demoAvailable && (
              <p className={styles.note}>
                <Sparkles aria-hidden="true" />
                {t(accountsAvailable ? 'landing.note' : 'landing.previewNote')}
              </p>
            )}
          </div>
          <ProductPreview />
        </section>

        <section
          id="features"
          className={styles.features}
          aria-labelledby="features-title"
        >
          <h2 id="features-title" className="visually-hidden">
            {t('landing.features.title')}
          </h2>
          <ul className={styles.featureList}>
            {FEATURES.map(({ id, icon: Icon, tone }) => (
              <li key={id} className={styles.feature}>
                <span
                  className={cx(styles.featureIcon, styles[tone])}
                  aria-hidden="true"
                >
                  <Icon />
                </span>
                <div>
                  <h3 className={styles.featureTitle}>
                    {t(`landing.features.${id}.title`)}
                  </h3>
                  <p className={styles.featureBody}>
                    {t(`landing.features.${id}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {demoAvailable && (
          <section className={styles.band} aria-labelledby="demo-band-title">
            <div>
              <h2 id="demo-band-title" className={styles.bandTitle}>
                {t('landing.band.title')}
              </h2>
              <p className={styles.bandBody}>{t('landing.band.body')}</p>
            </div>
            {tryDemo()}
          </section>
        )}
      </main>
    </div>
  )
}
