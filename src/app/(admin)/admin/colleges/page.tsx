import type { Metadata } from 'next'
import { adminGetCampuses, adminGetCampusExceptions } from '@/app/actions/admin.actions'
import { CampusManagementClient } from '@/components/admin/CampusManagementClient'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Colleges & Universities — Admin — ${APP_NAME}`,
}

export default async function AdminCollegesPage() {
  const [campusesResult, exceptionsResult] = await Promise.all([
    adminGetCampuses(),
    adminGetCampusExceptions(),
  ])

  const campuses = campusesResult.success && campusesResult.data ? campusesResult.data : []
  const exceptions = exceptionsResult.success && exceptionsResult.data ? exceptionsResult.data : []

  return (
    <CampusManagementClient
      initialCampuses={campuses}
      initialExceptions={exceptions}
    />
  )
}
