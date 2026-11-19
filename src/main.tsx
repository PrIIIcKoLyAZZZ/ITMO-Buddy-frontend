import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { restoreSession } from '@/auth/session'
import { queryClient } from '@/lib/query'
import { router } from './routes'
import './index.css'

const realtime = import('@/realtime/service')
  .then(({ startRealtime }) => startRealtime(path => { void router.navigate(path) }))
  .catch(() => undefined)
if (import.meta.hot) import.meta.hot.dispose(() => { void realtime.then(stop => stop?.()) })
void restoreSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  </StrictMode>,
)
