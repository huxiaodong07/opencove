export function isTruthyEnv(rawValue: string | undefined): boolean {
  if (!rawValue) {
    return false
  }

  return rawValue === '1' || rawValue.toLowerCase() === 'true'
}

export function resolveForwardedLocalWorkerDiagnosticsEnv(
  envSource: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: Record<string, string> = {}
  const keys = [
    'OPENCOVE_AGENT_LAUNCH_DIAGNOSTICS',
    'OPENCOVE_TERMINAL_DIAGNOSTICS',
    'OPENCOVE_TERMINAL_INPUT_DIAGNOSTICS',
  ]

  for (const key of keys) {
    if (isTruthyEnv(envSource[key])) {
      env[key] = '1'
    }
  }

  return env
}
