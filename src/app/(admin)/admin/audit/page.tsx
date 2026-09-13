import type { Metadata } from 'next'
import { adminGetAuditLog } from '@/app/actions/admin.actions'
import { AuditLogClient } from '@/components/admin/AuditLogClient'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Audit Log — Admin — ${APP_NAME}`,
}

export default async function AdminAuditPage() {
  const result = await adminGetAuditLog({ limit: 100 })
  const entries = result.success && result.data ? result.data.entries : []

  return <AuditLogClient initialEntries={entries} />
}
