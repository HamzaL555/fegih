/**
 * The admin panel calls `/api/v1/...` as a same-origin path. Without a rewrite
 * those requests hit Next.js itself and answer 404, because the API listens on
 * a different port.
 *
 * The proxy target is resolved **server-side**, so the panel works both from
 * `localhost:3000` and from a phone on the LAN (`192.168.x.x:3000`) — a
 * hardcoded absolute URL would point the browser at the phone's own machine.
 */
const API_ORIGIN = process.env.API_PROXY_ORIGIN?.trim() || "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` },
      // Swagger's JSON lives one level up from the versioned prefix.
      { source: "/api-docs.json", destination: `${API_ORIGIN}/api-docs.json` },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" }
    ]
  }
};

export default nextConfig;