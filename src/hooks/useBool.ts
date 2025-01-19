import { useCallback, useState } from "react";

export type UseBoolResult = [boolean, () => void, () => void, () => void] & {
  value: boolean;
  setTrue: () => void;
  setFalse: () => void;
  toggle: (value?: boolean) => void;
};

export function useBool(defaultValue: boolean = false) {
  const [value, setValue] = useState(defaultValue);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  const toggle = useCallback((value?: boolean) => {
    if (value !== undefined) {
      return setValue(value);
    }
    return setValue((v) => !v);
  }, []);

  const result: UseBoolResult = [
    value,
    toggle,
    setTrue,
    setFalse,
  ] as UseBoolResult;

  result.value = value;
  result.setTrue = setTrue;
  result.setFalse = setFalse;
  result.toggle = toggle;

  return result;
}
