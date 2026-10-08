import type { MetadataRoute } from "next";

// Private app: nothing here should be crawled.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
