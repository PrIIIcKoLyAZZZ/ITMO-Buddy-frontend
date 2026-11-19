import { Bell, Compass, House, LogOut, Menu, MessageCircle, Settings, Sparkles, UserRound, PanelsTopLeft } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { logout } from '@/auth/session'
import { ConfirmDialog, UserAvatar } from './states'
import { Button } from './ui/button'

const navigation = [
  { to: '/dashboard', label: 'Главная', icon: House },
  { to: '/search', label: 'Поиск', icon: Compass, mobile: true },
  { to: '/recommendations', label: 'Рекомендации', icon: Sparkles, mobile: true },
  { to: '/listings', label: 'Объявления', icon: PanelsTopLeft, mobile: true },
  { to: '/messages', label: 'Сообщения', icon: MessageCircle, mobile: true },
  { to: '/notifications', label: 'Уведомления', icon: Bell },
  { to: '/profile', label: 'Профиль', icon: UserRound },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

function NavigationLinks({ mobile }: { mobile?: boolean }) {
  return navigation.filter(item => !mobile || item.mobile).map(({ to, label, icon: Icon }) =>
    <NavLink className="nav-link" to={to} key={to}><Icon size={20} aria-hidden="true" /><span>{label}</span></NavLink>,
  )
}

function LogoutButton() {
  return <ConfirmDialog
    trigger={<Button type="button" variant="ghost"><LogOut size={18} aria-hidden="true" /> Выйти</Button>}
    title="Выйти из аккаунта?"
    description="Чтобы снова открыть личные разделы, войди в аккаунт."
    confirmLabel="Выйти"
    onConfirm={() => { void logout() }}
  />
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <Link to="/dashboard"><img src="/logo.svg" alt="ITMO Buddy — главная" width="183" height="48" /></Link>
      <nav aria-label="Основная навигация"><NavigationLinks /></nav>
      <div className="sidebar-footer"><LogoutButton /></div>
    </aside>
  )
}

export function MobileNavigation() {
  return <nav className="mobile-nav" aria-label="Быстрая навигация"><NavigationLinks mobile /></nav>
}

export function Header() {
  const location = useLocation()
  return (
    <header className="app-header">
      <Link to="/dashboard" className="header-mark"><img src="/logo-mark.svg" alt="ITMO Buddy — главная" width="40" height="40" /></Link>
      <span className="header-label">Студенческое сообщество</span>
      <div className="header-actions">
        <Button asChild variant="ghost" className="px-3"><Link aria-label="Уведомления" to="/notifications"><Bell size={20} /></Link></Button>
        <Link to="/profile" aria-label="Мой профиль"><UserAvatar /></Link>
        <details key={location.key} className="header-menu">
          <summary aria-label="Открыть меню"><Menu size={22} /></summary>
          <div className="header-menu-panel">
            <nav aria-label="Все разделы"><NavigationLinks /></nav>
            <LogoutButton />
          </div>
        </details>
      </div>
    </header>
  )
}

export function AppShell() {
  return (
    <div className="app-shell">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">К содержанию</a>
      <Sidebar />
      <div className="app-column">
        <Header />
        <main id="workspace" className="workspace"><Outlet /></main>
      </div>
      <MobileNavigation />
    </div>
  )
}
