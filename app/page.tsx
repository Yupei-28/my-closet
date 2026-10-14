"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Lightbulb, LoaderCircle, Plus, Shirt, Sparkles, Trash2, X } from "lucide-react";

type Garment = { id: string; name: string; category: string; material: string; seasons: string; style: string; imageUrl: string };
type Look = { id: string; title: string; mood: string; note: string };
const categories = ["上装", "下装", "裙装", "外套", "鞋履", "包袋", "配饰"];
const seasons = ["春", "夏", "秋", "冬", "四季"];

export default function Home() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<"closet" | "ideas">("closet");
  const [garments, setGarments] = useState<Garment[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({ name: "", category: "上装", material: "", seasons: "四季", style: "" });
  const [idea, setIdea] = useState({ title: "", mood: "", note: "" });
  const [accessChecked, setAccessChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [seasonFilter, setSeasonFilter] = useState("全部");

  async function loadData() {
    try {
      const [garmentResponse, lookResponse] = await Promise.all([fetch("/api/garments"), fetch("/api/looks")]);
      if (garmentResponse.ok) { const result: any = await garmentResponse.json(); setGarments(result.garments); }
      if (lookResponse.ok) { const result: any = await lookResponse.json(); setLooks(result.looks); }
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
      const cleaned = new File([cutout], `${selected.name.replace(/\.[^/.]+$/, "")}.png`, { type: "image/png" });
      if (preview) URL.revokeObjectURL(preview);
      setFile(cleaned);
      setPreview(URL.createObjectURL(cleaned));
    } catch {
      setError("自动抠图暂时没有完成，已保留原图，你仍可继续保存。");
    } finally { setIsRemovingBackground(false); }
  }
  function closeSheet() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(""); setFile(null); setForm({ name: "", category: "上装", material: "", seasons: "四季", style: "" });
  }
  async function saveGarment() {
    if (!file) return;
    setUploading(true); setError("");
    // Supply a simple, fixed filename.  iOS Safari can reject a generated
    // filename when a processed image is appended to FormData.
    const body = new FormData(); body.append("image", file, "garment.png"); Object.entries(form).forEach(([key, value]) => body.append(key, value));
    try {
      const response = await fetch("/api/garments", { method: "POST", body }); const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setGarments((current) => [result.garment, ...current]); closeSheet();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请再试一次。"); }
    finally { setUploading(false); }
  }
  async function saveIdea() {
    if (!idea.title.trim()) return;
    setError("");
    try {
      const response = await fetch("/api/looks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(idea) }); const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setLooks((current) => [result.look, ...current]); setIdea({ title: "", mood: "", note: "" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败，请再试一次。"); }
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

  if (!accessChecked) return <main className="grid min-h-dvh place-items-center bg-[#f7f4ee] text-[#766f66]"><LoaderCircle className="animate-spin" /></main>;
  if (!authorized) return <main className="grid min-h-dvh place-items-center bg-[#f7f4ee] px-5 text-[#25221f]"><section className="w-full max-w-sm rounded-[32px] bg-white p-7 shadow-[0_18px_50px_rgba(62,48,37,0.08)]"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#34312e] text-white"><Shirt size={22} /></div><p className="mt-6 text-xs font-semibold tracking-[0.18em] text-[#766f66]">MY PRIVATE CLOSET</p><h1 className="mt-2 font-serif text-3xl">进入我的衣橱</h1><p className="mt-3 text-sm leading-6 text-[#766f66]">输入你在 Vercel 设置的专属访问码。照片与灵感仅会保存在你的私有存储中。</p>{error && <p className="mt-4 rounded-xl bg-[#fff2ee] p-3 text-sm text-[#9a4433]">{error}</p>}<input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} type="password" placeholder="输入访问码" className="mt-6 w-full rounded-xl border border-[#d8d0c5] bg-[#f7f4ee] px-4 py-3 outline-none"/><button onClick={() => void unlock()} className="mt-3 w-full rounded-xl bg-[#34312e] px-4 py-3 font-medium text-white">进入衣橱</button></section></main>;

  const visibleGarments = garments.filter((garment) => (categoryFilter === "全部" || garment.category === categoryFilter) && (seasonFilter === "全部" || garment.seasons === seasonFilter || garment.seasons === "四季"));
  return <main className="min-h-dvh bg-[#f7f4ee] pb-28 text-[#25221f]"><div className="mx-auto max-w-5xl px-5 pt-7 sm:px-8">
    <header className="flex items-start justify-between"><div><p className="text-xs font-semibold tracking-[0.2em] text-[#766f66]">MY PRIVATE CLOSET</p><h1 className="mt-2 font-serif text-4xl tracking-tight">我的衣橱</h1><p className="mt-2 text-sm text-[#766f66]">让每件衣服，都被好好看见。</p></div><div className="grid h-12 w-12 place-items-center rounded-full bg-[#34312e] text-white shadow-sm"><Shirt size={21} /></div></header>
    <div className="mt-8 flex gap-2 overflow-x-auto pb-1"><button onClick={() => setSection("closet")} className={`rounded-full px-4 py-2 text-sm font-medium ${section === "closet" ? "bg-[#34312e] text-white" : "bg-white text-[#665f58]"}`}>衣橱 {garments.length}</button><button onClick={() => setSection("ideas")} className={`rounded-full px-4 py-2 text-sm font-medium ${section === "ideas" ? "bg-[#34312e] text-white" : "bg-white text-[#665f58]"}`}>穿搭灵感 {looks.length}</button></div>
    {error && <p className="mt-5 rounded-2xl border border-[#d99c8c] bg-[#fff2ee] px-4 py-3 text-sm text-[#9a4433]">{error}</p>}
    {section === "closet" ? <section className="mt-6"><button onClick={() => fileInput.current?.click()} className="group flex w-full items-center gap-4 rounded-[28px] border border-dashed border-[#b9afa3] bg-[#eee8de] p-5 text-left transition hover:bg-[#e8e0d4] sm:p-7"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#b8624e] text-white shadow-sm"><Camera size={25} /></span><span className="flex-1"><strong className="block text-lg">添加一件衣服</strong><span className="mt-1 block text-sm text-[#766f66]">可拍照，也可从相册选择照片</span></span><Plus className="text-[#766f66]" /></button><input ref={fileInput} className="hidden" type="file" accept="image/*" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      <div className="mt-8"><h2 className="font-serif text-2xl">你的单品</h2><p className="mt-1 text-sm text-[#766f66]">已按你填写的类别与季节归档。</p><div className="mt-4"><p className="text-xs font-semibold tracking-[0.12em] text-[#766f66]">类别</p><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{["全部", ...categories].map((item) => <button key={item} onClick={() => setCategoryFilter(item)} className={`shrink-0 rounded-full px-3 py-2 text-sm ${categoryFilter === item ? "bg-[#34312e] text-white" : "bg-white text-[#665f58]"}`}>{item}</button>)}</div><p className="mt-4 text-xs font-semibold tracking-[0.12em] text-[#766f66]">季节</p><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{["全部", ...seasons].map((item) => <button key={item} onClick={() => setSeasonFilter(item)} className={`shrink-0 rounded-full px-3 py-2 text-sm ${seasonFilter === item ? "bg-[#b8624e] text-white" : "bg-white text-[#665f58]"}`}>{item}</button>)}</div></div></div>
      {loading ? <div className="mt-6 grid place-items-center rounded-[28px] bg-white p-16 text-[#766f66]"><LoaderCircle className="animate-spin" /></div> : garments.length === 0 ? <div className="mt-6 rounded-[28px] bg-white px-6 py-14 text-center"><ImagePlus className="mx-auto text-[#b8624e]" size={32} /><p className="mt-4 font-medium">从第一件衣服开始</p><p className="mt-2 text-sm text-[#766f66]">上传照片，再补充材质和适合季节即可。</p></div> : <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{visibleGarments.map((garment) => <article key={garment.id} className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_25px_rgba(62,48,37,0.06)]"><div className="aspect-[4/5] bg-[#eee9e0]"><img src={garment.imageUrl} alt={garment.name} className="h-full w-full object-contain p-2" /></div><div className="p-3"><div className="flex items-start justify-between gap-2"><p className="truncate font-medium">{garment.name}</p><button aria-label={`删除 ${garment.name}`} onClick={() => void deleteGarment(garment.id)} className="shrink-0 rounded-lg p-1.5 text-[#9a4433] hover:bg-[#fff2ee]"><Trash2 size={16} /></button></div><p className="mt-1 text-xs text-[#766f66]">{garment.material || "材质待补充"} · {garment.seasons}</p><span className="mt-2 inline-block rounded-full bg-[#f2ede6] px-2.5 py-1 text-xs text-[#665f58]">{garment.category}</span></div></article>)}{visibleGarments.length === 0 && <p className="col-span-2 rounded-2xl bg-white p-6 text-sm text-[#766f66]">这个筛选下还没有单品。</p>}</div>}</section> : <section className="mt-6"><div className="rounded-[28px] bg-[#34312e] p-6 text-white"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#b8624e]"><Lightbulb size={20} /></span><div><h2 className="font-serif text-2xl">记录一个造型想法</h2><p className="mt-1 text-sm text-white/65">造型拼搭板将在下一次更新加入。</p></div></div><div className="mt-6 space-y-3"><input value={idea.title} onChange={(event) => setIdea({ ...idea, title: event.target.value })} placeholder="例如：周末咖啡店的轻松感" className="w-full rounded-xl border-0 bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/45" /><input value={idea.mood} onChange={(event) => setIdea({ ...idea, mood: event.target.value })} placeholder="氛围关键词：干净、松弛、复古…" className="w-full rounded-xl border-0 bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/45" /><textarea value={idea.note} onChange={(event) => setIdea({ ...idea, note: event.target.value })} placeholder="想搭配哪些单品？" rows={3} className="w-full resize-none rounded-xl border-0 bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/45" /><button onClick={saveIdea} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f1eadf] px-4 py-3 font-medium text-[#34312e]"><Check size={17} />保存灵感</button></div></div></section>}
  </div>{file && <div className="fixed inset-0 z-20 flex items-end bg-black/30 sm:items-center sm:justify-center"><div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[32px] bg-[#f7f4ee] p-5 shadow-2xl sm:rounded-[32px] sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold tracking-[0.16em] text-[#766f66]">NEW GARMENT</p><h2 className="mt-1 font-serif text-2xl">整理这件衣服</h2></div><button onClick={closeSheet} className="grid h-10 w-10 place-items-center rounded-full bg-white"><X size={19} /></button></div><div className="mt-5 grid grid-cols-[112px_1fr] gap-4"><div className="aspect-[4/5] overflow-hidden rounded-2xl bg-[#e9e3d8]"><img src={preview} alt="待上传的衣服" className="h-full w-full object-contain p-1" /></div><div className="rounded-2xl bg-[#eee8de] p-4 text-sm text-[#665f58]"><Sparkles size={18} className="mb-2 text-[#b8624e]" /><p className="font-medium text-[#34312e]">{isRemovingBackground ? "正在本机抠图…" : "商品图已准备好"}</p><p className="mt-1 leading-5">{isRemovingBackground ? "第一次处理会下载模型，请稍等。" : "透明背景会自动保留，衣服将以居中留白方式展示。"}</p></div></div><div className="mt-6 space-y-4"><label className="block text-sm font-medium">名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white px-4 py-3 outline-none" placeholder="例如：燕麦色针织开衫" /></label><div><p className="text-sm font-medium">类别</p><div className="mt-2 flex flex-wrap gap-2">{categories.map((category) => <button key={category} onClick={() => setForm({ ...form, category })} className={`rounded-full px-3 py-2 text-sm ${form.category === category ? "bg-[#34312e] text-white" : "bg-white text-[#665f58]"}`}>{category}</button>)}</div></div><label className="block text-sm font-medium">材质<input value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white px-4 py-3 outline-none" placeholder="例如：棉、羊毛、牛仔" /></label><div><p className="text-sm font-medium">适合季节</p><div className="mt-2 flex flex-wrap gap-2">{seasons.map((season) => <button key={season} onClick={() => setForm({ ...form, seasons: season })} className={`rounded-full px-3 py-2 text-sm ${form.seasons === season ? "bg-[#b8624e] text-white" : "bg-white text-[#665f58]"}`}>{season}</button>)}</div></div><label className="block text-sm font-medium">风格标签（可选）<input value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })} className="mt-2 w-full rounded-xl border border-[#d8d0c5] bg-white px-4 py-3 outline-none" placeholder="例如：极简、法式、通勤" /></label><button disabled={uploading || isRemovingBackground} onClick={saveGarment} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#34312e] px-4 py-3.5 font-medium text-white disabled:opacity-60">{uploading || isRemovingBackground ? <LoaderCircle className="animate-spin" size={18} /> : <Check size={18} />}{isRemovingBackground ? "正在优化商品图" : uploading ? "正在保存" : "存入我的衣橱"}</button></div></div></div>}</main>;
}
