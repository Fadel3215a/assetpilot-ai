import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-[0_0_0_1px_rgba(0,245,160,0.25),0_4px_14px_-4px_rgba(0,245,160,0.35)] active:shadow-[0_0_0_1px_rgba(0,245,160,0.2),0_1px_3px_-1px_rgba(0,245,160,0.3)] focus-visible:ring-accent",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-elevated hover:border-accent/25 focus-visible:ring-border",
  ghost:
    "text-muted hover:bg-surface-elevated/70 hover:text-foreground focus-visible:ring-border",
  danger:
    "bg-status-danger/90 text-foreground hover:bg-status-danger hover:shadow-[0_0_0_1px_rgba(248,113,113,0.25),0_4px_12px_-4px_rgba(248,113,113,0.3)] active:shadow-[0_0_0_1px_rgba(248,113,113,0.2),0_1px_3px_-1px_rgba(248,113,113,0.25)] focus-visible:ring-status-danger",
  success:
    "border border-status-success/40 bg-status-success-muted text-status-success hover:bg-status-success/20 hover:border-status-success/60 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.2),0_4px_12px_-4px_rgba(52,211,153,0.3)] active:shadow-[0_0_0_1px_rgba(52,211,153,0.15),0_1px_3px_-1px_rgba(52,211,153,0.25)] focus-visible:ring-status-success",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] hover:-translate-y-px hover:scale-[1.015] active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:transform-none ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}