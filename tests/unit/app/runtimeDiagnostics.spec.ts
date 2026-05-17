import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createMainRuntimeDiagnosticsLogger } from '../../../src/app/main/runtimeDiagnostics'

const previousUserDataDir = process.env['OPENCOVE_USER_DATA_DIR']

afterEach(() => {
  if (previousUserDataDir === undefined) {
    delete process.env['OPENCOVE_USER_DATA_DIR']
    return
  }

  process.env['OPENCOVE_USER_DATA_DIR'] = previousUserDataDir
})

describe('runtime diagnostics', () => {
  it('writes diagnostics through OPENCOVE_USER_DATA_DIR without requiring Electron app', async () => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'opencove-runtime-diagnostics-'))
    process.env['OPENCOVE_USER_DATA_DIR'] = userDataDir

    try {
      const logger = createMainRuntimeDiagnosticsLogger('main-app')
      logger.info('worker-safe-log', 'Worker-safe runtime diagnostics')

      const logPath = path.join(userDataDir, 'logs', 'runtime-diagnostics.log')
      const raw = await readFile(logPath, 'utf8')
      expect(raw).toContain('"event":"worker-safe-log"')
      expect(raw).toContain('"message":"Worker-safe runtime diagnostics"')
    } finally {
      await rm(userDataDir, { recursive: true, force: true })
    }
  })
})
