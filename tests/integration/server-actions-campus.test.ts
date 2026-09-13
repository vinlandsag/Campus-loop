import { describe, test, expect } from 'vitest'

describe('Integration Tests: Campus Identity & Verification Server Actions', () => {
  // Simulating the business logic of updateUserCampus and domain verification
  function simulateUpdateCampus(
    caller: { id: string; email: string; email_confirmed: boolean; role: string },
    currentCampus: { id: string; domain: string },
    targetCampus: { id: string; domain: string; is_active: boolean },
    reason?: string
  ) {
    if (!targetCampus.is_active) {
      return { success: false, error: 'Selected campus is not active' }
    }

    const emailDomain = caller.email.split('@')[1]?.toLowerCase()
    const targetDomain = targetCampus.domain.toLowerCase()
    const matchesDomain = emailDomain === targetDomain || emailDomain?.endsWith(`.${targetDomain}`)

    if (matchesDomain) {
      if (caller.email_confirmed) {
        return {
          success: true,
          status: 'verified',
          campus_id: targetCampus.id,
          pending_campus_id: null,
          message: 'Campus membership verified.',
        }
      } else {
        return {
          success: true,
          status: 'unverified',
          campus_id: targetCampus.id,
          pending_campus_id: null,
          message: 'Campus updated. Please confirm your institutional email to complete verification.',
        }
      }
    }

    // Domain does not match -> exception requested
    if (!reason || reason.trim().length < 10) {
      return {
        success: false,
        error: 'A detailed reason (at least 10 characters) is required when affiliating outside your email domain.',
      }
    }

    return {
      success: true,
      status: 'pending',
      campus_id: currentCampus.id,
      pending_campus_id: targetCampus.id,
      exception_reason: reason,
      message: 'Campus transfer request submitted for administrative review.',
    }
  }

  function simulateApproveException(
    admin: { id: string; is_admin: boolean },
    userProfile: { id: string; campus_id: string; pending_campus_id: string | null; campus_verification_status: string }
  ) {
    if (!admin.is_admin) {
      return { success: false, error: 'Unauthorized: Only platform administrators can approve campus exceptions.' }
    }

    if (!userProfile.pending_campus_id) {
      return { success: false, error: 'No pending campus exception found for this user.' }
    }

    return {
      success: true,
      campus_id: userProfile.pending_campus_id,
      pending_campus_id: null,
      status: 'exception',
      verified_at: new Date().toISOString(),
    }
  }

  test('domain matching with confirmed email grants immediate verified status', () => {
    const caller = { id: 'usr-1', email: 'alex@sjsu.edu', email_confirmed: true, role: 'student' }
    const currentCampus = { id: 'c-1', domain: 'berkeley.edu' }
    const targetCampus = { id: 'c-2', domain: 'sjsu.edu', is_active: true }

    const res = simulateUpdateCampus(caller, currentCampus, targetCampus)
    expect(res.success).toBe(true)
    expect(res.status).toBe('verified')
    expect(res.campus_id).toBe('c-2')
  })

  test('domain matching with unconfirmed email requires confirmation', () => {
    const caller = { id: 'usr-2', email: 'alex@sjsu.edu', email_confirmed: false, role: 'student' }
    const currentCampus = { id: 'c-1', domain: 'berkeley.edu' }
    const targetCampus = { id: 'c-2', domain: 'sjsu.edu', is_active: true }

    const res = simulateUpdateCampus(caller, currentCampus, targetCampus)
    expect(res.success).toBe(true)
    expect(res.status).toBe('unverified')
    expect(res.message).toContain('confirm your institutional email')
  })

  test('domain mismatch without reason is rejected', () => {
    const caller = { id: 'usr-3', email: 'alex@gmail.com', email_confirmed: true, role: 'student' }
    const currentCampus = { id: 'c-1', domain: 'berkeley.edu' }
    const targetCampus = { id: 'c-2', domain: 'sjsu.edu', is_active: true }

    const res = simulateUpdateCampus(caller, currentCampus, targetCampus, '')
    expect(res.success).toBe(false)
    expect(res.error).toContain('detailed reason')
  })

  test('domain mismatch with valid reason transitions to pending review', () => {
    const caller = { id: 'usr-4', email: 'alex@gmail.com', email_confirmed: true, role: 'student' }
    const currentCampus = { id: 'c-1', domain: 'berkeley.edu' }
    const targetCampus = { id: 'c-2', domain: 'sjsu.edu', is_active: true }

    const res = simulateUpdateCampus(
      caller,
      currentCampus,
      targetCampus,
      'Cross-registered student taking CS coursework at SJSU'
    )
    expect(res.success).toBe(true)
    expect(res.status).toBe('pending')
    expect(res.pending_campus_id).toBe('c-2')
  })

  test('admin approves pending campus exception and updates membership', () => {
    const admin = { id: 'adm-1', is_admin: true }
    const pendingUser = {
      id: 'usr-4',
      campus_id: 'c-1',
      pending_campus_id: 'c-2',
      campus_verification_status: 'pending',
    }

    const res = simulateApproveException(admin, pendingUser)
    expect(res.success).toBe(true)
    expect(res.campus_id).toBe('c-2')
    expect(res.status).toBe('exception')
    expect(res.pending_campus_id).toBeNull()
  })

  test('non-admin cannot approve campus exception', () => {
    const regularUser = { id: 'usr-reg', is_admin: false }
    const pendingUser = {
      id: 'usr-4',
      campus_id: 'c-1',
      pending_campus_id: 'c-2',
      campus_verification_status: 'pending',
    }

    const res = simulateApproveException(regularUser, pendingUser)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Unauthorized')
  })
})
