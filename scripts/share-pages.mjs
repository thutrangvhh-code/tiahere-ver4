// Tạo trang chia sẻ mạng xã hội cho tiahere.com (chạy sau "npm run build", trong GitHub Actions)
//
// Với mỗi sản phẩm đang bán và mỗi bài viết đã xuất bản, script tạo 1 trang nhỏ:
//   dist/p/<ten-san-pham>/index.html       → tiahere.com/p/<ten-san-pham>
//   dist/bai-viet/<ten-bai-viet>/index.html → tiahere.com/bai-viet/<ten-bai-viet>
// Trang có sẵn ảnh, tên, mô tả để Facebook/Zalo hiện khung xem trước,
// rồi tự chuyển người xem tới đúng trang trên web.
// Kèm dist/404.html: link mới chưa có trang riêng vẫn mở đúng sản phẩm/bài viết.
//
// Dữ liệu đọc công khai từ Firestore (sản phẩm, bài viết đã xuất bản), không cần key.
// Nếu đọc lỗi, script chỉ báo lỗi và bỏ qua: web vẫn được đưa lên bình thường.

import { mkdir, writeFile } from "node:fs/promises";

const PROJECT = "tiahere-ver4";
const SITE = "https://tiahere.com";
const OUT = "dist";
const DEFAULT_IMAGE = `${SITE}/og-default.png`;
const API = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// ── Phải giống hệt shareSlugify / buildShareSlugs trong App.tsx ──
function shareSlugify(text) {
  const base = text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return base || "trang";
}
function buildShareSlugs(items) {
  const count = {};
  items.forEach((item) => { const b = shareSlugify(item.title); count[b] = (count[b] || 0) + 1; });
  const out = {};
  items.forEach((item) => { const b = shareSlugify(item.title); out[item.id] = count[b] > 1 ? `${b}-${item.id.slice(0, 5).toLowerCase()}` : b; });
  return out;
}

// Chuyển dữ liệu dạng Firestore REST về object thường
function plain(value) {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(plain);
  if ("mapValue" in value) return fields(value.mapValue.fields || {});
  return undefined;
}
function fields(f) {
  const o = {};
  for (const [k, v] of Object.entries(f || {})) o[k] = plain(v);
  return o;
}
const docId = (name) => name.split("/").pop();

async function listProducts() {
  const all = [];
  let pageToken = "";
  do {
    const res = await fetch(`${API}/products?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`);
    if (!res.ok) throw new Error(`products ${res.status} ${await res.text()}`);
    const data = await res.json();
    (data.documents || []).forEach((d) => all.push({ id: docId(d.name), ...fields(d.fields) }));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return all;
}

async function listArticles() {
  const res = await fetch(`${API}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "articles" }],
      where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "Đã xuất bản" } } },
    } }),
  });
  if (!res.ok) throw new Error(`articles ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => ({ id: docId(r.document.name), ...fields(r.document.fields) }));
}

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (s, n = 200) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

// Ảnh khung xem trước: 1200 × 630. Ảnh Cloudinary được cắt sẵn đúng khung.
function shareImage(url) {
  if (!url) return DEFAULT_IMAGE;
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/");
  }
  return url;
}

function page({ title, description, image, url, target, type }) {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} - Tiahere</title>
<meta name="description" content="${esc(description)}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="${type}" />
<meta property="og:site_name" content="Tiahere" />
<meta property="og:locale" content="vi_VN" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<script>location.replace(${JSON.stringify(target)});</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f7ede6;color:#4b342c}a{color:#c38380}</style>
</head>
<body><p>Đang mở <a href="${esc(target)}">${esc(title)}</a>…</p></body>
</html>
`;
}

// 404: link chia sẻ mới (chưa có trang riêng) → về trang chủ kèm tên sản phẩm/bài viết để web tự tìm
const PAGE_404 = `<!doctype html>
<html lang="vi"><head><meta charset="UTF-8" /><title>Tiahere</title>
<script>
(function () {
  var m = location.pathname.match(/^\\/(p|bai-viet)\\/([^\\/]+)\\/?$/);
  location.replace(m ? "/#" + (m[1] === "p" ? "p" : "bv") + "=" + m[2] : "/");
})();
</script></head><body></body></html>
`;

async function write(path, html) {
  await mkdir(`${OUT}/${path}`, { recursive: true });
  await writeFile(`${OUT}/${path}/index.html`, html);
}

// Danh sách link gửi Google (sitemap.xml)
const sitemapUrls = [{ loc: `${SITE}/` }];

function sitemapXml() {
  const rows = sitemapUrls.map((u) =>
    `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

const ROBOTS = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

async function main() {
  await writeFile(`${OUT}/404.html`, PAGE_404);
  await writeFile(`${OUT}/robots.txt`, ROBOTS);

  const todayVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const todayUTC = new Date().toISOString().slice(0, 10);

  try {
    // Cùng điều kiện với web: chỉ sản phẩm "Đang bán", combo chưa hết hạn
    const products = (await listProducts())
      .filter((p) => p.status === "Đang bán" && !(p.saleEnd && String(p.saleEnd) < todayVN))
      .map((p) => ({ ...p, title: p.title || p.name || "" }));
    const slugs = buildShareSlugs(products);
    for (const p of products) {
      const description = short(p.description || (Array.isArray(p.outcomes) ? p.outcomes.join(" · ") : "") || "Tài liệu, công cụ và khoá học của Tia Nguyễn trên Tiahere.");
      await write(`p/${slugs[p.id]}`, page({
        title: p.title, description, image: shareImage(p.image || p.imageCard),
        url: `${SITE}/p/${slugs[p.id]}`, target: `/#san-pham=${p.id}`, type: "website",
      }));
      sitemapUrls.push({ loc: `${SITE}/p/${slugs[p.id]}` });
    }
    console.log(`Đã tạo ${products.length} trang chia sẻ sản phẩm`);
  } catch (e) {
    console.log("Bỏ qua trang chia sẻ sản phẩm:", e.message);
  }

  try {
    const articles = (await listArticles()).filter((a) => !a.publishedAt || a.publishedAt <= todayUTC);
    const slugs = buildShareSlugs(articles.map((a) => ({ ...a, title: a.title || "" })));
    for (const a of articles) {
      await write(`bai-viet/${slugs[a.id]}`, page({
        title: a.title || "Bài viết", description: short(a.metaDescription || a.excerpt || ""), image: shareImage(a.image),
        url: `${SITE}/bai-viet/${slugs[a.id]}`, target: `/#article=${a.id}`, type: "article",
      }));
      const day = String(a.publishedAt || "").slice(0, 10);
      sitemapUrls.push({ loc: `${SITE}/bai-viet/${slugs[a.id]}`, lastmod: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "" });
    }
    console.log(`Đã tạo ${articles.length} trang chia sẻ bài viết`);
  } catch (e) {
    console.log("Bỏ qua trang chia sẻ bài viết:", e.message);
  }

  // Luôn tạo sitemap (ít nhất có trang chủ), kể cả khi đọc dữ liệu lỗi
  await writeFile(`${OUT}/sitemap.xml`, sitemapXml());
  console.log(`Đã tạo sitemap.xml với ${sitemapUrls.length} link`);
}

main();
