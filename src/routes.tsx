import { ArrowLeft, Construction } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, Navigate, Outlet, Route, createBrowserRouter, createRoutesFromElements, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { logout, restoreSession, useSession } from '@/auth/session'

const AuthPage = lazy(() => import('@/auth/auth-page'))
const MyProfilePage = lazy(() => import('@/profile/profile-page').then(module => ({ default: module.MyProfilePage })))
const PublicProfilePage = lazy(() => import('@/profile/profile-page').then(module => ({ default: module.PublicProfilePage })))
const ProfileEditPage = lazy(() => import('@/profile/profile-edit').then(module => ({ default: module.ProfileEditPage })))

function SessionGate() {
  const session = useSession()
  if (session.status === 'loading') return <div className="session-screen"><LoadingSkeleton label="Проверяем сессию" /></div>
  if (session.status === 'unavailable') return <div className="session-screen"><ErrorState
    title="Не удалось проверить сессию" error={session.error} retry={() => void restoreSession()} /></div>
  if (session.status === 'signingOut') return <div className="session-screen"><LoadingSkeleton label="Завершаем сессию" /></div>
  if (session.status === 'logoutFailed') return <div className="session-screen"><ErrorState
    title="Не удалось завершить сессию" error={session.error} retry={() => void logout()} /></div>
  return <Suspense fallback={<div className="session-screen"><LoadingSkeleton /></div>}><Outlet /></Suspense>
}

function ProtectedRoutes() {
  const session = useSession()
  const location = useLocation()
  return session.status === 'authenticated'
    ? <AppShell />
    : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
}

function GuestRoutes() {
  const session = useSession()
  const { state } = useLocation()
  const candidate: unknown = state?.from
  const path = typeof candidate === 'string' && /^\/(?![/\\])/.test(candidate) &&
    !/^\/(login|register)([/?#]|$)/.test(candidate) ? candidate : '/dashboard'
  return session.status === 'authenticated' ? <Navigate to={path} replace /> : <Outlet />
}

const futureRoutes = [
  ['dashboard', 'Главная'], ['search', 'Поиск студентов'], ['recommendations', 'Рекомендации'], ['listings', 'Объявления'], ['listings/new', 'Новое объявление'],
  ['listings/my', 'Мои объявления'], ['listings/:id', 'Объявление'], ['listings/:id/edit', 'Редактирование объявления'],
  ['responses/my', 'Мои отклики'], ['messages', 'Сообщения'], ['messages/:conversationId', 'Переписка'],
  ['notifications', 'Уведомления'], ['settings', 'Настройки'],
] as const

function FuturePage({ title }: { title: string }) {
  return <>
    <h1 className="page-title">{title}</h1>
    <EmptyState title="Раздел в разработке" description="Этот раздел появится в одном из следующих этапов ITMO Buddy." icon={<Construction />} />
  </>
}

export const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<SessionGate />}>
    <Route element={<GuestRoutes />}>
      <Route path="login" element={<AuthPage key="login" mode="login" />} />
      <Route path="register" element={<AuthPage key="register" mode="register" />} />
    </Route>
    <Route element={<ProtectedRoutes />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="profile" element={<MyProfilePage />} />
      <Route path="profile/edit" element={<ProfileEditPage />} />
      <Route path="users/:userId" element={<PublicProfilePage />} />
      {futureRoutes.map(([path, title]) =>
        <Route key={path} path={path} element={<FuturePage title={title} />} />)}
      <Route path="*" element={<EmptyState title="Страница не найдена" description="Проверь адрес или вернись на главную."
        icon={<ArrowLeft />} action={<Button asChild><Link to="/dashboard">На главную</Link></Button>} />} />
    </Route>
  </Route>
))
