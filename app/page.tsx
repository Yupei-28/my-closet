"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Heart, ImagePlus, LoaderCircle, Pencil, Plus, Shirt, Sparkles, Trash2, Wand2, X } from "lucide-react";

type Garment = { id: string; name: string; category: string; material: string; seasons: string[]; style: string; imageUrl: string; imageScale?: number; imageOffsetX?: number; imageOffsetY?: number };
type Inspiration = { id: string; season: string; imageUrl: string };
type OutfitSlot = "accessory" | "outerwear" | "top" | "bottom" | "shoes";
type Outfit = { id: string; title: string; slots: Record<OutfitSlot, string | null>; createdAt: string };
const categories = ["上装", "下装", "裙装", "外套", "鞋履", "包袋", "配饰"];
const seasons = ["春", "夏", "秋", "冬", "四季"];
const outfitSlotNames: Record<OutfitSlot, string> = { accessory: "头部 / 配饰", outerwear: "外套", top: "上装", bottom: "下装 / 裙装", shoes: "鞋履" };

// The background-removal library returns a temporary Blob. On some iPhones
// Safari can preview that Blob but cannot read it again for upload. Redrawing
// it through a canvas produces an ordinary, portable PNG while keeping alpha.
async function makePortablePng(source: Blob): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("图片无法处理"));
      element.src = sourceUrl;
    });
    // One transparent portrait canvas makes every clothing card feel like a
    // consistent product catalogue, regardless of the original photo shape.
    const canvasWidth = 1200;
    const canvasHeight = 1500;
    const padding = 105;
    const scale = Math.min((canvasWidth - padding * 2) / image.naturalWidth, (canvasHeight - padding * 2) / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("图片无法处理");
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    context.drawImage(image, (canvasWidth - renderedWidth) / 2, (canvasHeight - renderedHeight) / 2, renderedWidth, renderedHeight);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("图片无法处理")), "image/png"));
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function Home() {
  const fileInput = useRef<HTMLInputElement>(null);
  const inspirationInput = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<"closet" | "ideas" | "inspirations">("closet");
  const [garments, setGarments] = useState<Garment[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingInspiration, setUploadingInspiration] = useState(false);
  const [error, setError] = useState("");
  // Keep the processed image as a Blob. Some iPhone Safari versions reject a
  // File generated from a WASM image processor when it is put in FormData.
  const [file, setFile] = useState<Blob | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({ name: "", category: "上装", material: "", seasons: ["四季"], style: "", imageScale: 1, imageOffsetX: 0, imageOffsetY: 0 });
  const [outfitTitle, setOutfitTitle] = useState("");
  const [outfitSlots, setOutfitSlots] = useState<Record<OutfitSlot, string | null>>({ accessory: null, outerwear: null, top: null, bottom: null, shoes: null });
  const [activeOutfitSlot, setActiveOutfitSlot] = useState<OutfitSlot>("top");
  const [accessChecked, setAccessChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [seasonFilter, setSeasonFilter] = useState("全部");
  const [inspirationSeason, setInspirationSeason] = useState("四季");
  const [inspirationFilter, setInspirationFilter] = useState("全部");

  async function loadData() {
    try {
      const [garmentResponse, outfitResponse, inspirationResponse] = await Promise.all([fetch("/api/garments"), fetch("/api/outfits"), fetch("/api/inspirations")]);
      if (garmentResponse.ok) { const result: any = await garmentResponse.json(); setGarments(result.garments); }
      if (outfitResponse.ok) { const result: any = await outfitResponse.json(); setOutfits(result.outfits); }
      if (inspirationResponse.ok) { const result: any = await inspirationResponse.json(); setInspirations(result.inspirations); }
    } catch { setError("暂时无法读取衣橱，请刷新后重试。"); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/session");
        const result: any = await response.json();
        setAuthorized(Boolean(result.authorized));
        if (result.authorized) await loadData();
      } finally {
        setAccessChecked(true);
        setLoading(false);
      }
    })();
  }, []);

  async function unlock() {
    setError("");
    const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: accessCode }) });
    const result: any = await response.json();
    if (!response.ok) { setError(result.error || "暂时无法进入衣橱。"); return; }
    setAuthorized(true);
    setLoading(true);
    await loadData();
  }

  async function chooseFile(selected?: File) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { setError("请选择一张图片。"); return; }
    setError(""); setFile(selected); setPreview(URL.createObjectURL(selected));
    setForm((current) => ({ ...current, name: current.name || selected.name.replace(/\.[^/.]+$/, "") }));
    setIsRemovingBackground(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const cutout = await removeBackground(selected);
      const portablePng = await makePortablePng(cutout);
      if (preview) URL.revokeObjectURL(preview);
      setFile(portablePng);
      setPreview(URL.createObjectURL(portablePng));
    } catch {
      setError("自动抠图暂时没有完成，已保留原图，你仍可继续保存。");
    } finally { setIsRemovingBackground(false); }
  }
  function closeSheet() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(""); setFile(null); setEditingId(null); setForm({ name: "", category: "上装", material: "", seasons: ["四季"], style: "", imageScale: 1, imageOffsetX: 0, imageOffsetY: 0 });
  }
  function beginEdit(garment: Garment) {
    setEditingId(garment.id); setPreview(garment.imageUrl); setFile(new Blob([], { type: "image/png" }));
    setForm({ name: garment.name, category: garment.category, material: garment.material, seasons: garment.seasons, style: garment.style, imageScale: garment.imageScale || 1, imageOffsetX: garment.imageOffsetX || 0, imageOffsetY: garment.imageOffsetY || 0 });
  }
  async function saveGarment() {
    if (!file) return;
    setUploading(true); setError("");
    try {
      // Send raw image bytes rather than multipart FormData. This avoids an
      // iPhone Safari incompatibility with a File created after background removal.
      const bytes = await file.arrayBuffer();
      if (!editingId && !bytes.byteLength) throw new Error("图片处理结果为空，请重新选择照片。");
      const response = await fetch(editingId ? `/api/garments/${editingId}` : "/api/garments", {
        method: editingId ? (file.size ? "PUT" : "PATCH") : "POST",
        headers: {
          "content-type": file.size ? (file.type || "image/png") : "application/json",
          "x-closet-meta": encodeURIComponent(JSON.stringify(form)),
        },
        body: editingId && !file.size ? JSON.stringify(form) : bytes,
      });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setGarments((current) => editingId ? current.map((item) => item.id === editingId ? result.garment : item) : [result.garment, ...current]); closeSheet();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请再试一次。"); }
    finally { setUploading(false); }
  }
  async function saveOutfit() {
    if (!Object.values(outfitSlots).some(Boolean)) { setError("请先从衣橱中选择至少一件单品。 "); return; }
    setError("");
    try {
      const response = await fetch("/api/outfits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: outfitTitle, slots: outfitSlots }) }); const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setOutfits((current) => [result.outfit, ...current]); setOutfitTitle(""); setOutfitSlots({ accessory: null, outerwear: null, top: null, bottom: null, shoes: null });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请再试一次。"); }
  }
  async function deleteOutfit(id: string) {
    if (!window.confirm("确认删除这个造型吗？")) return;
    try {
      const response = await fetch("/api/outfits", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "删除失败");
      setOutfits((current) => current.filter((outfit) => outfit.id !== id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败，请再试一次。"); }
  }
  async function deleteGarment(id: string) {
    if (!window.confirm("确认删除这件衣服吗？此操作无法撤销。")) return;
    setError("");
    try {
      const response = await fetch(`/api/garments/${id}`, { method: "DELETE" });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "删除失败");
      setGarments((current) => current.filter((item) => item.id !== id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败，请再试一次。"); }
  }
  async function uploadInspiration(selected?: File) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { setError("请选择一张图片。 "); return; }
    if (selected.size > 10 * 1024 * 1024) { setError("图片请控制在 10MB 以内。 "); return; }
    setUploadingInspiration(true); setError("");
    try {
      const body = new FormData(); body.append("image", selected, "inspiration.jpg"); body.append("season", inspirationSeason);
      const response = await fetch("/api/inspirations", { method: "POST", body });
      const result: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "保存失败");
      setInspirations((current) => [result.inspiration, ...current]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请再试一次。"); }
    finally { setUploadingInspiration(false); if (inspirationInput.current) inspirationInput.current.value = ""; }
  }
  async function deleteInspiration(id: string) {
    if (!window.confirm("确认删除这张灵感图片吗？")) return;
    try {
      const response = await fetch("/api/inspirations", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "删除失败");
      setInspirations((current) => current.filter((item) => item.id !== id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败，请再试一次。"); }
  }

  if (!accessChecked) return <main className="grid min-h-dvh place-items-center bg-[#f7f4ee] text-[#766f66]"><LoaderCircle className="animate-spin" /></main>;
  if (!authorized) return <main className="grid min-h-dvh place-items-center bg-[#f7f4ee] px-5 text-[#25221f]"><section className="w-full max-w-sm rounded-[32px] bg-white p-7 shadow-[0_18px_50px_rgba(62,48,37,0.08)]"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#34312e] text-white"><Shirt size={22} /></div><p className="mt-6 text-xs font-semibold tracking-[0.18em] text-[#766f66]">MY PRIVATE CLOSET</p><h1 className="mt-2 font-serif text-3xl">进入我的衣橱</h1><p className="mt-3 text-sm leading-6 text-[#766f66]">输入你在 Vercel 设置的专属访问码。照片与灵感仅会保存在你的私有存储中。</p>{error && <p className="mt-4 rounded-xl bg-[#fff2ee] p-3 text-sm text-[#9a4433]">{error}</p>}<input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} type="password" placeholder="输入访问码" className="mt-6 w-full rounded-xl border border-[#d8d0c5] bg-[#f7f4ee] px-4 py-3 outline-none"/><button onClick={() => void unlock()} className="mt-3 w-full rounded-xl bg-[#34312e] px-4 py-3 font-medium text-white">进入衣橱</button></section></main>;

  const toggleSeason = (season: string) => setForm((current) => {
    if (season === "四季") return { ...current, seasons: ["四季"] };
    const currentSeasons = current.seasons.filter((item) => item !== "四季");
    const next = currentSeasons.includes(season) ? currentSeasons.filter((item) => item !== season) : [...currentSeasons, season];
    return { ...current, seasons: next.length ? next : ["四季"] };
  });
  const visibleGarments = garments.filter((garment) => (categoryFilter === "全部" || garment.category === categoryFilter) && (seasonFilter === "全部" || garment.seasons.includes(seasonFilter) || garment.seasons.includes("四季")));
  const selectedForSlot = (slot: OutfitSlot) => garments.find((garment) => garment.id === outfitSlots[slot]);
  const selectForSlot = (id: string) => setOutfitSlots((current) => ({ ...current, [activeOutfitSlot]: current[activeOutfitSlot] === id ? null : id }));
  const outfitSlot = (slot: OutfitSlot, className: string) => {
    const garment = selectedForSlot(slot);
    return <button onClick={() => setActiveOutfitSlot(slot)} className={`relative grid overflow-hidden rounded-2xl border-2 transition ${activeOutfitSlot === slot ? "border-[#b8624e] bg-[#fff7f2]" : "border-dashed border-[#c9c0b5] bg-[#f5f0e8]"} ${className}`}>
      {garment ? <img src={garment.imageUrl} alt={garment.name} className="h-full w-full object-contain p-2 drop-shadow-[0_7px_5px_rgba(55,43,33,0.15)]" style={{ transform: `translate(${garment.imageOffsetX || 0}%, ${garment.imageOffsetY || 0}%) scale(${garment.imageScale || 1})` }} /> : <span className="px-2 text-center text-xs leading-4 text-[#766f66]">{outfitSlotNames[slot]}<br /><span className="text-[#b8624e]">点此选择</span></span>}
      {garment && <span className="absolute bottom-1 left-1 right-1 truncate rounded-lg bg-white/90 px-1.5 py-1 text-[10px] text-[#34312e]">{garment.name}</span>}
    </button>;
  };
  return <main className="min-h-dvh bg-[#f7f4ee] pb-28 text-[#25221f]"><div className="mx-auto max-w-5xl px-5 pt-7 sm:px-8">
    <header className="flex items-start justify-between"><div><p className="text-xs font-semibold tracking-[0.2em] text-[#766f66]">MY PRIVATE CLOSET</p><h1 className="mt-2 font-serif text-4xl tracking-tight">我的衣橱</h1><p className="mt-2 text-sm text-[#766f66]">让每件衣服，都被好好看见。</p></div><div className="grid h-12 w-12 place-items-center rounded-full bg-[#34312e] text-white shadow-sm"><Shirt size={21} /></div></header>
    {error && <p className="mt-5 rounded-2xl border border-[#d99c8c] bg-[#fff2ee] px-4 py-3 text-sm text-[#9a4433]">{error}</p>}
    {section === "inspirations" ? <section className="mt-6"><div className="rounded-[28px] bg-white p-5 shadow-[0_10px_25px_rgba(62,48,37,0.06)]"><h2 className="font-serif text-2xl">灵感库存</h2><p className="mt-1 text-sm text-[#766f66]">收集想尝试的穿搭，不会进行扣图或改动原图。</p><p className="mt-5 text-sm font-medium">归档到哪个季节？</p><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{seasons.map((season) => <button key={season} onClick={() => setInspirationSeason(season)} className={`shrink-0 rounded-full px-3 py-2 text-sm ${inspirationSeason === season ? "bg-[#b8624e] text-white" : "bg-[#f7f4ee] text-[#665f58]"}`}>{season}</button>)}</div><button disabled={uploadingInspiration} onClick={() => inspirationInput.current?.click()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#34312e] px-4 py-3 font-medium text-white disabled:opacity-60"><ImagePlus size={18} />{uploadingInspiration ? "正在存入灵感库存" : "上传一张穿搭灵感图"}</button><input ref={inspirationInput} className="hidden" type="file" accept="image/*" onChange={(event) => void uploadInspiration(event.target.files?.[0])} /></div><div className="mt-7"><p className="text-xs font-semibold tracking-[0.12em] text-[#766f66]">按季节查看</p><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{["全部", ...seasons].map((season) => <button key={season} onClick={() => setInspirationFilter(season)} className={`shrink-0 rounded-full px-3 py-2 text-sm ${inspirationFilter === season ? "bg-[#34312e] text-white" : "bg-white text-[#665f58]"}`}>{season}</button>)}</div>{inspirations.filter((item) => inspirationFilter === "全部" || item.season === inspirationFilter || item.season === "四季").length === 0 ? <div className="mt-6 rounded-[28px] bg-white px-6 py-14 text-center"><ImagePlus className="mx-auto text-[#b8624e]" size={32} /><p className="mt-4 font-medium">把喜欢的穿搭存起来</p><p className="mt-2 text-sm text-[#766f66]">它们会以两列图片墙的形式留在这里。</p></div> : <div className="mt-5 columns-2 gap-3">{inspirations.filter((item) => inspirationFilter === "全部" || item.season === inspirationFilter || item.season === "四季").map((item) => <article key={item.id} className="relative mb-3 break-inside-avoid overflow-hidden rounded-[20px] bg-white shadow-[0_8px_20px_rgba(62,48,37,0.08)]"><img src={item.imageUrl} alt={`${item.season}季穿搭灵感`} className="h-auto w-full" /><span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-xs text-[#665f58]">{item.season}</span><button onClick={() => void deleteInspiration(item.id)} aria-label="删除灵感图片" className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-[#9a4433]"><Trash2 size={15} /></button></article>)}</div>}</div></section> : section === "closet" ? <section className="mt-6"><button onClick={() => fileInput.current?.click()} className="group flex w-full items-center gap-4 rounded-[28px] border border-dashed border-[#b9afa3] bg-[#eee8de] p-5 text-left transition hover:bg-[#e8e0d4] sm:p-7"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#b8624e] text-white shadow-sm"><Camera size={25} /></span><span className="flex-1"><strong className="block text-lg">添加一件衣服</strong><span className="mt-1 block text-sm text-[#766f66]">可拍照，也可从相册选择照片</span></span><Plus className="text-[#766f66]" /></button><input ref={fileInput} className="hidden" type="file" accept="image/*" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      <div className="mt-8"><h2 className="font-serif text-2xl">你的单品</h2><p className="mt-1 text-sm text-[#766f66]">已按你填写的类别与季节归档。</p><div className="mt-4"><p className="text-xs font-semibold tracking-[0.12em] text-[#766f66]">类别</p><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{["全部", ...categories].map((item) => <button key={item} onClick={() => setCategoryFilter(item)} className={`shrink-0 rounded-full px-3 py-2 text-sm ${categoryFilter === item ? "bg-[#34312e] text-white" : "bg-white text-[#665f58]"}`}>{item}</button>)}</div><p className="mt-4 text-xs font-semibold tracking-[0.12em] text-[#766f66]">季节</p><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{["全部", ...seasons].map((item) => <button key={item} onClick={() => setSeasonFilter(item)} className={`shrink-0 rounded-full px-3 py-2 text-sm ${seasonFilter === item ? "bg-[#b8624e] text-white" : "bg-white text-[#665f58]"}`}>{item}</button>)}</div></div></div>
      {loading ? <div className="mt-6 grid place-items-center rounded-[28px] bg-white p-16 text-[#766f66]"><LoaderCircle className="animate-spin" /></div> : garments.length === 0 ? <div className="mt-6 rounded-[28px] bg-white px-6 py-14 text-center"><ImagePlus className="mx-auto text-[#b8624e]" size={32} /><p className="mt-4 font-medium">从第一件衣服开始</p><p className="mt-2 text-sm text-[#766f66]">上传照片，再补充材质和适合季节即可。</p></div> : <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{visibleGarments.map((garment) => <article key={garment.id} className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_25px_rgba(62,48,37,0.06)]"><div className="aspect-[4/5] overflow-hidden bg-[#eee9e0]"><img src={garment.imageUrl} alt={garment.name} className="h-full w-full object-contain p-2 drop-shadow-[0_9px_6px_rgba(55,43,33,0.15)]" style={{ transform: `translate(${garment.imageOffsetX || 0}%, ${garment.imageOffsetY || 0}%) scale(${garment.imageScale || 1})` }} /></div><div className="p-3"><div className="flex items-start justify-between gap-2"><p className="truncate font-medium">{garment.name}</p><button aria-label={`编辑 ${garment.name}`} onClick={() => beginEdit(garment)} className="shrink-0 rounded-lg p-1.5 text-[#665f58] hover:bg-[#f2ede6]"><Pencil size={15} /></button><button aria-label={`删除 ${garment.name}`} onClick={() => void deleteGarment(garment.id)} className="shrink-0 rounded-lg p-1.5 text-[#9a4433] hover:bg-[#fff2ee]"><Trash2 size={16} /></button></div><p className="mt-1 text-xs text-[#766f66]">{garment.material || "材质待补充"} · {garment.seasons.join(" / ")}</p><span className="mt-2 inline-block rounded-full bg-[#f2ede6] px-2.5 py-1 text-xs text-[#665f58]">{garment.category}</span></div></article>)}{visibleGarments.length === 0 && <p className="col-span-2 rounded-2xl bg-white p-6 text-sm text-[#766f66]">这个筛选下还没有单品。</p>}</div>}</section> : <section className="mt-6"><div className="rounded-[28px] bg-white p-5 shadow-[0_10px_25px_rgba(62,48,37,0.06)] sm:p-7"><h2 className="font-serif text-2xl">造型拼搭板</h2><p className="mt-1 text-sm text-[#766f66]">先点一个位置，再从下方衣橱挑选单品；再次点选可移除。</p><div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3 rounded-[28px] bg-[#eee8de] p-4"><div className="col-span-2 mx-auto h-24 w-24">{outfitSlot("accessory", "h-full w-full")}</div><div className="h-40">{outfitSlot("outerwear", "h-full w-full")}</div><div className="h-40">{outfitSlot("top", "h-full w-full")}</div><div className="col-span-2 mx-auto h-40 w-32">{outfitSlot("bottom", "h-full w-full")}</div><div className="col-span-2 mx-auto h-20 w-40">{outfitSlot("shoes", "h-full w-full")}</div></div><p className="mt-5 text-sm font-medium text-[#34312e]">正在选择：<span className="text-[#b8624e]">{outfitSlotNames[activeOutfitSlot]}</span></p><div className="mt-3 grid grid-cols-4 gap-2">{garments.map((garment) => <button key={garment.id} onClick={() => selectForSlot(garment.id)} className={`overflow-hidden rounded-xl border-2 bg-[#f7f4ee] ${outfitSlots[activeOutfitSlot] === garment.id ? "border-[#b8624e]" : "border-transparent"}`}><img src={garment.imageUrl} alt={garment.name} className="aspect-square w-full object-contain p-1 drop-shadow-[0_4px_3px_rgba(55,43,33,0.12)]" style={{ transform: `translate(${garment.imageOffsetX || 0}%, ${garment.imageOffsetY || 0}%) scale(${garment.imageScale || 1})` }} /><span className="block truncate px-1 pb-1 text-[10px] text-[#665f58]">{garment.name}</span></button>)}</div><input value={outfitTitle} onChange={(event) => setOutfitTitle(event.target.value)} placeholder="为这套造型起个名字（可选）" className="mt-5 w-full rounded-xl border border-[#d8d0c5] bg-[#f7f4ee] px-4 py-3 text-sm outline-none" /><button onClick={() => void saveOutfit()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#34312e] px-4 py-3 font-medium text-white"><Check size={17} />保存这套造型</button></div>{outfits.length > 0 && <div className="mt-8"><h2 className="font-serif text-2xl">已保存的造型</h2><div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{outfits.map((outfit) => <article key={outfit.id} className="rounded-[22px] bg-white p-3 shadow-[0_10px_25px_rgba(62,48,37,0.06)]"><div className="grid grid-cols-2 gap-1">{Object.values(outfit.slots).filter(Boolean).map((id) => { const garment = garments.find((item) => item.id === id); return garment ? <img key={id} src={garment.imageUrl} alt={garment.name} className="aspect-square rounded-lg bg-[#f7f4ee] object-contain p-1 drop-shadow-[0_4px_3px_rgba(55,43,33,0.12)]" style={{ transform: `translate(${garment.imageOffsetX || 0}%, ${garment.imageOffsetY || 0}%) scale(${garment.imageScale || 1})` }} /> : null; })}</div><div className="mt-3 flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{outfit.title}</p><button onClick={() => void deleteOutfit(outfit.id)} className="rounded-lg p-1 text-[#9a4433] hover:bg-[#fff2ee]" aria-label={`删除 ${outfit.title}`}><Trash2 size={15} /></button></div></article>)}</div></div>}</section>}
  </div>{file && <div className="fixed inset-0 z-20 flex items-end bg-black/30 sm:items-center sm:justify-center"><div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[32px] bg-[#f7f4ee] p-5 shadow-2xl sm:rounded-[32px] sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold tracking-[0.16em] text-[#766f66]">NEW GARMENT</p><h2 className="mt-1 font-serif text-2xl">{editingId ? "编辑这件衣服" : "整理这件衣服"}</h2></div><button onClick={closeSheet} className="grid h-10 w-10 place-items-center rounded-full bg-white"><X size={19} /></button></div><div className="mt-5 grid grid-cols-[112px_1fr] gap-4"><div className="aspect-[4/5] overflow-hidden rounded-2xl bg-[#e9e3d8]"><img src={preview} alt="待上传的衣服" className="h-full w-full object-contain p-1 drop-shadow-[0_8px_6px_rgba(55,43,33,0.16)]" style={{ transform: `translate(${form.imageOffsetX}%, ${form.imageOffsetY}%) scale(${form.imageScale})` }} /></div><div className="rounded-2xl bg-[#eee8de] p-4 text-sm text-[#665f58]"><Sparkles size={18} className="mb-2 text-[#b8624e]" /><p className="font-medium text-[#34312e]">{isRemovingBackground ? "正在本机抠图…" : "商品图已准备好"}</p><p className="mt-1 leading-5">{isRemovingBackground ? "第一次处理会下载模型，请稍等。" : "已统一为透明商品画布，并加上轻微自然投影。"}</p>{editingId && <button onClick={() => fileInput.current?.click()} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#34312e]">替换照片</button>}</div></div><div className="mt-5 rounded-2xl bg-white p-4"><p className="text-sm font-medium">微调商品图</p><p className="mt-1 text-xs text-[#766f66]">调整只影响这件单品，并会随它一起保存。</p><label className="mt-3 block text-xs text-[#665f58]">大小 {Math.round(form.imageScale * 100)}%<input type="range" min="0.8" max="1.8" step="0.01" value={form.imageScale} onChange={(event) => setForm({ ...form, imageScale: Number(event.target.value) })} className="mt-1 w-full accent-[#b8624e]" /></label><div className="mt-2 grid grid-cols-2 gap-3"><label className="block text-xs text-[#665f58]">左右 {form.imageOffsetX}%<input type="range" min="-18" max="18" step="1" value={form.imageOffsetX} onChange={(event) => setForm({ ...form, imageOffsetX: Number(event.target.value) })} className="mt-1 w-full accent-[#b8624e]" /></label><label className="block text-xs text-[#665f58]">上下 {form.imageOffsetY}%<input type="range" min="-18" max="18" step="1" value={form.imageOffsetY} onChange={(event) => setForm({ ...form, imageOffsetY: Number(event.target.value) })} className="mt-1 w-full accent-[#b8624e]" /></label></div></div><div className="mt-6 space-y-4"><label className="block text-sm font-medium">名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white px-4 py-3 outline-none" placeholder="例如：燕麦色针织开衫" /></label><div><p className="text-sm font-medium">类别</p><div className="mt-2 flex flex-wrap gap-2">{categories.map((category) => <button key={category} onClick={() => setForm({ ...form, category })} className={`rounded-full px-3 py-2 text-sm ${form.category === category ? "bg-[#34312e] text-white" : "bg-white text-[#665f58]"}`}>{category}</button>)}</div></div><label className="block text-sm font-medium">材质<input value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white px-4 py-3 outline-none" placeholder="例如：棉、羊毛、牛仔" /></label><div><p className="text-sm font-medium">适合季节</p><div className="mt-2 flex flex-wrap gap-2">{seasons.map((season) => <button key={season} onClick={() => toggleSeason(season)} className={`rounded-full px-3 py-2 text-sm ${form.seasons.includes(season) ? "bg-[#b8624e] text-white" : "bg-white text-[#665f58]"}`}>{season}</button>)}</div></div><label className="block text-sm font-medium">风格标签（可选）<input value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white px-4 py-3 outline-none" placeholder="例如：极简、法式、通勤" /></label><button disabled={uploading || isRemovingBackground} onClick={saveGarment} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#34312e] px-4 py-3.5 font-medium text-white disabled:opacity-60">{uploading || isRemovingBackground ? <LoaderCircle className="animate-spin" size={18} /> : <Check size={18} />}{isRemovingBackground ? "正在优化商品图" : uploading ? "正在保存" : editingId ? "保存修改" : "存入我的衣橱"}</button></div></div></div>}<nav className="fixed inset-x-5 bottom-5 z-10 mx-auto flex max-w-md items-center justify-around rounded-[28px] border border-white/90 bg-[#fffaf5]/95 px-3 py-2 shadow-[0_12px_28px_rgba(89,79,71,0.2)] backdrop-blur"><button onClick={() => setSection("closet")} className={`grid place-items-center gap-1 rounded-2xl px-4 py-2 text-xs ${section === "closet" ? "bg-[#dfe1e7] text-[#596174]" : "text-[#958b83]"}`}><Shirt size={20} />衣橱</button><button onClick={() => setSection("ideas")} className={`grid place-items-center gap-1 rounded-2xl px-4 py-2 text-xs ${section === "ideas" ? "bg-[#ead8d1] text-[#9b665e]" : "text-[#958b83]"}`}><Wand2 size={20} />造型拼搭</button><button onClick={() => setSection("inspirations")} className={`grid place-items-center gap-1 rounded-2xl px-4 py-2 text-xs ${section === "inspirations" ? "bg-[#eee4bd] text-[#967f39]" : "text-[#958b83]"}`}><Heart size={20} />灵感库存</button></nav></main>;
}
