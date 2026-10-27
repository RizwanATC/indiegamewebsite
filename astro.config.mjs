// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Your public URL. Used for canonical links, Open Graph tags and the sitemap.
// Set SITE_URL in Cloudflare Pages (Settings → Environment variables) once you
// have a custom domain; until then the default *.pages.dev URL is used.
const site = process.env.SITE_URL || 'https://indie24.pages.dev';

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
