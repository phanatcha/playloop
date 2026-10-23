import { useEffect, useState } from 'react';
import { checkUsername } from '../../lib/auth.js';
import { validateUsername } from '../../lib/authValidation.js';

const DEBOUNCE_MS = 400;

// Live "is this username free?" check for the Sign up form (GET /auth/username-available).
// Returns { status, reason }: status is 'idle' | 'checking' | 'available' | 'unavailable', and
// `reason` is the API's taken | invalid | reserved when unavailable.
//
// Only well-formed names are sent. Failures (429, network) leave the status idle on purpose: the
// check is a convenience and POST /auth/register validates again.
export function useUsernameAvailability(username) {
  // The result remembers which name it answers, so a stale answer is never shown for a newer value.
  const [result, setResult] = useState(null);
  const checkable = validateUsername(username) === null;

  useEffect(() => {
    if (!checkable) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { available, reason } = await checkUsername(username, { signal: controller.signal });
        setResult({ username, available, reason });
      } catch {
        // Aborted by a newer keystroke, rate limited or offline: stay quiet.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, checkable]);

  if (!checkable) return { status: 'idle' };
  if (result?.username !== username) return { status: 'checking' };
  if (result.available) return { status: 'available' };
  return { status: 'unavailable', reason: result.reason };
}
