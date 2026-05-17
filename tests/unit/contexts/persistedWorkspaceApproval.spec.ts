import { describe, expect, it, vi } from 'vitest'
import {
  createPersistedWorkspaceApprovalGate,
  listPersistedWorkspaceApprovalRoots,
  registerPersistedWorkspaceApprovalRoots,
} from '../../../src/contexts/workspace/infrastructure/approval/PersistedWorkspaceApproval'

describe('PersistedWorkspaceApproval', () => {
  it('lists unique persisted workspace roots from app state', () => {
    expect(
      listPersistedWorkspaceApprovalRoots({
        activeWorkspaceId: 'workspace-1',
        workspaces: [
          { id: 'workspace-1', name: 'One', path: '/tmp/one', nodes: [] },
          {
            id: 'workspace-2',
            name: 'Two',
            path: '  /tmp/two  ',
            worktreesRoot: '/var/opencove-worktrees',
            nodes: [],
          },
          { id: 'workspace-3', name: 'Three', path: '/tmp/one', nodes: [] },
          { id: 'workspace-4', name: 'Four', path: '   ', nodes: [] },
        ],
      }),
    ).toEqual(['/tmp/one', '/tmp/one/.opencove/worktrees', '/tmp/two', '/var/opencove-worktrees'])
  })

  it('waits for startup hydration before answering approvals or accepting writes', async () => {
    let releaseHydration: (() => void) | null = null
    const hydrationBarrier = new Promise<void>(resolve => {
      releaseHydration = resolve
    })

    const registeredRoots: string[] = []
    const approvedRoots = new Set<string>()
    const approvedWorkspaces = {
      registerRoot: vi.fn(async (rootPath: string) => {
        if (rootPath === '/tmp/persisted') {
          await hydrationBarrier
        }

        approvedRoots.add(rootPath)
        registeredRoots.push(rootPath)
      }),
      isPathApproved: vi.fn(async (targetPath: string) => approvedRoots.has(targetPath)),
    }

    const gate = createPersistedWorkspaceApprovalGate({
      approvedWorkspaces,
      readAppState: async () => ({
        activeWorkspaceId: 'workspace-1',
        workspaces: [{ id: 'workspace-1', name: 'One', path: '/tmp/persisted', nodes: [] }],
      }),
      extraRoots: ['/tmp/test-root'],
    })

    const isApprovedPromise = gate.approvedWorkspaces.isPathApproved('/tmp/persisted')
    const registerRootPromise = gate.approvedWorkspaces.registerRoot('/tmp/later')

    await Promise.resolve()
    expect(approvedWorkspaces.isPathApproved).not.toHaveBeenCalled()
    expect(registeredRoots).toContain('/tmp/test-root')
    expect(registeredRoots).toContain('/tmp/persisted/.opencove/worktrees')
    expect(registeredRoots).not.toContain('/tmp/later')

    releaseHydration?.()

    await expect(isApprovedPromise).resolves.toBe(true)
    await expect(registerRootPromise).resolves.toBeUndefined()
    await expect(gate.ready).resolves.toBeUndefined()

    expect(registeredRoots).toEqual(
      expect.arrayContaining([
        '/tmp/test-root',
        '/tmp/persisted',
        '/tmp/persisted/.opencove/worktrees',
        '/tmp/later',
      ]),
    )
    expect(new Set(registeredRoots)).toEqual(
      new Set([
        '/tmp/test-root',
        '/tmp/persisted',
        '/tmp/persisted/.opencove/worktrees',
        '/tmp/later',
      ]),
    )
    expect(approvedWorkspaces.isPathApproved).toHaveBeenCalledWith('/tmp/persisted')
  })

  it('registers unique roots from a written app state', async () => {
    const registeredRoots: string[] = []
    const approvedWorkspaces = {
      registerRoot: vi.fn(async (rootPath: string) => {
        registeredRoots.push(rootPath)
      }),
      isPathApproved: vi.fn(async () => false),
    }

    await registerPersistedWorkspaceApprovalRoots({
      approvedWorkspaces,
      extraRoots: ['/tmp/test-root', '/tmp/test-root'],
      appState: {
        activeWorkspaceId: 'workspace-1',
        workspaces: [
          {
            id: 'workspace-1',
            name: 'One',
            path: '/tmp/one',
            worktreesRoot: '',
            nodes: [],
          },
          {
            id: 'workspace-2',
            name: 'Two',
            path: '/tmp/two',
            worktreesRoot: '/fixed/worktrees',
            nodes: [],
          },
          {
            id: 'workspace-3',
            name: 'Three',
            path: '/tmp/two',
            worktreesRoot: '/fixed/worktrees',
            nodes: [],
          },
        ],
      },
    })

    expect(registeredRoots).toEqual([
      '/tmp/test-root',
      '/tmp/one',
      '/tmp/one/.opencove/worktrees',
      '/tmp/two',
      '/fixed/worktrees',
    ])
  })
})
