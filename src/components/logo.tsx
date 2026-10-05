import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import logo from "../../public/brand/arthakram-logo.png";
import lockup from "../../public/brand/arthakram-lockup.png";
import feather from "../../public/brand/arthakram-feather.png";

/**
 * The real Arthakram mark, cut from the Founders Day poster
 * (see scripts/extract-logo.cjs). Never redraw it in code.
 */
export function Feather({ className, size = 40 }: { className?: string; size?: number }) {
  return <Image src={feather} alt="" width={size} height={size} className={cn("select-none", className)} aria-hidden />;
}

const HEIGHTS = { sm: 56, md: 72, lg: 120 } as const;

export function Wordmark({
  href = "/",
  size = "md",
  subtitle,
  withClubLine = false,
  priority = false,
}: {
  href?: string;
  size?: keyof typeof HEIGHTS;
  /** Small label set beside the logo, e.g. "Ecosystem". */
  subtitle?: string;
  /** Use the full poster lockup with "Product & Consulting Club". */
  withClubLine?: boolean;
  priority?: boolean;
}) {
  const src = withClubLine ? lockup : logo;
  const h = HEIGHTS[size];
  const w = Math.round((src.width / src.height) * h);
  return (
    <Link href={href} className="inline-flex items-end gap-2" aria-label="Arthakram home">
      <Image src={src} alt="Arthakram" width={w} height={h} priority={priority} className="select-none" />
      {subtitle && <span className="mb-1 rounded bg-paper-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{subtitle}</span>}
    </Link>
  );
}
