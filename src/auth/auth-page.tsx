import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, LoaderCircle, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '@/api/http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authenticate } from './session'

const common = z.object({
  email: z.string().trim().max(254, 'До 254 символов.').email('Введите корректный email.'),
  password: z.string().refine(value => value.trim().length > 0, 'Введите пароль.'),
  consentToPersonalDataProcessing: z.boolean(),
})

const registration = common.extend({
  password: common.shape.password
    .refine(value => value.length >= 8 && /\p{L}/u.test(value) && /\p{Nd}/u.test(value),
      'Нужно минимум 8 символов, включая букву и цифру.')
    .refine(value => !/[\uD800-\uDFFF]/u.test(value) && new TextEncoder().encode(value).length <= 72,
      'Пароль должен занимать до 72 байт UTF-8.'),
  consentToPersonalDataProcessing: z.boolean().refine(Boolean, 'Для регистрации нужно согласие.'),
})

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<z.input<typeof common>, unknown, z.output<typeof common>>({
      resolver: zodResolver(isRegister ? registration : common),
      defaultValues: { email: '', password: '', consentToPersonalDataProcessing: false },
    })

  const submit = handleSubmit(async ({ email, password, consentToPersonalDataProcessing }) => {
    try {
      await authenticate(mode, isRegister ? { email, password, consentToPersonalDataProcessing } : { email, password })
    } catch (error) {
      let message = 'Не удалось выполнить запрос. Попробуйте ещё раз.'
      if (error instanceof ApiError) {
        message = error.status === 401 && !isRegister ? 'Проверьте email и пароль.' : error.message
        if (error.status === 409 && error.payload?.code === 'auth.email_taken') {
          message = 'Этот адрес email уже зарегистрирован.'
        }
        if (error.status === 400) {
          for (const entry of error.payload?.validationErrors ?? []) {
            const field = entry.field.toLowerCase()
            const text = entry.messages.join(' ')
            if (field === 'email') setError('email', { message: text })
            if (field === 'password') setError('password', { message: text })
            if (field === 'consenttopersonaldataprocessing' && isRegister) {
              setError('consentToPersonalDataProcessing', { message: text })
            }
          }
        }
      }
      setError('root', { message })
    }
  })

  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <img src="/logo.svg" alt="ITMO Buddy" width="192" height="48" />
        <div className="aside-content">
          <Sparkles className="aside-icon" aria-hidden="true" />
          <p>Найди своих<br />в ИТМО<span>.</span></p>
          <div className="aside-description">Знакомься со студентами, собирай команду на проект и находи события по интересам.</div>
        </div>
        <div className="orbit" aria-hidden="true"><i /><i /><i /><b /><b /></div>
      </aside>
      <main className="auth-main">
        <img className="mobile-logo" src="/logo.svg" alt="ITMO Buddy" width="192" height="48" />
        <section className="auth-card" aria-labelledby="auth-title">
          <h1 id="auth-title">{isRegister ? 'Создать аккаунт' : 'Войти в ITMO Buddy'}</h1>
          <p className="auth-intro">{isRegister ? 'Укажи email и придумай пароль.' : 'Введи email и пароль своего аккаунта.'}</p>
          <form className="space-y-4" onSubmit={submit} noValidate>
            <fieldset disabled={isSubmitting} className="space-y-4">
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <Input id="email" type="email" autoComplete="email" placeholder="name@example.com"
                  aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
                {errors.email && <p id="email-error" className="field-error">{errors.email.message}</p>}
              </div>
              <div className="form-field">
                <label htmlFor="password">Пароль</label>
                <div className="relative">
                  <Input id="password" className="pr-12" type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')} />
                  <Button type="button" variant="ghost" className="absolute right-1 top-0.5 px-2.5"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </Button>
                </div>
                {errors.password && <p id="password-error" className="field-error">{errors.password.message}</p>}
              </div>
              {isRegister && <div className="form-field">
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input className="mt-0.5 size-5 shrink-0 accent-primary" type="checkbox"
                    aria-invalid={!!errors.consentToPersonalDataProcessing}
                    aria-describedby={errors.consentToPersonalDataProcessing ? 'consent-error' : undefined}
                    {...register('consentToPersonalDataProcessing')} />
                  Даю согласие на обработку персональных данных для регистрации и использования сервиса
                </label>
                {errors.consentToPersonalDataProcessing && <p id="consent-error" className="field-error">{errors.consentToPersonalDataProcessing.message}</p>}
              </div>}
              {errors.root && <p className="form-error" role="alert">{errors.root.message}</p>}
              <Button type="submit" className="min-h-12 w-full">
                {isSubmitting ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
                {isSubmitting ? 'Отправляем запрос…' : isRegister ? 'Зарегистрироваться' : 'Войти'}
              </Button>
            </fieldset>
          </form>
          <p className="auth-switch">{isRegister ? 'Уже есть аккаунт?' : 'Впервые здесь?'}{' '}
            <Link to={isRegister ? '/login' : '/register'} state={location.state}>
              {isRegister ? 'Войти' : 'Создать аккаунт'}
            </Link>
          </p>
        </section>
      </main>
    </div>
  )
}
