'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'
import { GraduationCap, Users } from 'lucide-react'

import { signupSchema, type SignupFormData } from '@/lib/validations/auth.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/auth/PasswordInput'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { Database } from '@/types/database.types'

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const rawNext = searchParams.get('next') || searchParams.get('callbackUrl')
  const safeNext = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'student',
    },
  })

  async function onSubmit(data: SignupFormData) {
    setIsLoading(true)
    const supabase = createBrowserClient<Database>(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
    )

    // Pass role and requested_role in metadata.
    // Database trigger assigns role = 'organizer' (if chosen) with is_verified = false (pending approval).
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          role: data.role,
          requested_role: data.role,
        },
      },
    })

    setIsLoading(false)

    if (error) {
      if (error.message.includes('User already registered')) {
        form.setError('email', { message: 'This email is already registered' })
      } else {
        toast.error('Signup failed', {
          description: error.message,
        })
      }
      return
    }

    if (data.role === 'organizer') {
      toast.success('Organizer account created!', {
        description: 'Welcome to CampusLoop! Your organizer dashboard is ready.',
      })
    } else {
      toast.success('Account created successfully', {
        description: 'Welcome to CampusLoop!',
      })
    }
    
    // Redirect to specified destination (e.g. returning to the event page) or default dashboard/events
    const destination = safeNext || (data.role === 'organizer' ? '/dashboard' : '/events')
    router.push(destination)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  placeholder="Alex Johnson"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>I am joining as a…</FormLabel>
              <FormControl>
                <div
                  role="radiogroup"
                  aria-label="Account Role"
                  className="grid grid-cols-2 gap-3"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={field.value === 'student'}
                    onClick={() => field.onChange('student')}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${
                      field.value === 'student'
                        ? 'border-[--accent-500] bg-[--accent-50] text-[--accent-700] ring-2 ring-[--accent-500]/20 shadow-sm dark:bg-[--accent-950]/50 dark:border-[--accent-600] dark:text-[--accent-300]'
                        : 'border-[--border-default] bg-[--bg-surface] text-[--text-secondary] hover:border-[--border-strong] hover:bg-[--bg-muted] hover:text-[--text-primary]'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={field.value === 'organizer'}
                    onClick={() => field.onChange('organizer')}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-all ${
                      field.value === 'organizer'
                        ? 'border-[--accent-500] bg-[--accent-50] text-[--accent-700] ring-2 ring-[--accent-500]/20 shadow-sm dark:bg-[--accent-950]/50 dark:border-[--accent-600] dark:text-[--accent-300]'
                        : 'border-[--border-default] bg-[--bg-surface] text-[--text-secondary] hover:border-[--border-strong] hover:bg-[--bg-muted] hover:text-[--text-primary]'
                    }`}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    <span>Organizer</span>
                  </button>
                </div>
              </FormControl>
              {field.value === 'organizer' && (
                <div className="rounded-lg border border-[--accent-200] bg-[--accent-50]/60 p-2.5 text-xs text-[--accent-800] dark:border-[--accent-800] dark:bg-[--accent-950]/40 dark:text-[--accent-300]">
                  <p className="font-medium">Organizer Account</p>
                  <p className="mt-0.5 opacity-90">
                    You will have full access to the Organizer Dashboard to create, publish, and manage events for your campus.
                  </p>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>
    </Form>
  )
}
