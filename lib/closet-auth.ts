import { cookies } from "next/headers";

const COOKIE_NAME = "my_closet_access";

export async function hasClosetAccess() {
  const expected = process.env.CLOSET_ACCESS_CODE;
  if (!expected) return false;
  return (await cookies()).get(COOKIE_NAME)?.value === expected;
}

export function isValidAccessCode(code: unknown) {
  const expected = process.env.CLOSET_ACCESS_CODE;
  return typeof code === "string" && Boolean(expected) && code === expected;
}

export function accessCookie(value: string) {
  return { name: COOKIE_NAME, value, httpOnly: true, secure: true, sameSite: "strict" as const, path: "/", maxAge: 60 * 60 * 24 * 90 };
}
