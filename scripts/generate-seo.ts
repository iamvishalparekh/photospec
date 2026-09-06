/**
 * Build-time static page generator.
 *
 * A single-page app is one URL, and one URL can only rank for one thing. Someone
 * searching "Schengen visa photo size" and someone searching "US passport photo
 * 2x2" want different pages, so this emits a real static HTML page per document
 * each with its own title, meta description, canonical URL, structured data
 * and genuine written content.
 *
 * These pages are plain HTML: no React, no JavaScript required to read them.
 * That makes them fast, indexable by anything, and readable if the app itself
 * ever fails to load.
 *
 * Run automatically after `vite build`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { headHeightRatio, type PhotoSpec } from '../src/domain/photo-spec/model/PhotoSpec'
import { calculateSheetLayout } from '../src/domain/print-layout/service/SheetLayoutCalculator'
import { A4 } from '../src/domain/print-layout/model/PaperSize'
import { documentPages, type DocumentContent } from '../src/content/documents'
import { DEFAULT_SITE_URL, GENERAL_FAQ, SITE } from '../src/content/site'
import {
  breadcrumbSchema,
  faqSchema,
  howToSchema,
  webApplicationSchema,
} from '../src/content/structuredData'

const OUT = join(process.cwd(), 'dist')
const BASE = (process.env['PHOTOSPEC_BASE'] ?? '/').replace(/\/$/, '') || ''

/**
 * The absolute site URL, read from the environment here in Node rather than in
 * `src/content/site.ts`, which the browser also loads.
 */
const SITE_URL = (process.env['PHOTOSPEC_SITE_URL'] ?? DEFAULT_SITE_URL).replace(/\/$/, '')

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** JSON-LD is embedded in a script tag, so `<` must not close it early. */
function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

const PAGE_CSS = `
:root{--ground:#f4f4f1;--surface:#fff;--surface-2:#ebebe7;--ink:#191c1e;--ink-2:#4a5054;--ink-3:#787f83;--rule:#d8dad5;--accent:#0e6f79;--accent-ink:#fff;color-scheme:light}
@media(prefers-color-scheme:dark){:root{--ground:#121517;--surface:#1a1e21;--surface-2:#232829;--ink:#e9ebe7;--ink-2:#a9b0b3;--ink-3:#7c8387;--rule:#2c3236;--accent:#4fc2cc;--accent-ink:#0b2225;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px}
nav{font-size:14px;color:var(--ink-3);margin-bottom:28px}
nav a{color:var(--ink-3)}
h1{font-size:clamp(28px,5vw,40px);line-height:1.12;letter-spacing:-.02em;margin:0 0 14px;text-wrap:balance}
h2{font-size:22px;letter-spacing:-.01em;margin:40px 0 12px;text-wrap:balance}
h3{font-size:17px;margin:24px 0 6px}
p,li{color:var(--ink-2)}
.lede{font-size:19px;line-height:1.55;margin:0 0 26px}
.cta{display:inline-block;background:var(--accent);color:var(--accent-ink);text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:600;margin:8px 0 6px}
.note{font-size:14px;color:var(--ink-3);margin:0 0 30px}
table{border-collapse:collapse;width:100%;background:var(--surface);border:1px solid var(--rule);border-radius:6px;overflow:hidden;font-size:15px}
th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--rule)}
th{width:45%;color:var(--ink-3);font-weight:500}
tr:last-child th,tr:last-child td{border-bottom:none}
td{font-variant-numeric:tabular-nums;color:var(--ink)}
ol,ul{padding-left:22px}
li{margin:7px 0}
details{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:14px 16px;margin:8px 0}
summary{cursor:pointer;font-weight:600;color:var(--ink)}
details p{margin:10px 0 0}
footer{margin-top:56px;padding-top:22px;border-top:1px solid var(--rule);font-size:14px;color:var(--ink-3)}
footer a{color:var(--ink-3)}
a{color:var(--accent)}
.other{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
.other a{display:inline-block;background:var(--surface);border:1px solid var(--rule);border-radius:999px;padding:6px 14px;font-size:14px;text-decoration:none}
`

