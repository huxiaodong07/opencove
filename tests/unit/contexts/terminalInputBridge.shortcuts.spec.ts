import { describe, expect, it } from 'vitest'
import {
  isLinuxTerminalCopyShortcut,
  isLinuxTerminalPasteShortcut,
  isMacTerminalPasteShortcut,
  isWindowsTerminalAltVPasteImageShortcut,
} from '../../../src/contexts/workspace/presentation/renderer/components/terminalNode/inputBridge'

describe('isLinuxTerminalCopyShortcut', () => {
  it('returns true for Ctrl+Shift+C on Linux', () => {
    expect(
      isLinuxTerminalCopyShortcut(
        { key: 'c', metaKey: false, ctrlKey: true, altKey: false, shiftKey: true },
        { platform: 'Linux x86_64' },
      ),
    ).toBe(true)
  })

  it('returns false for Ctrl+C on Linux', () => {
    expect(
      isLinuxTerminalCopyShortcut(
        { key: 'c', metaKey: false, ctrlKey: true, altKey: false, shiftKey: false },
        { platform: 'Linux x86_64' },
      ),
    ).toBe(false)
  })
})

describe('isLinuxTerminalPasteShortcut', () => {
  it('returns true for Ctrl+Shift+V on Linux', () => {
    expect(
      isLinuxTerminalPasteShortcut(
        { key: 'v', metaKey: false, ctrlKey: true, altKey: false, shiftKey: true },
        { platform: 'Linux x86_64' },
      ),
    ).toBe(true)
  })

  it('returns false for Ctrl+V on Linux', () => {
    expect(
      isLinuxTerminalPasteShortcut(
        { key: 'v', metaKey: false, ctrlKey: true, altKey: false, shiftKey: false },
        { platform: 'Linux x86_64' },
      ),
    ).toBe(false)
  })
})

describe('isMacTerminalPasteShortcut', () => {
  it('returns true for Cmd+V on macOS', () => {
    expect(
      isMacTerminalPasteShortcut(
        { key: 'v', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
        { platform: 'MacIntel' },
      ),
    ).toBe(true)
  })

  it('returns false for Cmd+V on Windows', () => {
    expect(
      isMacTerminalPasteShortcut(
        { key: 'v', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
        { platform: 'Win32' },
      ),
    ).toBe(false)
  })

  it('returns false for Ctrl+V on macOS', () => {
    expect(
      isMacTerminalPasteShortcut(
        { key: 'v', metaKey: false, ctrlKey: true, altKey: false, shiftKey: false },
        { platform: 'MacIntel' },
      ),
    ).toBe(false)
  })

  it('returns false for Cmd+Shift+V', () => {
    expect(
      isMacTerminalPasteShortcut(
        { key: 'v', metaKey: true, ctrlKey: false, altKey: false, shiftKey: true },
        { platform: 'MacIntel' },
      ),
    ).toBe(false)
  })
})

describe('isWindowsTerminalAltVPasteImageShortcut', () => {
  it('returns true for Alt+V on Windows', () => {
    expect(
      isWindowsTerminalAltVPasteImageShortcut(
        { key: 'v', metaKey: false, ctrlKey: false, altKey: true, shiftKey: false },
        { platform: 'Win32' },
      ),
    ).toBe(true)
  })

  it('returns false when additional modifiers are held', () => {
    expect(
      isWindowsTerminalAltVPasteImageShortcut(
        { key: 'v', metaKey: false, ctrlKey: true, altKey: true, shiftKey: false },
        { platform: 'Win32' },
      ),
    ).toBe(false)
  })

  it('returns false off Windows', () => {
    expect(
      isWindowsTerminalAltVPasteImageShortcut(
        { key: 'v', metaKey: false, ctrlKey: false, altKey: true, shiftKey: false },
        { platform: 'MacIntel' },
      ),
    ).toBe(false)
  })
})
