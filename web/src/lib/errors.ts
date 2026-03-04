export function getErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

