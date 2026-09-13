import type {
  Event,
  ConsentedFriendAttendance,
  EventRecommendationReason,
  RecommendationExplanation,
} from '@/types'

export interface RecommendationContext {
  userCampusId?: string | null
  followedClubIds?: Set<string> | string[]
  friendAttendanceMap?: Map<string, ConsentedFriendAttendance> | Record<string, ConsentedFriendAttendance>
  userInterests?: string[]
  referenceDate?: Date
}

export interface RankedEvent extends Event {
  recommendationExplanation: RecommendationExplanation
}

/**
 * Computes a transparent, explainable recommendation score and reasons for a given event.
 */
export function explainRecommendation(
  event: Event,
  context: RecommendationContext = {}
): RecommendationExplanation {
  const {
    userCampusId,
    followedClubIds,
    friendAttendanceMap,
    userInterests = [],
    referenceDate = new Date(),
  } = context

  let score = 0
  const reasons: string[] = []
  const tags: EventRecommendationReason[] = []

  const followedSet = followedClubIds
    ? followedClubIds instanceof Set
      ? followedClubIds
      : new Set(followedClubIds)
    : new Set<string>()

  // 1. Campus Match (+1000 pts)
  if (userCampusId && event.campus_id && event.campus_id === userCampusId) {
    score += 1000
    tags.push('campus_match')
    reasons.push(
      event.campus?.name
        ? `Hosted on your campus (${event.campus.name})`
        : 'Hosted at your campus'
    )
  }

  // 2. Followed Club / Organizer (+600 pts)
  if (event.organizer_id && followedSet.has(event.organizer_id)) {
    score += 600
    tags.push('followed_club')
    const organizerName = event.organizer?.display_name || 'a club you follow'
    reasons.push(`Hosted by ${organizerName}`)
  }

  // 3. Consented Mutual Friends Attending (+400 base + 100 per extra friend up to 800 pts)
  let friendAttendance: ConsentedFriendAttendance | undefined
  if (friendAttendanceMap) {
    if (friendAttendanceMap instanceof Map) {
      friendAttendance = friendAttendanceMap.get(event.id)
    } else {
      friendAttendance = friendAttendanceMap[event.id]
    }
  }

  if (friendAttendance && friendAttendance.count > 0) {
    const friendCount = friendAttendance.count
    const attendanceBonus = Math.min(800, 400 + (friendCount - 1) * 100)
    score += attendanceBonus
    tags.push('friends_attending')

    if (friendCount === 1) {
      const friendName = friendAttendance.friends[0]?.name || 'A friend'
      reasons.push(`${friendName} is attending`)
    } else {
      const sampleName = friendAttendance.friends[0]?.name
      if (sampleName) {
        reasons.push(`${sampleName} and ${friendCount - 1} other friend${friendCount > 2 ? 's' : ''} attending`)
      } else {
        reasons.push(`${friendCount} friends are attending`)
      }
    }
  }

  // 4. Category / Tag Interest (+300 pts)
  if (userInterests.length > 0) {
    const normInterests = userInterests.map((i) => i.toLowerCase().trim())
    const eventCatNorm = event.category.toLowerCase().trim()

    const matchesCategory = normInterests.some(
      (interest) =>
        interest === eventCatNorm ||
        interest.startsWith(eventCatNorm) ||
        eventCatNorm.startsWith(interest)
    )

    const matchesTag = event.tags?.some((t) => {
      const tagNorm = t.toLowerCase().trim()
      return normInterests.some(
        (interest) =>
          interest === tagNorm ||
          interest.startsWith(tagNorm) ||
          tagNorm.startsWith(interest)
      )
    })

    if (matchesCategory || matchesTag) {
      score += 300
      tags.push('category_interest')
      reasons.push(`Matches your interest in ${event.category.replace(/_/g, ' ')}`)
    }
  }

  // 5. Upcoming & Available (+150 pts if within next 7 days and spots open)
  const startsAtTime = new Date(event.starts_at).getTime()
  const nowTime = referenceDate.getTime()
  const diffDays = (startsAtTime - nowTime) / (1000 * 60 * 60 * 24)

  if (diffDays >= 0 && diffDays <= 7) {
    const hasCapacity =
      event.capacity === null ||
      (event.active_registrations_count ?? event.registration_count ?? 0) < event.capacity

    if (hasCapacity) {
      score += 150
      tags.push('happening_soon')
      reasons.push('Happening this week with open spots')
    }
  }

  // 6. Popular on Campus (+100 pts if significant registrations)
  const regCount = event.active_registrations_count ?? event.registration_count ?? 0
  if (regCount >= 15) {
    score += 100
    tags.push('campus_popular')
    reasons.push(`Popular on campus (${regCount} attending)`)
  }

  // Fallback reason if none triggered
  if (reasons.length === 0) {
    reasons.push('Discover trending campus activities')
  }

  return {
    score,
    reasons,
    tags,
  }
}

/**
 * Ranks an array of events using multi-factor transparent scoring.
 * Higher scores appear first. Ties are broken by upcoming start date.
 */
export function rankEventsForUser(
  events: Event[],
  context: RecommendationContext = {}
): RankedEvent[] {
  const ranked = events.map((event) => {
    const explanation = explainRecommendation(event, context)
    return {
      ...event,
      recommendationExplanation: explanation,
    }
  })

  return ranked.sort((a, b) => {
    // Primary: Recommendation score descending
    if (b.recommendationExplanation.score !== a.recommendationExplanation.score) {
      return b.recommendationExplanation.score - a.recommendationExplanation.score
    }
    // Secondary: Chronological starts_at ascending
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  })
}
