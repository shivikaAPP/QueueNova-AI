import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const publicDir = path.resolve(__dirname, '../public');

const baseUrl = process.env.VITE_SITE_URL || 'https://queuenova.app';
const routes = ['/', '/join', '/live', '/terms', '/privacy'];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map((route) => {
    const url = route === '/' ? baseUrl : `${baseUrl}${route}`;
    return `  <url>
    <loc>${url}</loc>
    <changefreq>daily</changefreq>
    <priority>${route === '/' ? '1.0' : '0.8'}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>
`;

if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap.trim() + '\n', 'utf8');
}
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap.trim() + '\n', 'utf8');

console.log('sitemap.xml written successfully.');
