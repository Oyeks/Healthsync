import "server-only";

const attempts = new Map<string, { count: number; firstAttempt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes after max attempts

export function checkRateLimit(key: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs?: number;
} {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const elapsed = now - entry.firstAttempt;
    if (elapsed < LOCKOUT_MS) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: LOCKOUT_MS - elapsed,
      };
    }
    attempts.delete(key);
    attempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  entry.count++;
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - entry.count };
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}

// Periodic cleanup to prevent memory growth
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now - entry.firstAttempt > LOCKOUT_MS) {
        attempts.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);
