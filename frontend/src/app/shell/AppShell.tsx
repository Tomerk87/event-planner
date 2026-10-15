import {
  CalendarCheck,
  ChevronDown,
  LogOut,
  Menu as MenuIcon,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router'
import type { EventRole } from '../../domain/roles.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { Menu } from '../../shared/ui/Menu.tsx'
import { RoleIcon } from '../../shared/ui/RoleIcon.tsx'
import { DESKTOP_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
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
  /** Highlight only on this exact address, not on pages beneath it. */
  exact?: boolean
}

export interface ShellEvent {
  id: string
  name: string
  coverImage?: string | null
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
  /** Ends the session; offered in the user menu and, if asked, the sidebar. */
  onSignOut?: () => void
  /** Also show Log out at the foot of the sidebar (the homepage does). */
  signOutInSidebar?: boolean
  /** Shown in the top bar at every width. */
  banner?: ReactNode
  /** Shown in the top bar on desktop and inside the drawer below it. */
  tools?: ReactNode
  /** Shown above the page, such as a request to verify the email. */
  notice?: ReactNode
  /** The notification bell, beside the user menu at every width. */
  bell?: ReactNode
  /** On desktop, show the side menu as icons only. */
  collapsed?: boolean
  /** Offers the desktop button that collapses and expands the side menu. */
  onToggleCollapsed?: () => void
  children: ReactNode
}

function Logo() {
  const { t } = useTranslation()

  return (
    <Link to="/" className={styles.logo}>
      <span className={styles.logoMark} aria-hidden="true">
        <CalendarCheck />
      </span>
      <span className={styles.logoText}>{t('app.name')}</span>
    </Link>
  )
}

function NavItemLink({
  item,
  onNavigate,
  showTooltip = false,
}: {
  item: ShellNavItem
  onNavigate: () => void
  /** The label is hidden, so offer it on hover. */
  showTooltip?: boolean
}) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.exact}
      title={showTooltip ? item.label : undefined}
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

type SidebarContentProps = Omit<
  AppShellProps,
  'children' | 'user' | 'banner' | 'onToggleCollapsed'
> & {
  onNavigate: () => void
}

function SidebarContent({
  navLabel,
  navItems,
  footerLink,
  event,
  events = [],
  tools,
  onSignOut,
  signOutInSidebar = false,
  collapsed = false,
  onNavigate,
}: SidebarContentProps) {
  const { t } = useTranslation()

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
              <NavItemLink
                item={item}
                onNavigate={onNavigate}
                showTooltip={collapsed}
              />
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.sidebarFooter}>
        {tools}
        <LanguageSwitcher />
        {footerLink && (
          <NavItemLink
            item={footerLink}
            onNavigate={onNavigate}
            showTooltip={collapsed}
          />
        )}
        {signOutInSidebar && onSignOut && (
          <button
            type="button"
            title={collapsed ? t('nav.logOut') : undefined}
            className={cx(styles.navLink, styles.navButton)}
            onClick={() => {
              onNavigate()
              onSignOut()
            }}
          >
            <LogOut
              className={cx(styles.navIcon, styles.directional)}
              aria-hidden="true"
            />
            <span>{t('nav.logOut')}</span>
          </button>
        )}
      </div>
    </>
  )
}

function UserBadge({
  user,
  onSignOut,
}: {
  user: ShellUser
  onSignOut?: () => void
}) {
  const { t } = useTranslation()
  const role = user.role && (
    <span className={cx(styles.userRole, styles[`role${user.role}`])}>
      <RoleIcon role={user.role} />
      <span className="visually-hidden">
        {t('user.roleInEvent', { role: t(`roles.${user.role}`) })}
      </span>
    </span>
  )

  if (!onSignOut) {
    return (
      <div className={styles.user}>
        <Avatar name={user.name} />
        {role}
        <span className={styles.userName}>{user.name}</span>
      </div>
    )
  }

  return (
    <div className={styles.user}>
      {role}
      <Menu
        label={t('user.menu', { name: user.name })}
        triggerClassName={styles.userButton}
        items={[
          {
            id: 'logout',
            label: t('nav.logOut'),
            icon: <LogOut />,
            onSelect: onSignOut,
          },
        ]}
      >
        <Avatar name={user.name} />
        <span className={styles.userName}>{user.name}</span>
        <ChevronDown className={styles.userChevron} aria-hidden="true" />
      </Menu>
    </div>
  )
}

export function AppShell({
  user,
  banner,
  notice,
  bell,
  tools,
  collapsed = false,
  onToggleCollapsed,
  children,
  ...sidebar
}: AppShellProps) {
  const { onSignOut } = sidebar
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const { ref, requestClose, dialogProps } = useModalDialog(menuOpen, closeMenu)

  // The drawer belongs to the compact layout; drop it if the window widens.
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  if (isDesktop && menuOpen) {
    setMenuOpen(false)
  }
  const canCollapse = isDesktop && onToggleCollapsed !== undefined
  const isCollapsed = canCollapse && collapsed

  return (
    <div className={cx(styles.shell, isCollapsed && styles.collapsed)}>
      <a href="#main-content" className={styles.skipLink}>
        {t('nav.skipToContent')}
      </a>

      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Logo />
        </div>
        <SidebarContent
          {...sidebar}
          collapsed={isCollapsed}
          onNavigate={closeMenu}
        />
      </aside>

      <dialog
        ref={ref}
        className={styles.drawer}
        aria-label={t('nav.menu')}
        {...dialogProps}
      >
        {menuOpen && (
          <div className={styles.drawerSurface}>
            <div className={styles.sidebarHeader}>
              <Logo />
              <button
                type="button"
                className={styles.drawerClose}
                aria-label={t('nav.closeMenu')}
                onClick={requestClose}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <SidebarContent {...sidebar} tools={tools} onNavigate={closeMenu} />
          </div>
        )}
      </dialog>

      <div className={styles.column}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={cx(
              styles.menuButton,
              canCollapse && styles.menuButtonDesktop,
            )}
            aria-label={t(
              !canCollapse
                ? 'nav.openMenu'
                : isCollapsed
                  ? 'nav.expandMenu'
                  : 'nav.collapseMenu',
            )}
            aria-expanded={canCollapse ? !isCollapsed : undefined}
            onClick={canCollapse ? onToggleCollapsed : () => setMenuOpen(true)}
          >
            <MenuIcon aria-hidden="true" />
          </button>
          <div className={styles.topbarLogo}>
            <Logo />
          </div>
          <div className={styles.topbarEnd}>
            {banner}
            {isDesktop && tools}
            {bell}
            {user && <UserBadge user={user} onSignOut={onSignOut} />}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <div className={styles.content}>
            {notice && <div className={styles.notice}>{notice}</div>}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
