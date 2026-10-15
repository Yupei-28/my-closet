import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "我的衣橱",
    short_name: "我的衣橱",
    description: "个人数字衣橱与穿搭灵感库",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#f7f4ee",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
