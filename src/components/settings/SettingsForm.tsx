'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateProfile } from '@/lib/actions/settings'

interface SettingsFormProps {
  initialFullName: string
}

export function SettingsForm({ initialFullName }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.error) {
        // Simple alert for now, could use toast in the future
        alert(result.error)
      } else {
        alert('Profile updated successfully!')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="full_name" className="text-sm font-medium text-[--text-primary]">
          Full Name
        </label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          defaultValue={initialFullName}
          required
          className="max-w-md"
        />
        <p className="text-xs text-[--text-muted]">
          This is the name that will be displayed on your profile and registrations.
        </p>
      </div>

      <div>
        <Button type="submit" disabled={isPending} size="default">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  )
}
