import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
    // Enables forbidden()/unauthorized() + forbidden.tsx/unauthorized.tsx —
    // needed because Next.js redacts thrown error messages before they reach
    // client-side error boundaries in production, which broke the previous
    // approach of pattern-matching error.message to distinguish RBAC
    // failures from genuine crashes (see rbac.ts / auth.ts).
    authInterrupts: true,
  },
};

export default nextConfig;