function documentPage(content: DocumentContent, spec: PhotoSpec, others: { content: DocumentContent; spec: PhotoSpec }[]): string {
  const ratio = headHeightRatio(spec)
  const perSheet = calculateSheetLayout(A4, spec.width, spec.height).capacity
  const canonical = `${SITE_URL}/${content.slug}/`
  const appUrl = `${BASE}/`

  const faqAll = [...content.faq, ...GENERAL_FAQ.slice(0, 4)]

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(content.searchTitle)}</title>
<meta name="description" content="${escapeHtml(content.metaDescription)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE.name)}">
<meta property="og:title" content="${escapeHtml(content.searchTitle)}">
<meta property="og:description" content="${escapeHtml(content.metaDescription)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(content.searchTitle)}">
<meta name="twitter:description" content="${escapeHtml(content.metaDescription)}">
<style>${PAGE_CSS}</style>
${jsonLd(howToSchema(spec, content))}
${jsonLd(faqSchema(faqAll))}
${jsonLd(breadcrumbSchema(content, spec, SITE_URL))}
</head>
<body>
<div class="wrap">
<nav><a href="${appUrl}">${escapeHtml(SITE.name)}</a> → ${escapeHtml(spec.name)} photo</nav>

<h1>${escapeHtml(spec.name)} photo: ${spec.width} × ${spec.height} mm</h1>
<p class="lede">${escapeHtml(content.intro)}</p>

<a class="cta" href="${appUrl}">Make my ${escapeHtml(spec.name.toLowerCase())} photo →</a>
<p class="note">Free, no account, no watermark. Your photo is processed on your own device and is never uploaded.</p>

<h2>${escapeHtml(spec.name)} photo requirements</h2>
<table>
<tr><th>Photo size</th><td>${spec.width} × ${spec.height} mm</td></tr>
<tr><th>Head height, chin to crown</th><td>${spec.headHeight.min}–${spec.headHeight.max} mm</td></tr>
<tr><th>Head as share of frame</th><td>${Math.round(ratio.min * 100)}–${Math.round(ratio.max * 100)}%</td></tr>
<tr><th>Background</th><td>${escapeHtml(spec.background.description)}</td></tr>
<tr><th>Minimum print resolution</th><td>${spec.minDpi} dpi</td></tr>
<tr><th>Photos per A4 sheet</th><td>${perSheet}</td></tr>
<tr><th>Expression</th><td>Neutral, mouth closed, eyes open and visible</td></tr>
<tr><th>Age of photo</th><td>Taken within the last 6 months</td></tr>
</table>
<p class="note">Measurements ${spec.source.confidence === 'verified' ? `checked against ${escapeHtml(spec.source.authority)} on ${escapeHtml(spec.source.checkedOn)}` : `not yet verified against ${escapeHtml(spec.source.authority)}, check the official requirements before submitting`}. <a href="${escapeHtml(spec.source.url)}" rel="nofollow noopener">Official source</a>.</p>

<h2>Why the head height matters more than the photo size</h2>
<p>Nearly everyone gets the ${spec.width} × ${spec.height} mm right. Far fewer get the head height right, and that is what most rejections are actually about. For this document the head must measure ${spec.headHeight.min}–${spec.headHeight.max} mm from the bottom of the chin to the top of the head, hair included, ${Math.round(ratio.min * 100)}–${Math.round(ratio.max * 100)}% of the frame.</p>
<p>The rule is not the same everywhere. Schengen documents ask for 70–80% while the general ICAO standard used by the United States asks for 50–69%, so the same photograph needs a different crop for different countries. ${escapeHtml(SITE.name)} stores the rule per document, measures what it produced, and reports the result in millimetres.</p>

