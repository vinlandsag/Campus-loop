import type { Metadata } from 'next'
import { adminGetOrganizers } from '@/app/actions/admin.actions'
import { OrganizerManagementClient } from '@/components/admin/OrganizerManagementClient'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Organizer Management — Admin — ${APP_NAME}`,
}

export default async function AdminOrganizersPage() {
  const result = await adminGetOrganizers({ limit: 100 })
  const organizers = result.success && result.data ? result.data.organizers : []

  return <OrganizerManagementClient initialOrganizers={organizers} />
}
