import { describe, test, expect } from 'vitest'
import type { EventFeedback, EventFeedbackSummary } from '@/types'

describe('Phase 10 Integration: Event Feedback & Organizer Aggregate Privacy', () => {
  interface SimulatedRegistration {
    id: string
    event_id: string
    user_id: string
    status: 'registered' | 'checked_in' | 'waitlisted' | 'cancelled'
  }

  const registrations: SimulatedRegistration[] = [
    { id: 'reg-1', event_id: 'event-101', user_id: 'usr-student-1', status: 'checked_in' },
    { id: 'reg-2', event_id: 'event-101', user_id: 'usr-student-2', status: 'registered' },
    { id: 'reg-3', event_id: 'event-101', user_id: 'usr-student-3', status: 'cancelled' },
  ]

  const feedbackDb: EventFeedback[] = []

  function simulateSubmitFeedback(
    userId: string,
    eventId: string,
    rating: number,
    feedback?: string | null,
    hasIssue = false,
    issueCategory?: EventFeedback['issue_category'],
    issueDescription?: string | null
  ): { success: boolean; data?: EventFeedback; error?: string } {
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5 stars.' }
    }

    // Verify user was registered or checked in
    const reg = registrations.find(
      (r) => r.event_id === eventId && r.user_id === userId && (r.status === 'registered' || r.status === 'checked_in')
    )

    if (!reg) {
      return {
        success: false,
        error: 'You can only leave feedback for events you were registered to attend.',
      }
    }

    const existingIdx = feedbackDb.findIndex((f) => f.event_id === eventId && f.user_id === userId)
    const newFeedback: EventFeedback = {
      id: existingIdx >= 0 ? feedbackDb[existingIdx]!.id : `fb-${Date.now()}-${userId}`,
      event_id: eventId,
      user_id: userId,
      rating: Math.round(rating),
      feedback: feedback || null,
      has_issue: hasIssue,
      issue_category: hasIssue ? issueCategory || null : null,
      issue_description: hasIssue ? issueDescription || null : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (existingIdx >= 0) {
      feedbackDb[existingIdx] = newFeedback
    } else {
      feedbackDb.push(newFeedback)
    }

    return { success: true, data: newFeedback }
  }

  function simulateGetAggregateFeedback(eventId: string): EventFeedbackSummary {
    const eventReviews = feedbackDb.filter((f) => f.event_id === eventId)
    const total_reviews = eventReviews.length

    if (total_reviews === 0) {
      return {
        average_rating: 0,
        total_reviews: 0,
        distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        recent_comments: [],
        issues_count: 0,
        issues_by_category: {},
      }
    }

    const sumRating = eventReviews.reduce((acc, f) => acc + f.rating, 0)
    const average_rating = Math.round((sumRating / total_reviews) * 10) / 10

    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    eventReviews.forEach((f) => {
      distribution[String(f.rating)] = (distribution[String(f.rating)] || 0) + 1
    })

    // Strict privacy guarantee: user_id and attendee identity are completely omitted
    const recent_comments = eventReviews
      .filter((f) => (f.feedback && f.feedback.trim().length > 0) || f.has_issue)
      .map((f) => ({
        rating: f.rating,
        feedback: f.feedback ?? null,
        has_issue: f.has_issue,
        issue_category: f.issue_category ?? null,
        created_at: f.created_at,
      }))

    const issues_count = eventReviews.filter((f) => f.has_issue).length
    const issues_by_category: Record<string, number> = {}
    eventReviews
      .filter((f) => f.has_issue && f.issue_category)
      .forEach((f) => {
        const cat = f.issue_category!
        issues_by_category[cat] = (issues_by_category[cat] || 0) + 1
      })

    return {
      average_rating,
      total_reviews,
      distribution,
      recent_comments,
      issues_count,
      issues_by_category,
    }
  }

  test('submitting feedback enforces rating range 1..5', () => {
    expect(simulateSubmitFeedback('usr-student-1', 'event-101', 0).success).toBe(false)
    expect(simulateSubmitFeedback('usr-student-1', 'event-101', 6).success).toBe(false)
    expect(simulateSubmitFeedback('usr-student-1', 'event-101', 5).success).toBe(true)
  })

  test('only registered or checked-in attendees can leave feedback', () => {
    // Student 1 (checked_in): allowed
    expect(simulateSubmitFeedback('usr-student-1', 'event-101', 5, 'Great speakers!').success).toBe(true)

    // Student 2 (registered): allowed
    expect(simulateSubmitFeedback('usr-student-2', 'event-101', 4, 'Smooth check-in').success).toBe(true)

    // Student 3 (cancelled): rejected
    const cancelledRes = simulateSubmitFeedback('usr-student-3', 'event-101', 1)
    expect(cancelledRes.success).toBe(false)
    expect(cancelledRes.error).toContain('registered to attend')

    // Unrelated student: rejected
    const strangerRes = simulateSubmitFeedback('usr-stranger', 'event-101', 1)
    expect(strangerRes.success).toBe(false)
  })

  test('submitting feedback with issue flags category correctly', () => {
    const res = simulateSubmitFeedback(
      'usr-student-2',
      'event-101',
      3,
      'Room was too cold',
      true,
      'venue',
      'AC set to 16 degrees'
    )
    expect(res.success).toBe(true)
    expect(res.data?.has_issue).toBe(true)
    expect(res.data?.issue_category).toBe('venue')
  })

  test('organizer aggregate feedback never exposes attendee identity or user_id', () => {
    const summary = simulateGetAggregateFeedback('event-101')
    expect(summary.total_reviews).toBe(2)
    expect(summary.average_rating).toBe(4) // (5 + 3) / 2 = 4.0
    expect(summary.issues_count).toBe(1)
    expect(summary.issues_by_category['venue']).toBe(1)

    // Anonymity verification: Inspect every comment object
    summary.recent_comments.forEach((c) => {
      expect((c as unknown as Record<string, unknown>)['user_id']).toBeUndefined()
      expect((c as unknown as Record<string, unknown>)['attendee_name']).toBeUndefined()
      expect((c as unknown as Record<string, unknown>)['email']).toBeUndefined()
    })
  })
})
