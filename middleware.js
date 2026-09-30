import { NextResponse } from "next/server";

const SOCIAL_BOT = /(linkedin|twitterbot|facebookexternalhit|slackbot|discordbot|whatsapp|telegrambot|pinterest|skypeuripreview|google-inspectiontool)/i;

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (!SOCIAL_BOT.test(request.headers.get("user-agent") || "")) return NextResponse.next();
  if (!/^\/(collections|movies)\/[^/]+\/?$/.test(pathname)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/api/social-meta";
  url.search = "";
  url.searchParams.set("path", pathname);
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/collections/:path*", "/movies/:path*"] };
