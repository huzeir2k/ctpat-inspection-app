import { useCallback, useState } from 'react';
import { describeAuthError } from '../models/authErrors';
import type { AuthNotice } from './AuthScreen';

/**
 * Shared "submit" behaviour of the signed-out screens: one request at a time, a spinner
 * while it runs, and any failure turned into a message for the notice area.
 */
export default function useAuthSubmit() {
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showError = useCallback((text: string) => setNotice({ kind: 'error', text }), []);
  const showInfo = useCallback((text: string) => setNotice({ kind: 'info', text }), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const submit = useCallback(
    async (action: () => Promise<void>) => {
      if (isSubmitting) return;
      setNotice(null);
      setIsSubmitting(true);
      try {
        await action();
      } catch (error) {
        showError(describeAuthError(error).message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, showError]
  );

  return { notice, isSubmitting, submit, showError, showInfo, clearNotice };
}
