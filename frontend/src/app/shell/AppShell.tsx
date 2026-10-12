import { CalendarCheck, Menu, X, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router'
import type { EventRole } from '../../domain/roles.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { RoleIcon } from '../../shared/ui/RoleIcon.tsx'
import { useModalDialog } from '../../shared/ui/useModalDialog.ts'
import styles from './AppShell.module.css'
import { EventSelector } from './EventSelector.tsx'
import { LanguageSwitcher } from './LanguageSwitcher.tsx'

export interface ShellNavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Mirror the icon in right-to-left layouts (arrows that mean back/forward). */
  directional?: boolean
}

export interface ShellEvent {
  id: string
  name: string
}

export interface ShellUser {
  name: string
  /** The user's role in the current event; omit outside an event. */
  role?: EventRole
}

interface AppShellProps {
  navLabel: string
  navItems: ShellNavItem[]
  footerLink?: ShellNavItem
  event?: ShellEvent
  events?: ShellEvent[]
  user?: ShellUser
  children: ReactNode
}

function Logo() {
  const { t } = useTranslation()

  return (
    <Link to="/" className={styles.logo}>
      <span className={styles.logoMark} aria-hidden="true">
        <CalendarCheck />
      </span>
      <span>{t('app.name')}</span>
    </Link>
  )
}

function NavItemLink({
  item,
  onNavigate,
}: {
  item: ShellNavItem
  onNavigate: () => void
}) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end
      className={({ isActive }) =>
        cx(styles.navLink, isActive && styles.navLinkActive)
      }
      onClick={onNavigate}
    >
      <Icon
        className={cx(styles.navIcon, item.directional && styles.directional)}
        aria-hidden="true"
      />
      <span>{item.label}</span>
    </NavLink>
  )
}

type SidebarContentProps = Omit<AppShellProps, 'children' | 'user'> & {
  onNavigate: () => void
}

function SidebarContent({
  navLabel,
  navItems,
  footerLink,
  event,
  events = [],
  onNavigate,
}: SidebarContentProps) {
  return (
    <>
      {event && (
        <EventSelector
          current={event}
          events={events}
          onNavigate={onNavigate}
        />
      )}
      <nav aria-label={navLabel} className={styles.nav}>
        <ul className={styles.navList}>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavItemLink item={item} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.sidebarFooter}>
        <LanguageSwitcher />
        {footerLink && (
          <NavItemLink item={footerLink} onNavigate={onNavigate} />
        )}
      </div>
    </>
  )
}

function UserBadge({ user }: { user: ShellUser }) {
  const { t } = useTranslation()

  return (
    <div className={styles.user}>
      <Avatar name={user.name} />
      {user.role && (
        <span className={cx(styles.userRole, styles[`role${user.role}`])}>
          <RoleIcon role={user.role} />
          <span className="visually-hidden">
            {t('user.roleInEvent', { role: t(`roles.${user.role}`) })}
          </span>
        </span>
      )}
      <span className={styles.userName}>{user.name}</span>
    </div>
  )
}

export function AppShell({ user, children, ...sidebar }: AppShellProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const { ref, onBackdropClick } = useModalDialog(menuOpen, closeMenu)

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        {t('nav.skipToContent')}
      </a>

      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Logo />
        </div>
        <SidebarContent {...sidebar} onNavigate={closeMenu} />
      </aside>

      <dialog
        ref={ref}
        className={styles.drawer}
        aria-label={t('nav.menu')}
        onClose={closeMenu}
        onClick={onBackdropClick}
      >
        {menuOpen && (
          <div className={styles.drawerSurface}>
            <div className={styles.sidebarHeader}>
              <Logo />
              <button
                type="button"
                className={styles.drawerClose}
                aria-label={t('nav.closeMenu')}
                onClick={closeMenu}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <SidebarContent {...sidebar} onNavigate={closeMenu} />
          </div>
        )}
      </dialog>

      <div className={styles.column}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label={t('nav.openMenu')}
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <div className={styles.topbarLogo}>
            <Logo />
          </div>
          <div className={styles.topbarEnd}>
            {user && <UserBadge user={user} />}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  )
}
