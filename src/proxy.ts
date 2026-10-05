import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect only — real authentication and authorization happen
 * server-side in every page and action (see src/server/rbac.ts).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("ak_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
