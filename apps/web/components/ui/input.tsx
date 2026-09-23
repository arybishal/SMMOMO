import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className="block text-sm font-medium text-zinc-700"
      {...props}
    />
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-zinc-900
        ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400
        focus:ring-2 focus:ring-inset focus:ring-indigo-600 ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-zinc-900
        ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400
        focus:ring-2 focus:ring-inset focus:ring-indigo-600 ${className}`}
      {...props}
    />
  );
}
