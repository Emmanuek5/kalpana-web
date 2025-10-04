import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/api/auth","/"];
  
  // Check if the route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for session cookie (better-auth uses 'better-auth.session_token')
  const sessionToken = request.cookies.get("better-auth.session_token");

  // If no session token, redirect to login
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)",
  ],
};
