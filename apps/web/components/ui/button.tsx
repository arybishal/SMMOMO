import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Shared interaction language: tokenized colors, control radius,
// visible keyboard focus (outline-2 + offset), disabled opacity, color transition.
const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:outline-primary",
  secondary:
    "bg-surface text-foreground ring-1 ring-border hover:bg-surface-muted focus-visible:outline-subtle-foreground",
  // zinc-600/zinc-100 are intermediate greys with no semantic token (see README).
  ghost:
    "text-zinc-600 hover:bg-neutral-soft hover:text-foreground focus-visible:outline-subtle-foreground",
  danger:
    "bg-danger text-danger-foreground hover:bg-danger-hover focus-visible:outline-danger",
};

export function buttonClasses(variant: Variant = "primary"): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-control px-3.5 py-2 text-sm font-medium",
    "focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
  ].join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClasses(variant)} ${className}`}
      {...props}
    />
  );
}
