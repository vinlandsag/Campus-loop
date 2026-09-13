import type { Metadata } from 'next'
import { adminGetEvents } from '@/app/actions/admin.actions'
import { EventManagementClient } from '@/components/admin/EventManagementClient'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Events — Admin — ${APP_NAME}`,
}

export default async function AdminEventsPage() {
  const result = await adminGetEvents({ limit: 100 })
  const events = result.success && result.data ? result.data.events : []

  return <EventManagementClient initialEvents={events} />
}
