#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const nextDir = path.join(projectRoot, '.next')
const devLockPath = path.join(nextDir, 'dev', 'lock')
const rootLockPath = path.join(nextDir, 'lock')

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return false
  }
}

function cleanLock(lockPath, label) {
  if (!fs.existsSync(lockPath)) return

  try {
    const raw = fs.readFileSync(lockPath, 'utf8')
    let shouldRemove = false
    let reason = ''

    try {
      const data = JSON.parse(raw)
      if (data && data.pid) {
        if (!isProcessAlive(data.pid)) {
          shouldRemove = true
          reason = `recorded PID ${data.pid} is no longer running`
        } else if (process.env.CI || process.argv.includes('--force')) {
          shouldRemove = true
          reason = `forced cleanup in CI/build environment (PID ${data.pid})`
        } else {
          console.log(`[clean-locks] Active ${label} found on PID ${data.pid} (port ${data.port || 3000}). Preserving active session.`)
        }
      } else {
        shouldRemove = true
        reason = 'malformed or empty lock payload'
      }
    } catch {
      shouldRemove = true
      reason = 'invalid JSON format'
    }

    if (shouldRemove) {
      fs.unlinkSync(lockPath)
      console.log(`[clean-locks] Successfully cleared stale ${label} (${reason}).`)
    }
  } catch (err) {
    console.warn(`[clean-locks] Note: Could not process ${lockPath}:`, err.message)
  }
}

// Clean dev and root locks
cleanLock(devLockPath, 'Next.js dev lock (.next/dev/lock)')
cleanLock(rootLockPath, 'Next.js build lock (.next/lock)')
