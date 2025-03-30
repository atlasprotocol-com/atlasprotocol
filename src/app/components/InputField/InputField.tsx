import React, { useId } from "react";
import { twMerge } from "tailwind-merge";

import { Input, InputProps } from "../Input";

export interface InputFieldProps {
  label: string | React.ReactNode;
  error?: string | React.ReactNode;
  inputProps: InputProps;
  className?: string;
  captionStart?: string | React.ReactNode;
  captionEnd?: string | React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  inputProps,
  className,
  captionStart,
  captionEnd,
}) => {
  const genId = useId();

  const id = inputProps.id || genId;

  return (
    <div className={className}>
      <label htmlFor={id} className="flex lg:items-center flex-col lg:flex-row">
        <div className="flex items-baseline gap-1">
          {label}
          {captionStart && (
            <span className="hidden lg:inline text-caption text-sm">
              {captionStart}
            </span>
          )}
        </div>
        {(captionEnd || captionStart) && (
          <div className="flex mt-0.5 lg:mt-0 lg:ml-auto justify-between">
            <span className="lg:hidden text-caption text-sm">
              {captionStart}
            </span>
            <span className="text-caption text-sm">{captionEnd}</span>
          </div>
        )}
      </label>
      <Input
        {...inputProps}
        id={id}
        className={twMerge("mt-2", inputProps.className)}
        aria-describedby={`${id}-error`}
        aria-invalid={error ? "true" : "false"}
        error={!!error}
      />
      {error && (
        <p
          aria-live="polite"
          id={`${id}-error`}
          className="mt-1 text-danger text-sm"
        >
          {error}
        </p>
      )}
    </div>
  );
};
