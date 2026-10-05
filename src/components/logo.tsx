import Link from "next/link";
import { cn } from "@/lib/cn";

export function Feather({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("text-brand", className)}>
      <path
        d="M57 3c-17 1-32 11-39 27-3.6 8.3-4.8 15.8-5 21.4l4.3-2.3c2-7 6-13.2 11.4-17.6-3.6 5.6-6 10.9-7 15.2C35 43.6 47 33.3 53 19.6 55.8 13.3 57.6 8 57 3Z"
        fill="currentColor"
      />
      <path
        d="M43 12.5 33.5 19M48.5 20.5l-11 5.6M50 29.5l-9.5 3.8"
        stroke="var(--color-paper)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M13.5 50.5 7 61" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({
  href = "/",
  size = "md",
  subtitle,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
}) {
  const s = { sm: ["h-7 w-7", "text-[1.7rem]"], md: ["h-9 w-9", "text-[2.1rem]"], lg: ["h-16 w-16", "text-[3.6rem]"] }[size];
  return (
    <Link href={href} className="group inline-flex flex-col">
      <span className="inline-flex items-end gap-1">
        <Feather className={cn(s[0], "-mr-2 -mb-1 transition-transform group-hover:-rotate-6")} />
        <span className={cn("font-script leading-none text-ink", s[1])}>Arthakram</span>
      </span>
      {subtitle && <span className="eyebrow mt-1 !text-[0.6rem] !tracking-[0.28em] pl-1">{subtitle}</span>}
    </Link>
  );
}
