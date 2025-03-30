import { cva, VariantProps } from "class-variance-authority";
import React, { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

export const buttonVariants = cva(
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

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends Omit<
      React.AnchorHTMLAttributes<HTMLAnchorElement> &
        React.ButtonHTMLAttributes<HTMLButtonElement>,
      keyof ButtonVariantProps
    >,
    ButtonVariantProps {
  startIcon?: React.ReactNode;
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
    ...others
  } = props;
  const tag = href ? "a" : "button";

  const Component = tag as any;

  return (
    <Component
      className={twMerge(
        buttonVariants({
          intent,
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
    </Component>
  );
});
