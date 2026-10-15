import { get, list, put } from "@vercel/blob";
import { hasClosetAccess } from "@/lib/closet-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Garment = { id: string; name: string; category: string; material: string; seasons: string[]; style: string; imagePath: string; imageMime: string; imageScale: number; imageOffsetX: number; imageOffsetY: number; createdAt: string };
async function readJson<T>(pathname: string): Promise<T | null> { const result = await get(pathname, { access: "private" }); if (!result || result.statusCode !== 200 || !result.stream) return null; return JSON.parse(await new Response(result.stream).text()) as T; }
export async function GET() { if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 }); try { const { blobs } = await list({ prefix: "garments/", limit: 1000 }); const paths = blobs.filter((blob) => blob.pathname.endsWith("/meta.json")).map((blob) => blob.pathname); const garments = (await Promise.all(paths.map((path) => readJson<Garment>(path)))).filter((item): item is Garment => item !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => ({ ...item, seasons: Array.isArray(item.seasons) ? item.seasons : [item.seasons as unknown as string], imageUrl: `/api/garments/${item.id}/image` })); return Response.json({ garments }); } catch { return Response.json({ error: "照片存储尚未连接。请先在 Vercel 创建私有 Blob 存储。" }, { status: 503 }); } }
export async function POST(request: Request) {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const mime = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mime.startsWith("image/")) return Response.json({ error: "请上传一张图片。" }, { status: 400 });

    const encodedMeta = request.headers.get("x-closet-meta");
    if (!encodedMeta) return Response.json({ error: "缺少单品信息，请重新保存。" }, { status: 400 });
    const data = JSON.parse(decodeURIComponent(encodedMeta)) as Record<string, unknown>;
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return Response.json({ error: "图片为空，请重新选择。" }, { status: 400 });
    if (bytes.byteLength > 10 * 1024 * 1024) return Response.json({ error: "图片请控制在 10MB 以内。" }, { status: 400 });

    const id = crypto.randomUUID();
    const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const imagePath = `garments/${id}/image.${extension}`;
    const safeNumber = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    const selectedSeasons = Array.isArray(data.seasons) ? data.seasons.filter((season): season is string => typeof season === "string").map((season) => season.slice(0, 30)).slice(0, 5) : [String(data.seasons || "四季").slice(0, 30)];
    const garment: Garment = { id, name: String(data.name || "我的单品").slice(0, 80), category: String(data.category || "未分类").slice(0, 30), material: String(data.material || "待补充").slice(0, 80), seasons: selectedSeasons.length ? selectedSeasons : ["四季"], style: String(data.style || "待补充").slice(0, 80), imagePath, imageMime: mime, imageScale: safeNumber(data.imageScale, 1, 0.8, 1.8), imageOffsetX: safeNumber(data.imageOffsetX, 0, -18, 18), imageOffsetY: safeNumber(data.imageOffsetY, 0, -18, 18), createdAt: new Date().toISOString() };
    await put(imagePath, new Blob([bytes], { type: mime }), { access: "private", contentType: mime, addRandomSuffix: false });
    await put(`garments/${id}/meta.json`, JSON.stringify(garment), { access: "private", contentType: "application/json", addRandomSuffix: false });
    return Response.json({ garment: { ...garment, imageUrl: `/api/garments/${id}/image` } }, { status: 201 });
  } catch {
    return Response.json({ error: "照片暂时无法保存，请稍后再试。" }, { status: 503 });
  }
}
