import type { MetadataRoute } from "next";

/**
 * PWA Experience Pack 01 — canonical Web App Manifest.
 * start_url is authenticated Workspace; guests hit existing auth gate.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Humanity Union",
    short_name: "Humanity",
    description:
      "Install Humanity Union for direct access to your Workspace, Initiatives, Notifications and Assistant.",
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7fa",
    theme_color: "#0174b0",
    // No orientation lock — tablet landscape remains useful for Workspace.
    icons: [
      {
        src: "/brand/app-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-512.png",
        sizes: "512x512",
        type: "image/png",
        // Not marked maskable: artwork approaches the canvas edge and would
        // clip under circular/squircle masks. Dedicated maskable derivative TBD.
        purpose: "any",
      },
    ],
  };
}
