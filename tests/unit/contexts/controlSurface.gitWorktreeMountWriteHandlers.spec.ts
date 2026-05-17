import { describe, expect, it, vi, afterEach } from 'vitest'
import { createControlSurface } from '../../../src/app/main/controlSurface/controlSurface'
import type { ControlSurfaceContext } from '../../../src/app/main/controlSurface/types'
import { registerGitWorktreeMountHandlers } from '../../../src/app/main/controlSurface/handlers/gitWorktreeMountHandlers'
import type { WorkerTopologyStore } from '../../../src/app/main/controlSurface/topology/topologyStore'
import type { GitWorktreePort } from '../../../src/contexts/worktree/application/ports'
import { toFileUri } from '../../../src/contexts/filesystem/domain/fileUri'
import type {
  CreateGitWorktreeInput,
  GitWorktreeInfo,
  RemoveGitWorktreeResult,
  ResolveMountTargetResult,
} from '../../../src/shared/contracts/dto'

const invokeControlSurfaceMock = vi.hoisted(() => vi.fn())

vi.mock('../../../src/app/main/controlSurface/remote/controlSurfaceHttpClient', () => ({
  invokeControlSurface: invokeControlSurfaceMock,
}))

const ctx: ControlSurfaceContext = {
  now: () => new Date('2026-03-27T00:00:00.000Z'),
}

