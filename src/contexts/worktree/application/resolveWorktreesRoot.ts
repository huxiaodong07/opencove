function trimTrailingSeparators(pathValue: string): string {
  const trimmed = pathValue.trim()
  if (/^[a-zA-Z]:[\\/]$/.test(trimmed) || /^[\\/]$/.test(trimmed)) {
    return trimmed
  }

  return trimmed.replace(/[\\/]+$/, '')
}

function isAbsolutePathLike(pathValue: string): boolean {
  return (
    /^[a-zA-Z]:[\\/]/.test(pathValue) || pathValue.startsWith('/') || pathValue.startsWith('\\\\')
  )
}

function normalizeRelativePath(pathValue: string, separator: string): string {
  return pathValue
    .trim()
    .replace(/^[.][\\/]+/, '')
    .replace(/^[\\/]+/, '')
    .replace(/[\\/]+$/, '')
    .replace(/[\\/]+/g, separator)
}

function joinPathLike(basePath: string, ...segments: string[]): string {
  const separator = basePath.includes('\\') && !basePath.includes('/') ? '\\' : '/'
  const normalizedBase = trimTrailingSeparators(basePath)
  const normalizedSegments = segments
    .map(segment => normalizeRelativePath(segment, separator))
    .filter(segment => segment.length > 0)

  return [normalizedBase, ...normalizedSegments]
    .filter(segment => segment.length > 0)
    .join(separator)
}

export function resolveWorktreesRoot(workspacePath: string, worktreesRoot: string): string {
  const trimmed = worktreesRoot.trim()
  if (trimmed.length === 0) {
    return joinPathLike(workspacePath, '.opencove', 'worktrees')
  }

  if (isAbsolutePathLike(trimmed)) {
    return trimTrailingSeparators(trimmed)
  }

  return joinPathLike(workspacePath, trimmed)
}
