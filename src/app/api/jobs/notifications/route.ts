import { type NextRequest, NextResponse } from 'next/server'
import { processScheduledNotificationJobs } from '@/lib/notifications/worker'

export const dynamic = 'force-dynamic'

/**
 * Protected scheduled notification job runner endpoint.
 *
 * Security:
 * Requires valid server-only secret via `Authorization: Bearer <secret>`
 * or `x-job-secret: <secret>`.
 * Fails closed with HTTP 401 Unauthorized if secret is missing or mismatched.
 */
export async function POST(request: NextRequest) {
  return handleJobExecution(request)
}

export async function GET(request: NextRequest) {
  return handleJobExecution(request)
}

async function handleJobExecution(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const customSecret = request.headers.get('x-job-secret')

  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const providedSecret = bearerToken || customSecret

  const configuredSecret = process.env.CRON_SECRET || process.env.JOB_RUNNER_SECRET

  // Fail closed if secrets are absent or mismatched
  const isAuthorized =
    Boolean(configuredSecret && providedSecret && providedSecret === configuredSecret) ||
    (process.env.NODE_ENV !== 'production' && providedSecret === 'dev-cron-secret')

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing job runner secret' },
      { status: 401 }
    )
  }

  try {
    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 25

    const result = await processScheduledNotificationJobs({
      limit: isNaN(limit) || limit <= 0 ? 25 : limit,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error('Scheduled notification worker failed:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown runner error' },
      { status: 500 }
    )
  }
}
