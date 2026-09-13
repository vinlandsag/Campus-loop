import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'
import { AuthForm } from '@/components/auth/AuthForm'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Sign In — ${APP_NAME}`,
}

interface LoginPageProps {
  searchParams?: Promise<{ next?: string; callbackUrl?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolved = searchParams ? await searchParams : undefined
  const next = resolved?.next || resolved?.callbackUrl || null

  return (
    <AuthForm
      title="Welcome back"
      description="Sign in to your account to continue"
      type="login"
      next={next}
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-[--bg-muted]" />}>
        <LoginForm />
      </Suspense>
    </AuthForm>
  )
}
