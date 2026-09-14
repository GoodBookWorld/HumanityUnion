import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={className ? `hu-card ${className}` : "hu-card"}
      {...rest}
    >
      {children}
    </div>
  );
}
