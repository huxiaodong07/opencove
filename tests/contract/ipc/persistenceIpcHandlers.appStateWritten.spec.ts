import { afterEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../../src/shared/constants/ipc'
import type { PersistWriteResult } from '../../../src/shared/contracts/dto'
import { invokeHandledIpc } from './ipcTestUtils'

function createIpcHarness() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel)
    }),
  }

  return { handlers, ipcMain }
}

function createPersistenceStoreStub(writeResult: PersistWriteResult) {
  return {
    readWorkspaceStateRaw: vi.fn(async () => null),
    writeWorkspaceStateRaw: vi.fn(async () => writeResult),
    readAppState: vi.fn(async () => null),
    readAppStateRevision: vi.fn(async () => 0),
    writeAppState: vi.fn(async (_state: unknown) => writeResult),
    readNodeScrollback: vi.fn(async () => null),
    writeNodeScrollback: vi.fn(async () => writeResult),
    readAgentNodePlaceholderScrollback: vi.fn(async () => null),
    writeAgentNodePlaceholderScrollback: vi.fn(async () => writeResult),
    consumeRecovery: vi.fn(() => null),
    dispose: vi.fn(),
  }
}

describe('persistence IPC app state write hooks', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('runs the app state written hook after a successful write', async () => {
    const { handlers, ipcMain } = createIpcHarness()
    vi.doMock('electron', () => ({ ipcMain }))

    const writeResult: PersistWriteResult = { ok: true, level: 'full', bytes: 12 }
    const store = createPersistenceStoreStub(writeResult)
    const onAppStateWritten = vi.fn(async (_state: unknown) => undefined)

    const { registerPersistenceIpcHandlers } =
      await import('../../../src/platform/persistence/sqlite/ipc/register')

    registerPersistenceIpcHandlers(async () => store, { onAppStateWritten })

    const handler = handlers.get(IPC_CHANNELS.persistenceWriteAppState)
    expect(handler).toBeTypeOf('function')

    const state = {
      formatVersion: 1,
      activeWorkspaceId: 'workspace-1',
      workspaces: [
        {
          id: 'workspace-1',
          name: 'Workspace',
          path: '/repo',
          worktreesRoot: '/fixed/worktrees',
          nodes: [],
        },
      ],
      settings: {},
    }

    await expect(invokeHandledIpc<PersistWriteResult>(handler, null, { state })).resolves.toEqual(
      writeResult,
    )

    expect(store.writeAppState).toHaveBeenCalledWith(state)
    expect(onAppStateWritten).toHaveBeenCalledWith(state)
    expect(store.writeAppState.mock.invocationCallOrder[0]).toBeLessThan(
      onAppStateWritten.mock.invocationCallOrder[0],
    )
  })

  it('skips the app state written hook when the write fails', async () => {
    const { handlers, ipcMain } = createIpcHarness()
    vi.doMock('electron', () => ({ ipcMain }))

    const writeResult: PersistWriteResult = {
      ok: false,
      reason: 'io',
      error: { code: 'persistence.io_failed' },
    }
    const store = createPersistenceStoreStub(writeResult)
    const onAppStateWritten = vi.fn(async (_state: unknown) => undefined)

    const { registerPersistenceIpcHandlers } =
      await import('../../../src/platform/persistence/sqlite/ipc/register')

    registerPersistenceIpcHandlers(async () => store, { onAppStateWritten })

    const handler = handlers.get(IPC_CHANNELS.persistenceWriteAppState)
    expect(handler).toBeTypeOf('function')

    const state = {
      formatVersion: 1,
      activeWorkspaceId: null,
      workspaces: [],
      settings: {},
    }

    await expect(invokeHandledIpc<PersistWriteResult>(handler, null, { state })).resolves.toEqual(
      writeResult,
    )

    expect(onAppStateWritten).not.toHaveBeenCalled()
  })
})
