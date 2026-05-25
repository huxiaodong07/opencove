import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_AGENT_SETTINGS } from '../../../src/contexts/settings/domain/agentSettings'
import type { AppUpdateState } from '../../../src/shared/contracts/dto'
import * as terminalProfilesHook from '../../../src/app/renderer/shell/hooks/useTerminalProfiles'
import { SettingsPanel } from '../../../src/contexts/settings/presentation/renderer/SettingsPanel'

function createUpdateState(): AppUpdateState {
  return {
    policy: DEFAULT_AGENT_SETTINGS.updatePolicy,
    channel: DEFAULT_AGENT_SETTINGS.updateChannel,
    currentVersion: '0.2.0',
    status: 'idle',
    latestVersion: null,
    releaseName: null,
    releaseDate: null,
    releaseNotesUrl: null,
    downloadPercent: null,
    downloadedBytes: null,
    totalBytes: null,
    checkedAt: null,
    message: null,
  }
}

function createModelCatalog() {
  return {
    'claude-code': { models: [], source: null, fetchedAt: null, isLoading: false, error: null },
    codex: { models: [], source: null, fetchedAt: null, isLoading: false, error: null },
    opencode: { models: [], source: null, fetchedAt: null, isLoading: false, error: null },
    gemini: { models: [], source: null, fetchedAt: null, isLoading: false, error: null },
  }
}

function mockTerminalProfiles(): void {
  vi.spyOn(terminalProfilesHook, 'useTerminalProfiles').mockReturnValue({
    terminalProfiles: [],
    detectedDefaultTerminalProfileId: null,
    refreshTerminalProfiles: async () => undefined,
  })
}

describe('SettingsPanel workspace settings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens a project workspace page and forwards worktree root changes with the workspace id', () => {
    const onWorkspaceWorktreesRootChange = vi.fn()
    mockTerminalProfiles()

    render(
      <SettingsPanel
        settings={DEFAULT_AGENT_SETTINGS}
        updateState={createUpdateState()}
        modelCatalogByProvider={createModelCatalog()}
        workspaces={[
          {
            id: 'workspace-1',
            name: 'Demo Project',
            path: 'F:\\repo\\demo',
            worktreesRoot: 'C:\\Users\\tester\\.opencove\\worktrees',
            environmentVariables: {},
            spaces: [],
            nodes: [],
          },
        ]}
        onWorkspaceWorktreesRootChange={onWorkspaceWorktreesRootChange}
        onWorkspaceEnvironmentVariablesChange={() => undefined}
        isFocusNodeTargetZoomPreviewing={false}
        onFocusNodeTargetZoomPreviewChange={() => undefined}
        onChange={() => undefined}
        onCheckForUpdates={() => undefined}
        onDownloadUpdate={() => undefined}
        onInstallUpdate={() => undefined}
        onClose={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Demo Project' }))

    expect(screen.getByTestId('settings-worktree-root')).toHaveValue(
      'C:\\Users\\tester\\.opencove\\worktrees',
    )
    expect(screen.getByTestId('settings-resolved-worktree-path-display')).toHaveAttribute(
      'title',
      'C:\\Users\\tester\\.opencove\\worktrees',
    )

    fireEvent.change(screen.getByTestId('settings-worktree-root'), {
      target: { value: 'D:\\fixed\\worktrees' },
    })

    expect(onWorkspaceWorktreesRootChange).toHaveBeenCalledWith(
      'workspace-1',
      'D:\\fixed\\worktrees',
    )
  })
})
