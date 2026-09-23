import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className="block text-sm font-medium text-zinc-700"
      {...props}
    />
  );
}

// Shared field chrome: surface + control radius + primary focus ring.
// ring-zinc-300 is the control border (one step stronger than card borders);
// placeholder uses the subtle text token.
const fieldClasses = `block w-full rounded-control border-0 bg-surface px-3 py-2 text-sm text-foreground
  ring-1 ring-inset ring-zinc-300 placeholder:text-subtle-foreground
  focus:ring-2 focus:ring-inset focus:ring-primary`;

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={`${fieldClasses} ${className}`} {...props} />
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`${fieldClasses} ${className}`} {...props} />
  );
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClasses} ${className}`} {...props} />;
}
