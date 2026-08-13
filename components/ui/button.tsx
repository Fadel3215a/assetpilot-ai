import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-elevated focus-visible:ring-border",
  ghost:
    "text-muted hover:bg-surface-elevated hover:text-foreground focus-visible:ring-border",
  danger:
    "bg-status-danger/90 text-foreground hover:bg-status-danger focus-visible:ring-status-danger",
  success:
    "border border-status-success/40 bg-status-success-muted text-status-success hover:bg-status-success/20 focus-visible:ring-status-success",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
