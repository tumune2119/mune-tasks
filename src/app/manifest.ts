import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MUNE TASKS",
    short_name: "MUNE TASKS",
    description: "AI-generated project todo lists, stored locally.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0f1e",
    theme_color: "#0a0f1e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [{ name: "New project", url: "/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}
