import { expect, test } from '@playwright/test'
import { clearAndSeedWorkspace, launchApp } from './workspace-canvas.helpers'

const windowsOnly = process.platform !== 'win32'

const rawAltVPasteShortcutEnv = {
  OPENCOVE_TEST_ENABLE_SESSION_STATE_WATCHER: '1',
  OPENCOVE_TEST_AGENT_SESSION_SCENARIO: 'raw-alt-v-paste-shortcut-echo',
} as const

const claudeSettings = {
  defaultProvider: 'claude-code',
  customModelEnabledByProvider: {
    'claude-code': false,
    codex: false,
    opencode: false,
    gemini: false,
  },
  customModelByProvider: {
    'claude-code': '',
    codex: '',
    opencode: '',
    gemini: '',
  },
  customModelOptionsByProvider: {
    'claude-code': [],
    codex: [],
    opencode: [],
    gemini: [],
  },
} as const

test.describe('Workspace Canvas - Agent Alt+V (Windows)', () => {
  test.skip(windowsOnly, 'Windows only')

  test('forwards Alt+V from a Claude agent node to the PTY', async () => {
    const { electronApp, window } = await launchApp({
      windowMode: 'offscreen',
      env: rawAltVPasteShortcutEnv,
    })

    try {
      await clearAndSeedWorkspace(window, [], {
        settings: claudeSettings,
      })

      const pane = window.locator('.workspace-canvas .react-flow__pane')
      await expect(pane).toBeVisible()
      await pane.click({ button: 'right', position: { x: 320, y: 220 } })

      const runButton = window.locator('[data-testid="workspace-context-run-default-agent"]')
      await expect(runButton).toBeVisible()
      await runButton.click()

      const agentNode = window.locator('.terminal-node').first()
      const terminalBody = agentNode.locator('.xterm')
      const helper = agentNode.locator('.xterm-helper-textarea')
      const transcript = agentNode.locator('.terminal-node__transcript')

      await expect(agentNode).toBeVisible()
      await expect(transcript).toContainText('[opencove-test-alt-v] ready', { timeout: 15_000 })

      await terminalBody.click()
      await expect(helper).toBeFocused()

      await window.keyboard.press('Alt+V')

      await expect(transcript).toContainText('[opencove-test-alt-v] hex=1b76', {
        timeout: 10_000,
      })
      await expect(transcript).not.toContainText('[opencove-test-alt-v] hex=76')
    } finally {
      await electronApp.close()
    }
  })
})
