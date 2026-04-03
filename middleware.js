import { auth } from "@auth";
import { NextResponse } from "next/server";

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

  // 1) Si no está logueado, bloquear /client, /admin y update-password
  if (!isLoggedIn) {
    if (isClientRoute || isAdminRoute || isUpdatePasswordRoute) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  }

  // 2) Si está logueado pero es primer ingreso, forzar cambio de clave
  if (isFirstLogin) {
    if (!isUpdatePasswordRoute) {
      return NextResponse.redirect(new URL("/auth/update-password", req.url));
    }

    return NextResponse.next();
  }

  // 3) Si ya no es primer ingreso y entra a update-password, redirigir según rol
  if (!isFirstLogin && isUpdatePasswordRoute) {
    return NextResponse.redirect(
      new URL(isAdmin ? "/admin" : "/client", req.url)
    );
  }

  // 4) Si está logueado y entra a "/" => redirigir según tipo
  if (isHome) {
    return NextResponse.redirect(
      new URL(isAdmin ? "/admin" : "/client", req.url)
    );
  }

  // 5) Si es admin y entra a /client => mandarlo a /admin
  if (isAdmin && isClientRoute) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // 6) Si NO es admin y entra a /admin => mandarlo a /client
  if (!isAdmin && isAdminRoute) {
    return NextResponse.redirect(new URL("/client", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/client/:path*", "/admin/:path*", "/auth/update-password"],
};