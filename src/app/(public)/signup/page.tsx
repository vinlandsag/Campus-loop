import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/SignupForm'
import { AuthForm } from '@/components/auth/AuthForm'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Sign Up — ${APP_NAME}`,
}

interface SignupPageProps {
  searchParams?: Promise<{ next?: string; callbackUrl?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const resolved = searchParams ? await searchParams : undefined
  const next = resolved?.next || resolved?.callbackUrl || null

  return (
    <AuthForm
      title="Create your account"
      description={`Join ${APP_NAME} and start discovering events.`}
      type="signup"
      next={next}
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-[--bg-muted]" />}>
        <SignupForm />
      </Suspense>
    </AuthForm>
  )
}
