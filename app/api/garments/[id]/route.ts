import { del, get } from "@vercel/blob";
import { hasClosetAccess } from "@/lib/closet-auth";

export const runtime = "nodejs";

type Garment = { imagePath: string };

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
