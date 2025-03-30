import React from "react";
import { twMerge } from "tailwind-merge";

export interface LocalInputProps {
  variant?: string;
  multiline?: boolean;
}

export interface InputProps
  extends Omit<
      React.AllHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>,
      "variant"
    >,
    LocalInputProps {
  error?: boolean;
}

export const Input = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps
>((props, ref) => {
  const { className, multiline, error, readOnly, ...others } = props;

  if (multiline) {
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        className={twMerge(
          "disabled:cursor-not-allowed px-4 py-3 bg-input-bg rounded-md border border-input-border focus:outline-none focus:border-primary focus:ring-offset-2 placeholder:text-neutral-7 w-full",
          error ? "border-danger" : "",
          className,
        )}
        {...others}
      />
    );
  }

  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      className={twMerge(
        "disabled:cursor-not-allowed h-12 px-4 py-3 bg-input-bg rounded-md border border-input-border focus:outline-none focus:border-primary placeholder:text-neutral-7 w-full",
        error ? "border-danger" : "",
        readOnly &&
          "cursor-not-allowed text-neutral-7 bg-neutral-3 dark:bg-neutral-9",
        className,
      )}
      readOnly={readOnly}
      {...others}
    />
  );
});

Input.displayName = "Input";
