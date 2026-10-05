"use client";

import { useActionState, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import { buttonClass, type ButtonStyle } from "./ui";

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, string>;
};
export type FormAction = (prev: ActionState | undefined, fd: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  className,
  ...rest
}: ComponentProps<"button"> & ButtonStyle & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || rest.disabled} {...rest} className={buttonClass({ variant, size }, className)}>
      {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * A form bound to a server action returning ActionState. Shows errors and
 * success messages inline. Authorization always happens on the server.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  successMessage,
  hidden,
  confirm,
  onDone,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  successMessage?: string;
  hidden?: Record<string, string | number | undefined | null>;
  confirm?: string;
  onDone?: (s: ActionState) => void;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
    if (state) onDone?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden &&
        Object.entries(hidden).map(([k, v]) => (v == null ? null : <input key={k} type="hidden" name={k} value={String(v)} />))}
      {children}
      <FormMessage state={state} successMessage={successMessage} />
    </form>
  );
}

export function FormMessage({ state, successMessage }: { state?: ActionState; successMessage?: string }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="mt-3 rounded-lg border border-bad/20 bg-red-50 px-3 py-2 text-sm text-bad">
        {state.error}
      </p>
    );
  const msg = state.message ?? successMessage;
  if (state.ok && msg)
    return (
      <p role="status" className="mt-3 rounded-lg border border-ok/20 bg-green-50 px-3 py-2 text-sm text-ok">
        {msg}
      </p>
    );
  return null;
}

/** A one-click action (delete, publish, start…) rendered as a tiny form. */
export function ActionButton({
  action,
  hidden,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  className,
  title,
}: {
  action: FormAction;
  hidden?: Record<string, string | number | undefined | null>;
  children: ReactNode;
  confirm?: string;
  className?: string;
  title?: string;
} & ButtonStyle) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="inline-flex flex-col"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden &&
        Object.entries(hidden).map(([k, v]) => (v == null ? null : <input key={k} type="hidden" name={k} value={String(v)} />))}
      <SubmitButton variant={variant} size={size} className={className} title={title}>
        {children}
      </SubmitButton>
      {state?.error && <span className="mt-1 max-w-56 text-xs text-bad">{state.error}</span>}
    </form>
  );
}

/* ───────── Fields ───────── */

const control =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-paper-2";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cn(control, "h-10", props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={4} {...props} className={cn(control, "leading-relaxed", props.className)} />;
}

export function Select({
  options,
  placeholder,
  ...props
}: ComponentProps<"select"> & { options: (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <select {...props} className={cn(control, "h-10", props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        );
      })}
    </select>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <input type="checkbox" {...props} className="h-4 w-4 rounded border-line accent-[var(--color-brand)]" />
      {label}
    </label>
  );
}
