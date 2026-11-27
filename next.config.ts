import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Scan-to-link handoff: a real iPhone on the same Wi-Fi opens /link from the dev
  // server's LAN address (app/api/handoff). Dev only; ignored in production builds.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
};

export default nextConfig;
