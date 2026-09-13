'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const fullName = formData.get('full_name')?.toString()

  if (!fullName || fullName.trim() === '') {
    return { error: 'Full name is required' }
  }

  // Update public.profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', user.id)

  if (profileError) {
    console.error('Profile update error:', profileError)
    return { error: 'Failed to update profile' }
  }

  // Update auth.users metadata for the session
  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: fullName.trim() }
  })

  if (authError) {
    console.error('Auth update error:', authError)
    return { error: 'Failed to update auth metadata' }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  
  return { success: true }
}
