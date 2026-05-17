import type { AgentProvider } from '@contexts/settings/domain/agentSettings'
import type { TerminalDiagnosticsLogInput, TerminalWindowsPty } from '@shared/contracts/dto'
import type { WorkspaceNodeKind } from '../../types'
import type { PreferredTerminalRendererMode } from './preferredRenderer'
import { registerTerminalDiagnostics } from './registerDiagnostics'
import type { TerminalRendererRecoveryRequest } from './runtimeRendererHealth'
import type { TerminalThemeMode } from './theme'
import { shouldReusePreservedXtermSession } from './useTerminalRuntimeSession.support'
import { createMountedXtermSession, type XtermSession } from './xtermSession'

type TerminalRuntimeInitialDimensions = { cols: number; rows: number } | null

export function createRuntimeXtermSession({
  nodeId,
  sessionId,
  kind,
  title,
  terminalProvider,
  terminalThemeMode,
  isTestEnvironment,
  container,
  initialDimensions,
  windowsPty,
  diagnosticsEnabled,
  logTerminalDiagnostics,
  preservedSession,
  terminalClientResetVersion,
  displayTerminalMetrics,
  terminalFontFamily,
  isLiveSessionReattach,
  bindSearchAddonToFind,
  syncTerminalSize,
  viewportZoom,
  preferredRendererMode,
  requestTerminalRendererRecovery,
  scheduleWebglCanvasTransformCleanup,
}: {
  nodeId: string
  sessionId: string
  kind: WorkspaceNodeKind
  title: string
  terminalProvider: AgentProvider | null
  terminalThemeMode: TerminalThemeMode
  isTestEnvironment: boolean
  container: HTMLDivElement
  initialDimensions: TerminalRuntimeInitialDimensions
  windowsPty: TerminalWindowsPty | null
  diagnosticsEnabled: boolean
  logTerminalDiagnostics: (payload: TerminalDiagnosticsLogInput) => void
  preservedSession: XtermSession | null
  terminalClientResetVersion: number
  displayTerminalMetrics: {
    fontSize: number
    lineHeight: number
    letterSpacing: number
  }
  terminalFontFamily: string | null
  isLiveSessionReattach: boolean
  bindSearchAddonToFind: Parameters<typeof createMountedXtermSession>[0]['bindSearchAddonToFind']
  syncTerminalSize: () => void
  viewportZoom: number
  preferredRendererMode: PreferredTerminalRendererMode
  requestTerminalRendererRecovery: (request: TerminalRendererRecoveryRequest) => void
  scheduleWebglCanvasTransformCleanup: () => void
}): {
  session: XtermSession
  canReusePreservedSession: boolean
  hasPreservedVisibleBaseline: boolean
} {
  const canReusePreservedSession = shouldReusePreservedXtermSession({
    preservedSession,
    terminalClientResetVersion,
  })
  const hasPreservedVisibleBaseline = canReusePreservedSession && preservedSession !== null
  const session =
    (canReusePreservedSession ? preservedSession : null) ??
    (() => {
      if (diagnosticsEnabled) {
        const rect = container.getBoundingClientRect()
        logTerminalDiagnostics({
          source: 'renderer-terminal',
          nodeId,
          sessionId,
          nodeKind: kind === 'agent' ? 'agent' : 'terminal',
          title,
          event: 'xterm-session-create-request',
          snapshot: {
            bufferKind: 'unknown',
            activeBaseY: null,
            activeViewportY: null,
            activeLength: null,
            cols: initialDimensions?.cols ?? 0,
            rows: initialDimensions?.rows ?? 0,
            viewportScrollTop: null,
            viewportScrollHeight: null,
            viewportClientHeight: null,
            hasViewport: false,
            hasVerticalScrollbar: false,
            containerRectWidth: rect.width,
            containerRectHeight: rect.height,
          },
          details: {
            initialCols: initialDimensions?.cols ?? null,
            initialRows: initialDimensions?.rows ?? null,
            terminalFontSize: displayTerminalMetrics.fontSize,
            displayFontSize: displayTerminalMetrics.fontSize,
            displayLineHeight: displayTerminalMetrics.lineHeight,
            displayLetterSpacing: displayTerminalMetrics.letterSpacing ?? null,
            isLiveSessionReattach,
            canReusePreservedSession,
          },
        })
      }
      return createMountedXtermSession({
        nodeId,
        ownerId: `${nodeId}:${sessionId}`,
        sessionIdForDiagnostics: sessionId,
        nodeKindForDiagnostics: kind === 'agent' ? 'agent' : 'terminal',
        titleForDiagnostics: title,
        terminalProvider,
        terminalThemeMode,
        isTestEnvironment,
        container,
        initialDimensions,
        windowsPty,
        cursorBlink: true,
        disableStdin: false,
        fontSize: displayTerminalMetrics.fontSize,
        fontFamily: terminalFontFamily,
        lineHeight: displayTerminalMetrics.lineHeight,
        letterSpacing: displayTerminalMetrics.letterSpacing,
        bindSearchAddonToFind,
        syncTerminalSize,
        diagnosticsEnabled,
        logTerminalDiagnostics,
        initialViewportZoom: viewportZoom,
        preferredRendererMode,
        onRendererIssue: issue => {
          requestTerminalRendererRecovery({
            ...issue,
            trigger: 'context_loss',
          })
        },
        scheduleWebglCanvasTransformCleanup,
      })
    })()

  if (preservedSession && !canReusePreservedSession) {
    preservedSession.dispose()
  }
  if (canReusePreservedSession && preservedSession) {
    session.terminal.options.disableStdin = false
    session.terminal.options.cursorBlink = true
    session.diagnostics.dispose()
    session.diagnostics = registerTerminalDiagnostics({
      enabled: diagnosticsEnabled,
      emit: logTerminalDiagnostics,
      nodeId,
      sessionId,
      nodeKind: kind === 'agent' ? 'agent' : 'terminal',
      title,
      terminal: session.terminal,
      container,
      rendererKind: session.renderer.kind,
      terminalThemeMode,
      windowsPty,
    })
    session.renderer.clearTextureAtlas()
    syncTerminalSize()
  }

  return {
    session,
    canReusePreservedSession,
    hasPreservedVisibleBaseline,
  }
}
