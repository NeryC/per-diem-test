import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  regions: ["iad1"],
  functions: {
    "app/api/**/*": { maxDuration: 30 },
  },
};
