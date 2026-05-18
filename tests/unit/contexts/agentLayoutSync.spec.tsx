import React, { useEffect } from 'react'
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Node } from '@xyflow/react'
import type { TerminalNodeData } from '../../../src/contexts/workspace/presentation/renderer/types'
import { DEFAULT_AGENT_ENV_BY_PROVIDER } from '../../../src/contexts/settings/domain/agentEnv'
import type { WorkspaceSpaceState } from '../../../src/contexts/workspace/presentation/renderer/types'
import { useWorkspaceCanvasAgentNodeLifecycle } from '../../../src/contexts/workspace/presentation/renderer/components/workspaceCanvas/hooks/useAgentNodeLifecycle'
import { useWorkspaceCanvasPtyTaskCompletion } from '../../../src/contexts/workspace/presentation/renderer/components/workspaceCanvas/hooks/usePtyTaskCompletion'

vi.mock('@app/renderer/i18n', () => {
  return {
    useTranslation: () => ({
      t: (key: string, params?: { message?: string }) =>
        params?.message ? `${key}: ${params.message}` : key,
    }),
  }
})

function createAgentNode(): Node<TerminalNodeData> {
  return {
    id: 'agent-1',
    type: 'terminalNode',
    position: { x: 0, y: 0 },
    data: {
      sessionId: '',
      profileId: 'wsl:Ubuntu',
      runtimeKind: 'wsl',
      title: 'codex · default',
      width: 520,
      height: 360,
      kind: 'agent',
      status: 'standby',
      startedAt: new Date().toISOString(),
      endedAt: null,
      exitCode: null,
      lastError: null,
      scrollback: null,
      agent: {
        provider: 'codex',
        prompt: 'ship it',
        model: 'gpt-5.2-codex',
        effectiveModel: 'gpt-5.2-codex',
        launchMode: 'new',
        resumeSessionId: null,
        executionDirectory: '/tmp/project',
        expectedDirectory: '/tmp/project',
        directoryMode: 'workspace',
        customDirectory: null,
        shouldCreateDirectory: false,
        taskId: null,
      },
      task: null,
      note: null,
      image: null,
    },
    draggable: true,
    selectable: true,
  }
}

