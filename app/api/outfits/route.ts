import { del, get, list, put } from "@vercel/blob";
import { hasClosetAccess } from "@/lib/closet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Outfit = {
  id: string;
  title: string;
  slots: Record<string, string | null>;
  createdAt: string;
};

async function readJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text()) as T;
}

export async function GET() {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const { blobs } = await list({ prefix: "outfits/", limit: 1000 });
    const outfits = (await Promise.all(blobs.filter((blob) => blob.pathname.endsWith(".json")).map((blob) => readJson<Outfit>(blob.pathname))))
      .filter((item): item is Outfit => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Response.json({ outfits });
  } catch {
    return Response.json({ error: "暂时无法读取造型。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const data = await request.json() as { title?: unknown; slots?: unknown };
    const title = String(data.title || "未命名造型").trim().slice(0, 80) || "未命名造型";
    const rawSlots = data.slots && typeof data.slots === "object" ? data.slots as Record<string, unknown> : {};
    const slots = Object.fromEntries(["accessory", "outerwear", "top", "bottom", "shoes"].map((key) => [key, typeof rawSlots[key] === "string" ? rawSlots[key].slice(0, 80) : null]));
    if (!Object.values(slots).some(Boolean)) return Response.json({ error: "请至少放入一件单品。" }, { status: 400 });
    const outfit: Outfit = { id: crypto.randomUUID(), title, slots, createdAt: new Date().toISOString() };
    await put(`outfits/${outfit.id}.json`, JSON.stringify(outfit), { access: "private", contentType: "application/json", addRandomSuffix: false });
    return Response.json({ outfit }, { status: 201 });
  } catch {
    return Response.json({ error: "暂时无法保存造型，请稍后再试。" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(id)) return Response.json({ error: "无效的造型。" }, { status: 400 });
    await del(`outfits/${id}.json`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "暂时无法删除造型。" }, { status: 503 });
  }
}
