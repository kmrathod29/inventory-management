import { useCallback } from 'react';
import { useToast } from './ToastContext';

export function useErrorHandler() {
  const showToast = useToast();

  const handleAsync = useCallback(
    async (asyncFn, errorMessage = "An error occurred") => {
      try {
        return await asyncFn();
      } catch (error) {
        showToast(error?.message || errorMessage, "error");
        return null;
      }
    },
    [showToast],
  );

  return { handleAsync };
}
