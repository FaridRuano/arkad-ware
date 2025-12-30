import { authConfig } from "@auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const { pathname } = req.nextUrl;

  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/client", req.url));
  }

  if (pathname.startsWith("/client") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/client/:path*"],
};
