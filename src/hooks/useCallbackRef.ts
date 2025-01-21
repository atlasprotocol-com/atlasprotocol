import { useEffect, useMemo, useRef } from "react";

type CallbackRef<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : undefined;

export function useCallbackRef<T extends (...args: any[]) => any>(
  callback?: T,
): CallbackRef<T> {
  const callbackRef = useRef<T | undefined>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useMemo(() => {
    return (...args: any[]) => {
      return callbackRef.current ? callbackRef.current(...args) : undefined;
    };
  }, []) as CallbackRef<T>;
}
