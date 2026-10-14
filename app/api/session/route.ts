import { NextResponse } from "next/server";
import { accessCookie, hasClosetAccess, isValidAccessCode } from "@/lib/closet-auth";

export const runtime = "nodejs";
export async function GET() { return NextResponse.json({ authorized: await hasClosetAccess() }); }
export async function POST(request: Request) {
  const { code } = await request.json() as { code?: unknown };
  if (!isValidAccessCode(code)) return NextResponse.json({ error: "访问码不正确，或尚未在 Vercel 中设置。" }, { status: 401 });
  const validCode = code as string;
  const response = NextResponse.json({ authorized: true });
  response.cookies.set(accessCookie(validCode));
  return response;
}
