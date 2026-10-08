import type { MetadataRoute } from "next";

// Makes LifeDash installable: Add to Home Screen on iPhone, Install app on Android and desktop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeDash",
    short_name: "LifeDash",
    description: "Tasks, calendar and email in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8f7",
    theme_color: "#f6f8f7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
