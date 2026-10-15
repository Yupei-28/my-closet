import { del, get, put } from "@vercel/blob";
import { hasClosetAccess } from "@/lib/closet-auth";

export const runtime = "nodejs";

type Garment = { id: string; name: string; category: string; material: string; seasons: string[]; style: string; imagePath: string; imageMime: string; imageScale: number; imageOffsetX: number; imageOffsetY: number; createdAt: string };

function isSafeId(id: string) {
  return /^[a-z0-9-]{1,80}$/i.test(id);
}

async function readGarment(pathname: string): Promise<Garment | null> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text()) as Garment;
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });

  const { id } = await context.params;
  if (!isSafeId(id)) return Response.json({ error: "无效的单品。" }, { status: 400 });

  try {
    const metadataPath = `garments/${id}/meta.json`;
    const garment = await readGarment(metadataPath);
    if (!garment) return Response.json({ error: "没有找到这件单品。" }, { status: 404 });

    // imagePath comes from the stored metadata, rather than from the browser.
    await del([garment.imagePath, metadataPath]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "暂时无法删除，请稍后再试。" }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  const { id } = await context.params;
  if (!isSafeId(id)) return Response.json({ error: "无效的单品。" }, { status: 400 });
  try {
    const metadataPath = `garments/${id}/meta.json`;
    const existing = await readGarment(metadataPath);
    if (!existing) return Response.json({ error: "没有找到这件单品。" }, { status: 404 });
    const data = await request.json() as Partial<Garment>;
    const seasons = Array.isArray(data.seasons) ? data.seasons.filter((item): item is string => typeof item === "string").slice(0, 5) : existing.seasons;
    const garment: Garment = { ...existing, name: String(data.name ?? existing.name).slice(0, 80), category: String(data.category ?? existing.category).slice(0, 30), material: String(data.material ?? existing.material).slice(0, 80), seasons: seasons.length ? seasons : ["四季"], style: String(data.style ?? existing.style).slice(0, 80), imageScale: typeof data.imageScale === "number" ? Math.min(1.8, Math.max(0.8, data.imageScale)) : existing.imageScale || 1, imageOffsetX: typeof data.imageOffsetX === "number" ? Math.min(18, Math.max(-18, data.imageOffsetX)) : existing.imageOffsetX || 0, imageOffsetY: typeof data.imageOffsetY === "number" ? Math.min(18, Math.max(-18, data.imageOffsetY)) : existing.imageOffsetY || 0 };
    await put(metadataPath, JSON.stringify(garment), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    return Response.json({ garment: { ...garment, imageUrl: `/api/garments/${id}/image` } });
  } catch { return Response.json({ error: "暂时无法更新单品。" }, { status: 503 }); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  const { id } = await context.params;
  if (!isSafeId(id)) return Response.json({ error: "无效的单品。" }, { status: 400 });
  try {
    const metadataPath = `garments/${id}/meta.json`;
    const existing = await readGarment(metadataPath);
    if (!existing) return Response.json({ error: "没有找到这件单品。" }, { status: 404 });
    const mime = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mime.startsWith("image/")) return Response.json({ error: "请选择一张图片。" }, { status: 400 });
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) return Response.json({ error: "图片需在 10MB 以内。" }, { status: 400 });
    const data = JSON.parse(decodeURIComponent(request.headers.get("x-closet-meta") || "{}")) as Partial<Garment>;
    const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const imagePath = `garments/${id}/image.${extension}`;
    const seasons = Array.isArray(data.seasons) ? data.seasons.filter((item): item is string => typeof item === "string").slice(0, 5) : existing.seasons;
    const garment: Garment = { ...existing, name: String(data.name ?? existing.name).slice(0, 80), category: String(data.category ?? existing.category).slice(0, 30), material: String(data.material ?? existing.material).slice(0, 80), seasons: seasons.length ? seasons : ["四季"], style: String(data.style ?? existing.style).slice(0, 80), imageScale: typeof data.imageScale === "number" ? Math.min(1.8, Math.max(0.8, data.imageScale)) : 1, imageOffsetX: typeof data.imageOffsetX === "number" ? Math.min(18, Math.max(-18, data.imageOffsetX)) : 0, imageOffsetY: typeof data.imageOffsetY === "number" ? Math.min(18, Math.max(-18, data.imageOffsetY)) : 0, imagePath, imageMime: mime };
    await put(imagePath, new Blob([bytes], { type: mime }), { access: "private", contentType: mime, addRandomSuffix: false, allowOverwrite: true });
    if (existing.imagePath !== imagePath) await del(existing.imagePath);
    await put(metadataPath, JSON.stringify(garment), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    return Response.json({ garment: { ...garment, imageUrl: `/api/garments/${id}/image` } });
  } catch { return Response.json({ error: "暂时无法替换照片。" }, { status: 503 }); }
}
