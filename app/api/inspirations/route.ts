import { del, get, list, put } from "@vercel/blob";
import { hasClosetAccess } from "@/lib/closet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Inspiration = { id: string; season: string; imagePath: string; imageMime: string; createdAt: string };

async function readJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text()) as T;
}

export async function GET() {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const { blobs } = await list({ prefix: "inspirations/", limit: 1000 });
    const inspirations = (await Promise.all(blobs.filter((blob) => blob.pathname.endsWith("/meta.json")).map((blob) => readJson<Inspiration>(blob.pathname))))
      .filter((item): item is Inspiration => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({ ...item, imageUrl: `/api/inspirations/${item.id}/image` }));
    return Response.json({ inspirations });
  } catch {
    return Response.json({ error: "暂时无法读取灵感库存。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const requestType = request.headers.get("content-type") || "";
    let mime = requestType.split(";")[0].trim().toLowerCase();
    let season = String(request.headers.get("x-inspiration-season") || "四季").slice(0, 30);
    let bytes: ArrayBuffer;
    if (requestType.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const image = form.get("image");
      if (!(image instanceof File)) return Response.json({ error: "请选择一张图片。" }, { status: 400 });
      mime = image.type || "image/jpeg";
      season = String(form.get("season") || "四季").slice(0, 30);
      bytes = await image.arrayBuffer();
    } else {
      bytes = await request.arrayBuffer();
    }
    if (!mime.startsWith("image/")) return Response.json({ error: "请选择一张图片。" }, { status: 400 });
    if (!bytes.byteLength) return Response.json({ error: "图片为空，请重新选择。" }, { status: 400 });
    if (bytes.byteLength > 10 * 1024 * 1024) return Response.json({ error: "图片请控制在 10MB 以内。" }, { status: 400 });
    const id = crypto.randomUUID();
    const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const imagePath = `inspirations/${id}/image.${extension}`;
    const inspiration: Inspiration = { id, season, imagePath, imageMime: mime, createdAt: new Date().toISOString() };
    await put(imagePath, new Blob([bytes], { type: mime }), { access: "private", contentType: mime, addRandomSuffix: false });
    await put(`inspirations/${id}/meta.json`, JSON.stringify(inspiration), { access: "private", contentType: "application/json", addRandomSuffix: false });
    return Response.json({ inspiration: { ...inspiration, imageUrl: `/api/inspirations/${id}/image` } }, { status: 201 });
  } catch {
    return Response.json({ error: "灵感图片暂时无法保存，请稍后再试。" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!(await hasClosetAccess())) return Response.json({ error: "未授权" }, { status: 401 });
  try {
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(id)) return Response.json({ error: "无效的灵感图片。" }, { status: 400 });
    const metaPath = `inspirations/${id}/meta.json`;
    const inspiration = await readJson<Inspiration>(metaPath);
    if (!inspiration) return Response.json({ error: "没有找到这张图片。" }, { status: 404 });
    await del([inspiration.imagePath, metaPath]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "暂时无法删除图片。" }, { status: 503 });
  }
}
