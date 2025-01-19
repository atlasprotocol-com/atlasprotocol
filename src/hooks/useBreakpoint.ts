import { isBrowser } from "framer-motion";
import { useMemo, useState } from "react";

import { useIsomorphicEffect } from "./useIsomorphicEffect";

type TScreens = {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
};

const screens: TScreens = {
  sm: "600px",
  md: "768px",
  lg: "1000px",
  xl: "1130px",
  "2xl": "1350px",
};

export function useBreakpoint(
  breakpoint: keyof TScreens,
  defaultValue: boolean = false,
) {
  const [match, setMatch] = useState(() => defaultValue);
  const [isReady, setIsReady] = useState(() => false);

  useIsomorphicEffect(() => {
    if (!(isBrowser && "matchMedia" in window && window.matchMedia))
      return undefined;

    const value = screens[breakpoint] ?? "999999px";
    const query = window.matchMedia(`(min-width: ${value})`);

    function listener(event: MediaQueryListEvent) {
      setMatch(event.matches);
    }

    setMatch(query.matches);

    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [breakpoint, defaultValue]);

  useIsomorphicEffect(() => {
    if (isReady) return undefined;

    setIsReady(true);
    return undefined;
  }, [isReady]);

  return {
    match,
    isReady,
  };
}

export function useBreakpointEffect(
  breakpoint: keyof TScreens,
  effect: (match: boolean) => void,
) {
  const { match } = useBreakpoint(breakpoint);
  useIsomorphicEffect(() => effect(match), [breakpoint, effect]);
  return null;
}

export function useBreakpointValue<T, U>(
  breakpoint: keyof TScreens,
  valid: T,
  invalid: U,
) {
  const match = useBreakpoint(breakpoint);
  const value = useMemo(
    () => (match ? valid : invalid),
    [invalid, match, valid],
  );
  return value;
}
