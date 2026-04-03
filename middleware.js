import { authConfig } from "@auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const userType = req.auth?.user?.role;
  const isAdmin = userType === "admin";
  const isFirstLogin = req.auth?.user?.isFirstLogin === true;

  const { pathname } = req.nextUrl;

  const isHome = pathname === "/";
  const isClientRoute = pathname.startsWith("/client");
  const isAdminRoute = pathname.startsWith("/admin");
  const isUpdatePasswordRoute = pathname.startsWith("/auth/update-password");

  if (!isLoggedIn) {
    if (isClientRoute || isAdminRoute || isUpdatePasswordRoute) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  }

  if (isFirstLogin) {
    if (!isUpdatePasswordRoute) {
      return NextResponse.redirect(new URL("/auth/update-password", req.url));
    }

    return NextResponse.next();
  }

  if (!isFirstLogin && isUpdatePasswordRoute) {
    return NextResponse.redirect(
      new URL(isAdmin ? "/admin" : "/client", req.url)
    );
  }

  if (isHome) {
    return NextResponse.redirect(
      new URL(isAdmin ? "/admin" : "/client", req.url)
    );
  }

  if (isAdmin && isClientRoute) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (!isAdmin && isAdminRoute) {
    return NextResponse.redirect(new URL("/client", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/client/:path*", "/admin/:path*", "/auth/update-password"],
};