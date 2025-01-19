import { twMerge } from "tailwind-merge";

export interface CardProps {
  children?: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={twMerge("bg-card-bg p-4 rounded-lg", className)}>
      {children}
    </div>
  );
}