function createGitWorktreePort(overrides: Partial<GitWorktreePort> = {}): {
  port: GitWorktreePort
  createInput: () => CreateGitWorktreeInput | null
} {
  let capturedCreateInput: CreateGitWorktreeInput | null = null

  return {
    createInput: () => capturedCreateInput,
    port: {
      listBranches: async () => ({ current: null, branches: [] }),
      listWorktrees: async () => ({ worktrees: [] }),
      getStatusSummary: async () => ({ changedFileCount: 0 }),
      getDefaultBranch: async () => 'main',
      createWorktree: async (input: CreateGitWorktreeInput): Promise<GitWorktreeInfo> => {
        capturedCreateInput = input
        return {
          path: `${input.worktreesRoot}/feature-a`,
          head: null,
          branch: 'feature-a',
        }
      },
      removeWorktree: async (): Promise<RemoveGitWorktreeResult> => ({
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
    },
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

describe('git worktree mount write handlers', () => {
  afterEach(() => {
    invokeControlSurfaceMock.mockReset()
  })

  it('allows a local fixed worktrees root outside the mount root when it is approved', async () => {
    const repoPath = '/repo'
    const fixedRoot = '/fixed/worktrees'
    const mountTarget: ResolveMountTargetResult = {
      mountId: 'mount-local',
      endpointId: 'local',
      targetId: 'target-local',
      rootPath: repoPath,
      rootUri: toFileUri(repoPath),
    }
    const { port, createInput } = createGitWorktreePort()
    const controlSurface = createControlSurface()

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: async targetPath => targetPath === repoPath || targetPath === fixedRoot,
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: port,
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'command',
      id: 'gitWorktree.createInMount',
      payload: {
        mountId: 'mount-local',
        worktreesRootUri: toFileUri(fixedRoot),
        branchMode: { kind: 'new', name: 'feature-a', startPoint: 'HEAD' },
      },
    })

    expect(result.ok).toBe(true)
    expect(createInput()).toEqual({
      repoPath,
      worktreesRoot: fixedRoot,
      branchMode: { kind: 'new', name: 'feature-a', startPoint: 'HEAD' },
    })
  })

  it('rejects a local fixed worktrees root outside approved roots', async () => {
    const repoPath = '/repo'
    const fixedRoot = '/fixed/worktrees'
    const mountTarget: ResolveMountTargetResult = {
      mountId: 'mount-local',
      endpointId: 'local',
      targetId: 'target-local',
      rootPath: repoPath,
      rootUri: toFileUri(repoPath),
    }
    const createWorktree = vi.fn()
    const { port } = createGitWorktreePort({ createWorktree })
    const controlSurface = createControlSurface()

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: async targetPath => targetPath === repoPath,
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: port,
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'command',
      id: 'gitWorktree.createInMount',
      payload: {
        mountId: 'mount-local',
        worktreesRootUri: toFileUri(fixedRoot),
        branchMode: { kind: 'new', name: 'feature-a', startPoint: 'HEAD' },
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('common.approved_path_required')
    }
    expect(createWorktree).not.toHaveBeenCalled()
  })

  it('forwards remote create payloads to the mounted endpoint', async () => {
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
        value: {
          worktree: {
            path: '/remote/fixed/worktrees/feature-a',
            head: null,
            branch: 'feature-a',
          },
        },
      },
    })

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: vi.fn(async () => false),
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: createGitWorktreePort().port,
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'command',
      id: 'gitWorktree.createInMount',
      payload: {
        mountId: 'mount-remote',
        worktreesRootUri: toFileUri('/remote/fixed/worktrees'),
        branchMode: { kind: 'new', name: 'feature-a', startPoint: 'HEAD' },
      },
    })

    expect(result.ok).toBe(true)
    expect(invokeControlSurfaceMock).toHaveBeenCalledWith(
      { hostname: '127.0.0.1', port: 39291, token: 'remote-token' },
      {
        kind: 'command',
        id: 'gitWorktree.create',
        payload: {
          repoPath: '/remote/repo',
          worktreesRoot: '/remote/fixed/worktrees',
          branchMode: { kind: 'new', name: 'feature-a', startPoint: 'HEAD' },
        },
      },
    )
  })

  it('allows local remove outside the mount root when the worktree path is approved', async () => {
    const repoPath = '/repo'
    const fixedWorktreePath = '/fixed/worktrees/feature-a'
    const mountTarget: ResolveMountTargetResult = {
      mountId: 'mount-local',
      endpointId: 'local',
      targetId: 'target-local',
      rootPath: repoPath,
      rootUri: toFileUri(repoPath),
    }
    const removeWorktree = vi.fn(
      async (): Promise<RemoveGitWorktreeResult> => ({
        deletedBranchName: null,
        branchDeleteError: null,
        directoryCleanupError: null,
      }),
    )
    const controlSurface = createControlSurface()

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: async targetPath =>
          targetPath === repoPath || targetPath === fixedWorktreePath,
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: createGitWorktreePort({ removeWorktree }).port,
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'command',
      id: 'gitWorktree.removeInMount',
      payload: {
        mountId: 'mount-local',
        worktreeUri: toFileUri(fixedWorktreePath),
        force: true,
        deleteBranch: false,
      },
    })

    expect(result.ok).toBe(true)
    expect(removeWorktree).toHaveBeenCalledWith({
      repoPath,
      worktreePath: fixedWorktreePath,
      force: true,
      deleteBranch: false,
    })
  })

  it('allows local branch rename outside the mount root when the worktree path is approved', async () => {
    const repoPath = '/repo'
    const fixedWorktreePath = '/fixed/worktrees/feature-a'
    const mountTarget: ResolveMountTargetResult = {
      mountId: 'mount-local',
      endpointId: 'local',
      targetId: 'target-local',
      rootPath: repoPath,
      rootUri: toFileUri(repoPath),
    }
    const renameBranch = vi.fn(async () => undefined)
    const controlSurface = createControlSurface()

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: async targetPath =>
          targetPath === repoPath || targetPath === fixedWorktreePath,
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: createGitWorktreePort({ renameBranch }).port,
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'command',
      id: 'gitWorktree.renameBranchInMount',
      payload: {
        mountId: 'mount-local',
        worktreeUri: toFileUri(fixedWorktreePath),
        currentName: 'feature-a',
        nextName: 'feature-b',
      },
    })

    expect(result.ok).toBe(true)
    expect(renameBranch).toHaveBeenCalledWith({
      repoPath,
      worktreePath: fixedWorktreePath,
      currentName: 'feature-a',
      nextName: 'feature-b',
    })
  })

  it('forwards remote remove payloads outside the mount root to the mounted endpoint', async () => {
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
        value: {
          deletedBranchName: null,
          branchDeleteError: null,
          directoryCleanupError: null,
        },
      },
    })

    registerGitWorktreeMountHandlers(controlSurface, {
      approvedWorkspaces: {
        registerRoot: async () => undefined,
        isPathApproved: vi.fn(async () => false),
      },
      topology: createTopology(mountTarget),
      gitWorktreePort: createGitWorktreePort().port,
    })

    const result = await controlSurface.invoke(ctx, {
      kind: 'command',
      id: 'gitWorktree.removeInMount',
      payload: {
        mountId: 'mount-remote',
        worktreeUri: toFileUri(fixedWorktreePath),
        force: true,
        deleteBranch: true,
      },
    })

    expect(result.ok).toBe(true)
    expect(invokeControlSurfaceMock).toHaveBeenCalledWith(
      { hostname: '127.0.0.1', port: 39291, token: 'remote-token' },
      {
        kind: 'command',
        id: 'gitWorktree.remove',
        payload: {
          repoPath: '/remote/repo',
          worktreePath: fixedWorktreePath,
          force: true,
          deleteBranch: true,
        },
      },
    )
  })
})
