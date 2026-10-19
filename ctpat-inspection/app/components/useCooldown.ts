import { useCallback, useEffect, useState } from 'react';

/**
 * A countdown for "Resend code" buttons, so a user cannot hammer the email service.
 * `secondsLeft` is 0 when the action is allowed; `start` begins a new wait.
 */
export default function useCooldown(seconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const start = useCallback(() => setSecondsLeft(seconds), [seconds]);

  return { secondsLeft, start };
}