<h2>How to make one at home</h2>
<ol>
<li><strong>Take the photo.</strong> Stand about an arm and a half from a plain wall, in even daylight away from direct sun. Face the camera straight on with a neutral expression. Use the main camera rather than the selfie camera if you can.</li>
<li><strong>Open the tool</strong> and choose the photo. It is processed on your device, nothing is uploaded.</li>
<li><strong>Pick ${escapeHtml(spec.name)}.</strong> The background is replaced and the crop is calculated so the head lands inside ${spec.headHeight.min}–${spec.headHeight.max} mm.</li>
<li><strong>Check the measurements.</strong> Every rule is reported in millimetres. Drag the photo if you want to reposition it.</li>
<li><strong>Print at 100% scale</strong> on photo paper of 200 gsm or heavier. Never use "fit to page", it resizes the photo silently.</li>
</ol>

<h2>Why ${escapeHtml(spec.name.toLowerCase())} photos get rejected</h2>
<ul>${content.commonRejections.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>

<h2>Questions</h2>
${faqAll.map((entry) => `<details><summary>${escapeHtml(entry.question)}</summary><p>${escapeHtml(entry.answer)}</p></details>`).join('\n')}

<h2>Other documents</h2>
<ul class="other">${others.map((other) => `<li><a href="${BASE}/${other.content.slug}/">${escapeHtml(other.spec.name)}, ${other.spec.width} × ${other.spec.height} mm</a></li>`).join('')}</ul>

<footer>
<p><strong>${escapeHtml(SITE.name)}</strong> formats your photograph to published measurements. Whether a photo is accepted is always the decision of the issuing authority. Some authorities state that photographs must not be digitally altered, and replacing a background is a digital alteration, check the rules for your application.</p>
<p>${escapeHtml(SITE.name)} is an independent open-source project, not affiliated with any government, embassy, consulate or visa centre. <a href="${SITE.repository}" rel="noopener">Source code on GitHub</a>.</p>
</footer>
</div>
</body>
</html>`
}

function sitemap(slugs: string[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const paths = ['', ...slugs.map((slug) => `${slug}/`)]
  const entries = paths
    .map(
      (path) =>
        `  <url>\n    <loc>${SITE_URL}/${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${path === '' ? '1.0' : '0.8'}</priority>\n  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`
}

/**
 * Add canonical URL and structured data to the app's own index.html.
 *
 * Injected here rather than written into index.html by hand, because both need
 * the absolute site URL, which is only known at build time.
 */
function enrichAppIndex(pages: { content: DocumentContent; spec: PhotoSpec }[]): void {
  const path = join(OUT, 'index.html')
  const html = readFileSync(path, 'utf8')

  const head = [
    `<link rel="canonical" href="${SITE_URL}/">`,
    `<meta property="og:url" content="${SITE_URL}/">`,
    jsonLd(webApplicationSchema(SITE_URL)),
    jsonLd(faqSchema()),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Supported documents',
      itemListElement: pages.map((page, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `${page.spec.name} photo (${page.spec.width} x ${page.spec.height} mm)`,
        url: `${SITE_URL}/${page.content.slug}/`,
      })),
    }),
  ].join('\n')

  writeFileSync(path, html.replace('</head>', `${head}\n</head>`), 'utf8')
}

function main(): void {
  const pages = documentPages()

  for (const { content, spec } of pages) {
    const others = pages.filter((page) => page.content.slug !== content.slug)
    const dir = join(OUT, content.slug)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), documentPage(content, spec, others), 'utf8')
  }

  enrichAppIndex(pages)

  writeFileSync(join(OUT, 'sitemap.xml'), sitemap(pages.map((p) => p.content.slug)), 'utf8')
  writeFileSync(
    join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    'utf8',
  )

  // Also emitted so the app can link to every document page without importing
  // the generator.
  writeFileSync(
    join(OUT, 'documents.json'),
    JSON.stringify(pages.map((p) => ({ slug: p.content.slug, name: p.spec.name })), null, 2),
    'utf8',
  )

  console.log(`SEO: ${pages.length} document pages, sitemap and robots.txt written to dist/`)
  for (const page of pages) console.log(`  /${page.content.slug}/`)
}

main()
