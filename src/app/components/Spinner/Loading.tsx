import * as React from "react";
import { twMerge } from "tailwind-merge";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const spinnerVariants =
  "w-10 h-10 border-4 border-t-4 border-gray-200 border-t-gray-600 rounded-full animate-spin";

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  (props, ref) => {
    const { className, ...rest } = props;
    return (
      <div
        ref={ref}
        className={twMerge(spinnerVariants, className)}
        {...rest}
      />
    );
  }
);

LoadingSpinner.displayName = "LoadingSpinner";

export { LoadingSpinner };
