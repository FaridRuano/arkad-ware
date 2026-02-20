import { authConfig } from "@auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const userType = req.auth?.user?.role; // <-- aquí: 'admin' o lo que uses
  const isAdmin = userType === "admin";

  const { pathname } = req.nextUrl;

  // 1) Si no está logueado, bloquear /client y /admin (y volver a "/")
  if (!isLoggedIn) {
    if (pathname.startsWith("/client") || pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 2) Si está logueado y entra a "/" => redirigir según tipo
  if (pathname === "/") {
    return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/client", req.url));
  }

  // 3) Si es admin y entra a /client => mandarlo a /admin
  if (isAdmin && pathname.startsWith("/client")) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // 4) Si NO es admin y entra a /admin => mandarlo a /client
  if (!isAdmin && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/client", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/client/:path*", "/admin/:path*"],
};