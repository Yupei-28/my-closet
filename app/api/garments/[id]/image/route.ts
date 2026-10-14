import { get } from "@vercel/blob";
import { hasClosetAccess } from "@/lib/closet-auth";
export const runtime = "nodejs";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) { if (!(await hasClosetAccess())) return new Response("Unauthorized", { status: 401 }); const { id } = await context.params; for (const extension of ["jpg", "png", "webp"]) { const result = await get(`garments/${id}/image.${extension}`, { access: "private" }); if (result && result.statusCode === 200 && result.stream) return new Response(result.stream, { headers: { "content-type": result.blob.contentType || "image/jpeg", "cache-control": "private, no-cache", "x-content-type-options": "nosniff" } }); } return new Response("Not found", { status: 404 }); }
