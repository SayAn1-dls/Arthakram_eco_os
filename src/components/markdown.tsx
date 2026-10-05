import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

/** Safe markdown: raw HTML is never rendered (react-markdown default). */
export function Markdown({ children, className }: { children: string | null | undefined; className?: string }) {
  if (!children?.trim()) return <p className="text-sm text-muted">Nothing written yet.</p>;
  return (
    <div className={cn("prose-ak", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
