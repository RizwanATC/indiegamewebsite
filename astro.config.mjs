// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Your public URL. Used for canonical links, Open Graph tags and the sitemap.
// Order: SITE_URL env var (set it when you add a custom domain), then the
// production URL Vercel provides at build time, then a fallback.
const site =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  'https://indiegamewebsite.vercel.app';

export default defineConfig({
  site,
  trailingSlash: 'always',
  output: 'static',
  build: {
    format: 'directory',
    // Keep CSS in files so the Content-Security-Policy in public/_headers can
    // stay strict.
    inlineStylesheets: 'never',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
  image: {
    // Covers and screenshots are pixel art: keep edges crisp when resizing.
    responsiveStyles: false,
  },
  vite: {
    build: {
      // Never inline scripts into HTML, so `script-src 'self'` works.
      assetsInlineLimit: 0,
    },
  },
});
