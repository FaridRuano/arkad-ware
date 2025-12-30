import { NextResponse } from "next/server";
import { auth } from "@auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const { pathname } = req.nextUrl;

  // Si está logeado y entra a "/", manda a /client
  if (pathname === "/" && isLoggedIn) {
    return NextResponse.redirect(new URL("/client", req.url));
  }

  // Si NO está logeado e intenta /client, manda al login
  if (pathname.startsWith("/client") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/", "/client/:path*"],
};
