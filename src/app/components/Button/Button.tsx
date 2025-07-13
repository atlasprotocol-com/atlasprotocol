import { cva, VariantProps } from "class-variance-authority";
import React, { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        // Primary gradient button from rebrand guide
        gradient: [
          "bg-gradient-to-r from-brand-orange-primary to-brand-orange-light",
          "text-white rounded-full border-0",
          "hover:opacity-90 active:scale-95",
          "shadow-lg hover:shadow-xl",
        ],
        // Primary outline button from rebrand guide
        outline: [
          "border-2 border-brand-orange-primary bg-transparent",
          "text-brand-orange-primary rounded-full",
          "hover:bg-brand-orange-primary/5 active:bg-brand-orange-primary/10",
        ],
        // Updated fill variant with new colors
        fill: [
          "bg-primary text-primary-foreground rounded-full",
          "hover:bg-primary/90 active:scale-95",
          "shadow-md hover:shadow-lg",
        ],
        // Secondary variant
        secondary: [
          "bg-secondary text-secondary-foreground rounded-lg",
          "hover:bg-secondary/80",
        ],
        // Ghost variant
        ghost: [
          "bg-transparent text-foreground/70 rounded-lg",
          "hover:bg-accent/10 hover:text-foreground",
        ],
        // Destructive variant
        destructive: [
          "bg-destructive text-white rounded-lg",
          "hover:bg-destructive/90",
        ],
      },
      size: {
        sm: ["h-8 px-3 text-sm"],
        default: ["h-10 px-4 py-2 text-base"],
        lg: ["h-12 px-6 text-lg"],
        icon: ["h-10 w-10 text-sm"],
      },
    },
    defaultVariants: {
      variant: "fill",
      size: "default",
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
  endIcon?: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(function Button(props, ref) {
  const {
    variant = "fill",
    size = "default",
    href,
    children,
    className,
    type = "button",
    startIcon,
    endIcon,
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
          variant,
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
          {endIcon && (
            <span className="flex items-center justify-center text-[20px] leading-none">
              {endIcon}
            </span>
          )}
        </>
      )}
    </Component>
  );
});

// Legacy export for backward compatibility
export const buttonVariants_legacy = cva(
  "h-10 px-4 py-2 rounded-[40px] justify-center items-center gap-2 inline-flex font-medium disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:ring-0 transition-colors duration-200",
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
        icon: ["text-sm"],
      },
    },
  },
);