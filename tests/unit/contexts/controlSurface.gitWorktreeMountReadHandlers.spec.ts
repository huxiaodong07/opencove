import { afterEach, describe, expect, it, vi } from 'vitest'
import { createControlSurface } from '../../../src/app/main/controlSurface/controlSurface'
import type { ControlSurfaceContext } from '../../../src/app/main/controlSurface/types'
import { registerGitWorktreeMountHandlers } from '../../../src/app/main/controlSurface/handlers/gitWorktreeMountHandlers'
import type { WorkerTopologyStore } from '../../../src/app/main/controlSurface/topology/topologyStore'
import type { GitWorktreePort } from '../../../src/contexts/worktree/application/ports'
import { toFileUri } from '../../../src/contexts/filesystem/domain/fileUri'
import type { ResolveMountTargetResult } from '../../../src/shared/contracts/dto'

const invokeControlSurfaceMock = vi.hoisted(() => vi.fn())

vi.mock('../../../src/app/main/controlSurface/remote/controlSurfaceHttpClient', () => ({
  invokeControlSurface: invokeControlSurfaceMock,
}))

const ctx: ControlSurfaceContext = {
  now: () => new Date('2026-03-27T00:00:00.000Z'),
}

function createGitWorktreePort(overrides: Partial<GitWorktreePort> = {}): GitWorktreePort {
  return {
    listBranches: async () => ({ current: null, branches: [] }),
    listWorktrees: async () => ({ worktrees: [] }),
    getStatusSummary: async () => ({ changedFileCount: 0 }),
    getDefaultBranch: async () => 'main',
    createWorktree: async () => ({ path: '/worktree', head: null, branch: 'feature-a' }),
    removeWorktree: async () => ({
      deletedBranchName: null,
      branchDeleteError: null,
      directoryCleanupError: null,
    }),
    renameBranch: async () => undefined,
    suggestNames: async () => ({
      branchName: 'feature-a',
      worktreeName: 'feature-a',
      provider: 'codex',
      effectiveModel: null,
    }),
    ...overrides,
  }
}

function createTopology(target: ResolveMountTargetResult): WorkerTopologyStore {
  return {
    resolveMountTarget: vi.fn(async () => target),
    resolveRemoteEndpointConnection: vi.fn(async endpointId =>
      endpointId === target.endpointId
        ? { hostname: '127.0.0.1', port: 39291, token: 'remote-token' }
        : null,
    ),
  } as unknown as WorkerTopologyStore
}

describe('git worktree mount read handlers', () => {
  afterEach(() => {
    invokeControlSurfaceMock.mockReset()
  })

  it('allows local status summary outside the mount root when the path is approved', async () => {
    const repoPath = '/repo'
    const fixedWorktreePath = '/fixed/worktrees/feature-a'
    const mountTarget: ResolveMountTargetResult = {
      mountId: 'mount-local',
      endpointId: 'local',
      targetId: 'target-local',
      rootPath: repoPath,
      rootUri: toFileUri(repoPath),
    }
    const getStatusSummary = vi.fn(async () => ({ changedFileCount: 2 }))
    const controlSurface = createControlSurface()

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: async targetPath => targetPath === fixedWorktreePath,
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: createGitWorktreePort({ getStatusSummary }),
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'query',
      id: 'gitWorktree.statusSummaryInMount',
      payload: { mountId: 'mount-local', uri: toFileUri(fixedWorktreePath) },
    })

    expect(result.ok).toBe(true)
    expect(getStatusSummary).toHaveBeenCalledWith({ repoPath: fixedWorktreePath })
  })

  it('rejects local status summary outside approved roots', async () => {
    const repoPath = '/repo'
    const fixedWorktreePath = '/fixed/worktrees/feature-a'
    const mountTarget: ResolveMountTargetResult = {
      mountId: 'mount-local',
      endpointId: 'local',
      targetId: 'target-local',
      rootPath: repoPath,
      rootUri: toFileUri(repoPath),
    }
    const getStatusSummary = vi.fn()
    const controlSurface = createControlSurface()

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: async () => false,
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: createGitWorktreePort({ getStatusSummary }),
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'query',
      id: 'gitWorktree.statusSummaryInMount',
      payload: { mountId: 'mount-local', uri: toFileUri(fixedWorktreePath) },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('common.approved_path_required')
    }
    expect(getStatusSummary).not.toHaveBeenCalled()
  })

  it('forwards remote status summary outside the mount root to the mounted endpoint', async () => {
    const fixedWorktreePath = '/remote/fixed/worktrees/feature-a'
    const mountTarget: ResolveMountTargetResult = {
      mountId: 'mount-remote',
      endpointId: 'remote-1',
      targetId: 'target-remote',
      rootPath: '/remote/repo',
      rootUri: toFileUri('/remote/repo'),
    }
    const controlSurface = createControlSurface()
    invokeControlSurfaceMock.mockResolvedValueOnce({
      httpStatus: 200,
      result: {
        __opencoveControlEnvelope: true,
        ok: true,
        value: { changedFileCount: 3 },
      },
    })

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: vi.fn(async () => false),
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: createGitWorktreePort(),
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'query',
      id: 'gitWorktree.statusSummaryInMount',
      payload: { mountId: 'mount-remote', uri: toFileUri(fixedWorktreePath) },
    })

    expect(result.ok).toBe(true)
    expect(invokeControlSurfaceMock).toHaveBeenCalledWith(
      { hostname: '127.0.0.1', port: 39291, token: 'remote-token' },
      {
        kind: 'query',
        id: 'gitWorktree.statusSummary',
        payload: { repoPath: fixedWorktreePath },
      },
    )
  })
})
