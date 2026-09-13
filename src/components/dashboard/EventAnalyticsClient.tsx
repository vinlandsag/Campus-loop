'use client'

import {
  TrendingUp,
  Users,
  UserX,
  ArrowUpRight,
  Percent,
  Calendar,
  Layers,
  Star,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import type { EventMetricsData, EventFeedbackSummary } from '@/types'

interface EventAnalyticsClientProps {
  eventId: string
  eventTitle: string
  metrics: EventMetricsData
  feedbackSummary?: EventFeedbackSummary | null
}

export function EventAnalyticsClient({
  eventTitle,
  metrics,
  feedbackSummary,
}: EventAnalyticsClientProps) {
  const maxCumulative =
    metrics.registrationsOverTime.length > 0
      ? Math.max(...metrics.registrationsOverTime.map((d) => d.cumulative))
      : 1

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-[--text-primary] tracking-tight">{eventTitle} Performance</h2>
        <p className="text-xs text-[--text-secondary] mt-0.5">Real-time attendance conversion and attendee engagement breakdown.</p>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Capacity Progress */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Capacity
            </span>
            <span>{metrics.capacity ? `${metrics.capacityProgress}%` : 'Unlimited'}</span>
          </div>

          <p className="mt-3 text-3xl font-bold text-[--text-primary]">
            {metrics.registeredCount}
            {metrics.capacity && (
              <span className="text-sm font-normal text-[--text-muted]">
                {' '}
                / {metrics.capacity}
              </span>
            )}
          </p>

          {metrics.capacity && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[--bg-muted]">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${metrics.capacityProgress}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-[11px] text-[--text-muted]">Confirmed registrations</p>
        </div>

        {/* Turnout / Attendance Rate */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Turnout Rate
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-emerald-900 dark:text-emerald-200">
            {metrics.attendanceRate}%
          </p>

          <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">
            <span className="font-bold">{metrics.checkedInCount}</span> attendees checked in at venue
          </p>
        </div>

        {/* No-Shows */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
            <span className="flex items-center gap-1.5">
              <UserX className="h-4 w-4 text-rose-500" /> No-Shows
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-[--text-primary]">
            {metrics.noShowsCount}
          </p>

          <p className="mt-3 text-xs text-[--text-secondary]">
            Registrants who have not completed check-in
          </p>
        </div>

        {/* Waitlist Conversions */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <span className="flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Conversions
            </span>
            <span className="font-mono">{metrics.waitlistCount} waiting</span>
          </div>

          <p className="mt-3 text-3xl font-bold text-amber-900 dark:text-amber-200">
            {metrics.waitlistConversionsCount}
          </p>

          <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
            Promoted from waitlist to confirmed spot
          </p>
        </div>
      </div>

      {/* Registrations Over Time Timeline */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-[--border-subtle] pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-base text-[--text-primary]">
              Registrations Over Time
            </h3>
          </div>
          <span className="text-xs text-[--text-muted]">
            {metrics.registrationsOverTime.length} active dates
          </span>
        </div>

        {metrics.registrationsOverTime.length === 0 ? (
          <div className="p-10 text-center text-xs text-[--text-muted]">
            No registrations recorded yet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {metrics.registrationsOverTime.map((bucket) => {
              const barPercent = Math.max(5, Math.round((bucket.cumulative / maxCumulative) * 100))

              return (
                <div key={bucket.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[--text-primary] flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[--text-muted]" />
                      {bucket.date}
                    </span>
                    <span className="text-[--text-secondary]">
                      <span className="font-semibold text-[--text-primary]">+{bucket.count}</span>{' '}
                      registered (Cumulative:{' '}
                      <span className="font-semibold">{bucket.cumulative}</span>)
                    </span>
                  </div>

                  <div className="h-3 w-full overflow-hidden rounded-full bg-[--bg-muted]">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
                      style={{ width: `${barPercent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Attendance Funnel Breakdown */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[--border-subtle] pb-4">
          <Layers className="h-5 w-5 text-emerald-600" />
          <h3 className="font-bold text-base text-[--text-primary]">
            Attendance Funnel & Status Breakdown
          </h3>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 p-4">
            <p className="text-xs text-[--text-muted]">Admitted & Checked In</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.checkedInCount}
            </p>
            <p className="mt-1 text-[11px] text-[--text-secondary]">
              Verified at door station
            </p>
          </div>

          <div className="rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 p-4">
            <p className="text-xs text-[--text-muted]">Pending Admission</p>
            <p className="mt-1 text-2xl font-bold text-[--text-primary]">
              {Math.max(0, metrics.registeredCount - metrics.checkedInCount)}
            </p>
            <p className="mt-1 text-[11px] text-[--text-secondary]">
              Registered, not yet scanned
            </p>
          </div>

          <div className="rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 p-4">
            <p className="text-xs text-[--text-muted]">Waitlist Queue</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.waitlistCount}
            </p>
            <p className="mt-1 text-[11px] text-[--text-secondary]">
              Awaiting cancellation spots
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate Attendee Feedback Section (Privacy-Guaranteed) */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-[--border-subtle] pb-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
            <h3 className="font-bold text-base text-[--text-primary]">
              Attendee Feedback & Ratings
            </h3>
          </div>
          <span className="text-xs text-[--text-muted]">
            🔒 Anonymous aggregate view
          </span>
        </div>

        {!feedbackSummary || feedbackSummary.total_reviews === 0 ? (
          <div className="p-10 text-center text-xs text-[--text-muted]">
            No attendee feedback submitted yet for this event. Feedback opens once attendees register.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Top Rating Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Average Rating
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-amber-900 dark:text-amber-200">
                    {feedbackSummary.average_rating}
                  </span>
                  <span className="text-xs text-[--text-muted]">/ 5.0</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-4 w-4 ${
                        s <= Math.round(feedbackSummary.average_rating)
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-zinc-300 dark:text-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 p-4">
                <p className="text-xs text-[--text-muted]">Total Responses</p>
                <p className="mt-1 text-2xl font-bold text-[--text-primary]">
                  {feedbackSummary.total_reviews}
                </p>
                <p className="mt-1 text-[11px] text-[--text-secondary]">
                  Verified attendees
                </p>
              </div>

              <div className="rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 p-4">
                <p className="text-xs text-[--text-muted]">Reported Issues</p>
                <p className={`mt-1 text-2xl font-bold ${
                  feedbackSummary.issues_count > 0 ? 'text-rose-500' : 'text-emerald-600'
                }`}>
                  {feedbackSummary.issues_count}
                </p>
                <p className="mt-1 text-[11px] text-[--text-secondary]">
                  {feedbackSummary.issues_count === 0 ? 'No issues flagged' : 'Requiring organizer attention'}
                </p>
              </div>
            </div>

            {/* Rating Breakdown & Issue Categories */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Star Distribution */}
              <div className="space-y-2 rounded-xl border border-[--border-subtle] p-4">
                <h4 className="text-xs font-semibold text-[--text-primary]">Rating Distribution</h4>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = feedbackSummary.distribution[stars] || 0
                  const pct = feedbackSummary.total_reviews > 0
                    ? Math.round((count / feedbackSummary.total_reviews) * 100)
                    : 0
                  return (
                    <div key={stars} className="flex items-center gap-3 text-xs">
                      <span className="w-8 flex items-center gap-0.5 text-[--text-muted]">
                        {stars} <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[--bg-muted]">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[--text-muted]">{count}</span>
                    </div>
                  )
                })}
              </div>

              {/* Reported Issues Categories */}
              <div className="space-y-2 rounded-xl border border-[--border-subtle] p-4">
                <h4 className="text-xs font-semibold text-[--text-primary] flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Issue Categories
                </h4>
                {feedbackSummary.issues_count === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 pt-2">
                    ✓ Clean record! No attendees reported logistical or facility issues.
                  </p>
                ) : (
                  <div className="space-y-2 pt-1">
                    {Object.entries(feedbackSummary.issues_by_category).map(([cat, count]) => (
                      <div key={cat} className="flex items-center justify-between text-xs py-1 border-b border-[--border-subtle]">
                        <span className="capitalize text-[--text-secondary]">{cat.replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">{count} flagged</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Anonymized Comments */}
            {feedbackSummary.recent_comments.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-[--text-primary] flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-emerald-600" /> Anonymized Attendee Comments
                </h4>
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {feedbackSummary.recent_comments.map((comment, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[--border-subtle] bg-[--bg-muted]/30 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${
                                s <= comment.rating
                                  ? 'fill-amber-400 text-amber-500'
                                  : 'text-zinc-300 dark:text-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-[--text-muted]">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {comment.feedback && (
                        <p className="text-[--text-secondary] italic">&ldquo;{comment.feedback}&rdquo;</p>
                      )}
                      {comment.has_issue && comment.issue_category && (
                        <span className="mt-1.5 inline-block rounded bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                          Flagged issue: {comment.issue_category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
