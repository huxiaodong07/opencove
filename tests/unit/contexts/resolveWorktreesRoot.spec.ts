import { describe, expect, it } from 'vitest'
import { resolveWorktreesRoot } from '../../../src/contexts/worktree/application/resolveWorktreesRoot'

describe('resolveWorktreesRoot', () => {
  it('uses the default project-local root for an empty value', () => {
    expect(resolveWorktreesRoot('/repo/demo', '')).toBe('/repo/demo/.opencove/worktrees')
    expect(resolveWorktreesRoot('C:\\repo\\demo', '   ')).toBe(
      'C:\\repo\\demo\\.opencove\\worktrees',
    )
  })

  it('resolves relative paths from the project root', () => {
    expect(resolveWorktreesRoot('/repo/demo', 'custom/worktrees')).toBe(
      '/repo/demo/custom/worktrees',
    )
    expect(resolveWorktreesRoot('C:\\repo\\demo', 'custom/worktrees')).toBe(
      'C:\\repo\\demo\\custom\\worktrees',
    )
  })

  it('keeps POSIX absolute paths as fixed roots', () => {
    expect(resolveWorktreesRoot('/repo/demo', '/var/opencove-worktrees/')).toBe(
      '/var/opencove-worktrees',
    )
  })

  it('keeps Windows absolute paths as fixed roots', () => {
    expect(resolveWorktreesRoot('C:\\repo\\demo', 'D:\\fixed\\worktrees\\')).toBe(
      'D:\\fixed\\worktrees',
    )
    expect(resolveWorktreesRoot('C:\\repo\\demo', 'D:/fixed/worktrees/')).toBe('D:/fixed/worktrees')
  })
})
