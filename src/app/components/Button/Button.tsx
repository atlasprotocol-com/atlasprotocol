import { cva, VariantProps } from "class-variance-authority";
import React, { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

export const buttonVariants = cva(
  "h-10 px-4 py-2 rounded-[40px] justify-center items-center gap-2 inline-flex font-medium disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:ring-0 relative transition-colors duration-200",
  {
    variants: {
      intent: {
        fill: [
          "text-primary-foreground bg-primary border border-primary hover:bg-primary-100 hover:text-primary-800 disabled:bg-primary-200 disabled:text-primary-600",
        ],
        outline: [
          "color-primary border border-primary hover:bg-primary-100 hover:text-primary-800",
        ],
      },
      size: {
        default: ["text-base"],
        sm: ["text-sm", "px-2", "py-0.5", "rounded-[30px]", "h-8"],
        icon: ["text-sm"],
      },
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends Omit<
      React.AnchorHTMLAttributes<HTMLAnchorElement> &
        React.ButtonHTMLAttributes<HTMLButtonElement>,
      keyof ButtonVariantProps
    >,
    ButtonVariantProps {
  startIcon?: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(function Button(props, ref) {
  const {
    intent = "fill",
    href,
    children,
    className,
    type = "button",
    startIcon,
    size = "default",
    isLoading = false,
    loadingText,
    disabled,
    ...others
  } = props;
  const tag = href ? "a" : "button";

  const Component = tag as any;

  return (
    <Component
      className={twMerge(
        buttonVariants({
          intent,
          size,
        }),
        'inline-flex items-center justify-center',
        className,
        isLoading ? 'cursor-wait' : ''
      )}
      disabled={disabled || isLoading}
      href={href}
      type={type}
      ref={ref}
      {...others}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {loadingText || children}
        </>
      ) : (
        <>
          {startIcon && (
            <span className="flex items-center justify-center text-[20px] leading-none">
              {startIcon}
            </span>
          )}
          {children}
        </>
      )}
    </Component>
  );
});
