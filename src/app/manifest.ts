import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RobertaFunctional · Allenamento ibrido",
    short_name: "RobertaFunctional",
    description: "Programma di forza e corsa local-first con autoregolazione trasparente.",
    start_url: "/",
    display: "standalone",
    background_color: "#071521",
    theme_color: "#071521",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
