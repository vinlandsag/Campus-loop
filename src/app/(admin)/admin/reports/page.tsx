import type { Metadata } from 'next'
import { adminGetReports } from '@/app/actions/admin.actions'
import { ReportManagementClient } from '@/components/admin/ReportManagementClient'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Moderation Reports — Admin — ${APP_NAME}`,
}

export default async function AdminReportsPage() {
  const result = await adminGetReports({ limit: 100 })
  const reports = result.success && result.data ? result.data.reports : []

  return <ReportManagementClient initialReports={reports} />
}
