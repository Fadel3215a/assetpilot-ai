import { type HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
}

export function Badge({ color, className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${className}`}
      style={
        color
          ? { backgroundColor: `${color}20`, color }
          : undefined
      }
      {...props}
    >
      {children}
    </span>
  );
}