describe('agent terminal layout sync', () => {
  it('relaunches an existing agent node in its current fixed-root space directory', async () => {
    const workspacePath = '/tmp/project'
    const fixedRootPath = '/tmp/fixed-worktrees/feature-a'
    const nodesRef = {
      current: [createAgentNode()],
    } as React.MutableRefObject<Node<TerminalNodeData>[]>
    const spacesRef = {
      current: [
        {
          id: 'space-1',
          name: 'Feature',
          directoryPath: fixedRootPath,
          targetMountId: 'mount-1',
          labelColor: null,
          nodeIds: ['agent-1'],
          rect: null,
        },
      ],
    } as React.MutableRefObject<WorkspaceSpaceState[]>

    const setNodes = vi.fn(
      (
        updater: (prevNodes: Node<TerminalNodeData>[]) => Node<TerminalNodeData>[],
        _options?: { syncLayout?: boolean },
      ) => {
        nodesRef.current = updater(nodesRef.current)
      },
    )
    const controlSurfaceInvoke = vi.fn(async (request: { id: string; payload?: unknown }) => {
      if (request.id === 'mount.list') {
        return {
          projectId: 'ws1',
          mounts: [
            {
              mountId: 'mount-1',
              projectId: 'ws1',
              name: 'Primary',
              sortOrder: 0,
              endpointId: 'local',
              targetId: 'target-1',
              rootPath: workspacePath,
              rootUri: 'file:///tmp/project',
              createdAt: '2026-05-10T00:00:00.000Z',
              updatedAt: '2026-05-10T00:00:00.000Z',
            },
          ],
        }
      }

      if (request.id === 'session.launchAgentInMount') {
        return {
          sessionId: 'agent-session-fixed-root',
          provider: 'codex',
          startedAt: '2026-05-10T00:00:00.000Z',
          executionContext: {
            projectId: null,
            spaceId: null,
            mountId: 'mount-1',
            targetId: 'target-1',
            endpoint: { endpointId: 'local', kind: 'local' },
            target: { scheme: 'file', rootPath: workspacePath, rootUri: 'file:///tmp/project' },
            scope: {
              rootPath: fixedRootPath,
              rootUri: 'file:///tmp/fixed-worktrees/feature-a',
            },
            workingDirectory: fixedRootPath,
          },
          profileId: null,
          runtimeKind: 'posix',
          resumeSessionId: null,
          effectiveModel: 'gpt-5.2-codex',
          command: 'codex',
          args: [],
        }
      }

      throw new Error(`Unexpected control surface request: ${request.id}`)
    })

    Object.defineProperty(window, 'opencoveApi', {
      configurable: true,
      writable: true,
      value: {
        controlSurface: {
          invoke: controlSurfaceInvoke,
        },
        pty: {
          kill: vi.fn(async () => undefined),
        },
        workspace: {
          ensureDirectory: vi.fn(async () => undefined),
        },
      },
    })

    function Harness(): null {
      const { launchAgentInNode } = useWorkspaceCanvasAgentNodeLifecycle({
        workspaceId: 'ws1',
        workspacePath,
        nodesRef,
        spacesRef,
        onSpacesChange: vi.fn(),
        setNodes,
        bumpAgentLaunchToken: () => 1,
        isAgentLaunchTokenCurrent: () => true,
        agentFullAccess: true,
        defaultTerminalProfileId: null,
        agentEnvByProvider: DEFAULT_AGENT_ENV_BY_PROVIDER,
        terminalFontSize: 13,
        terminalDisplayMetrics: { fontSize: 13, lineHeight: 1, letterSpacing: 0 },
      })

      useEffect(() => {
        void launchAgentInNode('agent-1', 'new')
      }, [launchAgentInNode])

      return null
    }

    render(<Harness />)

    await waitFor(() => {
      expect(controlSurfaceInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session.launchAgentInMount',
          payload: expect.objectContaining({
            mountId: 'mount-1',
            cwdUri: 'file:///tmp/fixed-worktrees/feature-a',
          }),
        }),
      )
    })

    await waitFor(() => {
      expect(nodesRef.current[0]?.data.agent?.executionDirectory).toBe(fixedRootPath)
      expect(nodesRef.current[0]?.data.agent?.expectedDirectory).toBe(fixedRootPath)
    })
  })

  it('does not trigger layout sync during agent lifecycle status updates', async () => {
    const nodesRef = {
      current: [createAgentNode()],
    } as React.MutableRefObject<Node<TerminalNodeData>[]>
    const spacesRef = { current: [] } as React.MutableRefObject<WorkspaceSpaceState[]>

    const setNodes = vi.fn(
      (
        updater: (prevNodes: Node<TerminalNodeData>[]) => Node<TerminalNodeData>[],
        _options?: { syncLayout?: boolean },
      ) => {
        nodesRef.current = updater(nodesRef.current)
      },
    )

    Object.defineProperty(window, 'opencoveApi', {
      configurable: true,
      writable: true,
      value: {
        agent: {
          launch: vi.fn(async () => ({
            sessionId: 'agent-session-1',
            profileId: 'wsl:Ubuntu',
            runtimeKind: 'wsl',
            command: 'wsl.exe',
            args: ['--distribution', 'Ubuntu'],
            launchMode: 'new',
            effectiveModel: 'gpt-5.2-codex',
            resumeSessionId: null,
          })),
        },
        pty: {
          kill: vi.fn(async () => undefined),
        },
        workspace: {
          ensureDirectory: vi.fn(async () => undefined),
        },
      },
    })

    function Harness(): null {
      const { launchAgentInNode } = useWorkspaceCanvasAgentNodeLifecycle({
        nodesRef,
        spacesRef,
        setNodes,
        bumpAgentLaunchToken: () => 1,
        isAgentLaunchTokenCurrent: () => true,
        agentFullAccess: true,
        defaultTerminalProfileId: 'wsl:Ubuntu',
        agentEnvByProvider: DEFAULT_AGENT_ENV_BY_PROVIDER,
      })

      useEffect(() => {
        void launchAgentInNode('agent-1', 'new')
      }, [launchAgentInNode])

      return null
    }

    render(<Harness />)

    await waitFor(() => {
      expect(window.opencoveApi.agent.launch).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(setNodes).toHaveBeenCalledTimes(2)
    })

    expect(setNodes.mock.calls.map(call => call[1])).toEqual([
      { syncLayout: false },
      { syncLayout: false },
    ])
  })

  it('does not trigger layout sync for agent runtime state events', async () => {
    let onStateListener:
      | ((event: { sessionId: string; state: 'running' | 'standby' }) => void)
      | null = null

    const setNodes = vi.fn()

    Object.defineProperty(window, 'opencoveApi', {
      configurable: true,
      writable: true,
      value: {
        pty: {
          onData: vi.fn(() => () => undefined),
          onExit: vi.fn(() => () => undefined),
          onState: vi.fn((listener: typeof onStateListener) => {
            onStateListener = listener
            return () => {
              onStateListener = null
            }
          }),
          onMetadata: vi.fn(() => () => undefined),
        },
      },
    })

    function Harness(): null {
      useWorkspaceCanvasPtyTaskCompletion({
        setNodes,
      })
      return null
    }

    render(<Harness />)

    onStateListener?.({ sessionId: 'agent-session-1', state: 'running' })

    await waitFor(() => {
      expect(setNodes).toHaveBeenCalledTimes(1)
    })

    expect(setNodes.mock.calls[0]?.[1]).toEqual({ syncLayout: false })
  })
})
