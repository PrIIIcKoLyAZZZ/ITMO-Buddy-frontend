import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { restoreSession } from '@/auth/session'
import { queryClient } from '@/lib/query'
import { AppRoutes } from './routes'
import './index.css'

void restoreSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><AppRoutes /></BrowserRouter>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  </StrictMode>,
)
