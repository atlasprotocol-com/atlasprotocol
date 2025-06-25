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
        className,
      )}
      href={href}
      type={type}
      ref={ref}
      {...others}
    >
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
