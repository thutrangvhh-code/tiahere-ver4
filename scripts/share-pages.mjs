// Tạo trang riêng cho từng sản phẩm / bài viết của tiahere.com (chạy sau "npm run build", trong GitHub Actions)
//
// Với mỗi sản phẩm đang bán và mỗi bài viết đã xuất bản, script tạo 1 trang thật:
//   dist/p/<ten-san-pham>/index.html       → tiahere.com/p/<ten-san-pham>/
//   dist/bai-viet/<ten-bai-viet>/index.html → tiahere.com/bai-viet/<ten-bai-viet>/
// Mỗi trang là bản sao của web (dist/index.html) nhưng có sẵn:
//   - tiêu đề, mô tả, ảnh riêng → Google, Facebook, Zalo hiện đúng
//   - nội dung chữ dựng sẵn → Google và các công cụ AI đọc được ngay, không cần chạy web
//   - dữ liệu có cấu trúc (schema.org) → Google hiểu đây là sản phẩm / bài viết / sự kiện
// Người xem mở link vẫn thấy web bình thường, ở đúng sản phẩm / bài viết.
// Trang chủ (dist/index.html) cũng được thêm nội dung chữ: danh sách sản phẩm và bài viết.
// Kèm theo: sitemap.xml, robots.txt, 404.html.
//
// Dữ liệu đọc công khai từ Firestore (sản phẩm, bài viết đã xuất bản), không cần key.
// Nếu đọc lỗi, script chỉ báo lỗi và bỏ qua: web vẫn được đưa lên bình thường.

import { mkdir, readFile, writeFile } from "node:fs/promises";

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
  if ("timestampValue" in value) return value.timestampValue;
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

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stripMd = (s) => String(s || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/[#*>_`]/g, "").replace(/\[!NOTE\]/g, "");
const short = (s, n = 160) => { const t = stripMd(s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const list = (v) => (Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean) : []);

// Ảnh khung xem trước: 1200 × 630. Ảnh Cloudinary được cắt sẵn đúng khung.
function shareImage(url) {
  if (!url) return DEFAULT_IMAGE;
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/");
  }
  return url;
}

const KIND_LABEL = { document: "Tài liệu", tool: "Công cụ", course: "Khoá học", event: "Sự kiện", combo: "Combo", mentoring: "Đồng hành 1:1" };
const priceNumber = (price) => { const n = Number(String(price || "").replace(/[^\d]/g, "")); return Number.isFinite(n) ? n : 0; };

// Chữ đậm **...** → <strong>, link [chữ](url) → <a>
function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}
// Nội dung bài viết (cùng cách viết như trong Admin) → HTML đơn giản
function articleHtml(content) {
  return String(content || "").split(/\n{2,}/).map((block) => {
    const t = block.trim();
    if (!t || t === "---") return "";
    if (t.startsWith("## ")) return `<h2>${inline(t.slice(3))}</h2>`;
    if (t.startsWith("# ")) return `<h2>${inline(t.slice(2))}</h2>`;
    if (t.startsWith("> [!NOTE]")) return `<p>${inline(t.replace("> [!NOTE]", "").trim())}</p>`;
    if (t.startsWith("> ")) return `<blockquote>${inline(t.slice(2))}</blockquote>`;
    const img = t.match(/^!\[(.*?)\]\((\S+?)\)$/);
    if (img) return `<img src="${esc(img[2])}" alt="${esc(img[1])}" loading="lazy" />`;
    const lines = t.split("\n");
    if (lines.every((l) => l.startsWith("- "))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
    return `<p>${inline(t).replace(/\n/g, "<br />")}</p>`;
  }).join("\n");
}

// ── Lấy dist/index.html làm khuôn, thay phần đầu trang (title, mô tả, ảnh...) và nội dung chữ ──
let TEMPLATE = "";
function setTag(html, regex, replacement) {
  return regex.test(html) ? html.replace(regex, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}
function render({ title, description, image, url, type, jsonld, body }) {
  let html = TEMPLATE;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}" />`);
  html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
  html = setTag(html, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${type}" />`);
  html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}" />`);
  html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(description)}" />`);
  html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}" />`);
  html = setTag(html, /<meta property="og:image" [^>]*>/, `<meta property="og:image" content="${esc(image)}" />`);
  html = setTag(html, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}" />`);
  html = setTag(html, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  html = setTag(html, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(description)}" />`);
  if (jsonld) {
    const json = JSON.stringify(jsonld).replace(/</g, "\\u003c");
    html = html.replace("</head>", `    <script type="application/ld+json">${json}</script>\n  </head>`);
  }
  return withBody(html, body);
}
function withBody(html, body) {
  const block = `<div class="seo-static">\n${body}\n</div>`;
  if (html.includes("<!--seo-static-->")) return html.replace("<!--seo-static-->", block);
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${block}</div>`);
}

const NAV_LINKS = `<nav><a href="/">Trang chủ</a> · <a href="/#tai-lieu">Tài liệu</a> · <a href="/#cong-cu">Công cụ</a> · <a href="/#khoa-hoc">Khoá học</a> · <a href="/#su-kien">Sự kiện</a> · <a href="/#bai-viet">Bài viết</a> · <a href="/#dong-hanh">Đồng hành 1:1</a></nav>`;

function productBody(p, others) {
  const outcomes = list(p.outcomes), audience = list(p.audience);
  const parts = [NAV_LINKS, `<article>`, `<p>${esc(KIND_LABEL[p.kind] || "Sản phẩm")} · Tiahere</p>`, `<h1>${esc(p.title)}</h1>`];
  if (p.description) parts.push(`<p>${inline(p.description)}</p>`);
  if (p.price) parts.push(`<p>Giá: ${esc(priceNumber(p.price) ? p.price : "Miễn phí")}</p>`);
  if (p.kind === "event" && p.eventDate) parts.push(`<p>Thời gian: ${esc(p.eventDate)}${p.eventTime ? ` ${esc(p.eventTime)}` : ""} · ${p.eventFormat === "offline" ? esc(p.location || "Trực tiếp") : "Online"}</p>`);
  if (outcomes.length) parts.push(`<h2>Bạn nhận được gì</h2><ul>${outcomes.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
  if (audience.length) parts.push(`<h2>Dành cho ai</h2><ul>${audience.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
  if (p.contentText) parts.push(`<h2>${p.kind === "event" ? "Nội dung sự kiện" : "Nội dung"}</h2><p>${inline(p.contentText).replace(/\n/g, "<br />")}</p>`);
  parts.push(`<p>Tác giả: Tia Nguyễn</p>`, `</article>`);
  if (others.length) parts.push(`<h2>Sản phẩm khác</h2><ul>${others.map((o) => `<li><a href="/p/${o.slug}/">${esc(o.title)}</a></li>`).join("")}</ul>`);
  return parts.join("\n");
}

function productSchema(p, url, image) {
  const price = priceNumber(p.price);
  const offers = { "@type": "Offer", price: String(price), priceCurrency: "VND", availability: "https://schema.org/InStock", url };
  const desc = short(p.description, 300);
  if (p.kind === "event" && p.eventDate) {
    const start = `${p.eventDate}${p.eventTime && /^\d{1,2}:\d{2}$/.test(p.eventTime) ? `T${p.eventTime.padStart(5, "0")}:00+07:00` : ""}`;
    const offline = p.eventFormat === "offline";
    return {
      "@context": "https://schema.org", "@type": "Event", name: p.title, description: desc, image: [image], startDate: start,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: offline ? "https://schema.org/OfflineEventAttendanceMode" : "https://schema.org/OnlineEventAttendanceMode",
      location: offline ? { "@type": "Place", name: p.location || "Việt Nam", address: p.location || "Việt Nam" } : { "@type": "VirtualLocation", url },
      organizer: { "@type": "Organization", name: "Tiahere", url: `${SITE}/` },
      offers,
    };
  }
  if (p.kind === "course") {
    return {
      "@context": "https://schema.org", "@type": "Course", name: p.title, description: desc, url, image,
      inLanguage: "vi", provider: { "@type": "Organization", name: "Tiahere", sameAs: `${SITE}/` }, offers: [offers],
    };
  }
  return {
    "@context": "https://schema.org", "@type": "Product", name: p.title, description: desc, image: [image], url,
    category: KIND_LABEL[p.kind] || "Sản phẩm số", brand: { "@type": "Brand", name: "Tiahere" }, offers,
  };
}

function articleBody(a) {
  return [NAV_LINKS, `<article>`, `<p>Bài viết · Tiahere</p>`, `<h1>${esc(a.title)}</h1>`,
    a.publishedAt ? `<p>Ngày đăng: ${esc(String(a.publishedAt).slice(0, 10))} · Tác giả: Tia Nguyễn</p>` : `<p>Tác giả: Tia Nguyễn</p>`,
    a.excerpt ? `<p><strong>${inline(a.excerpt)}</strong></p>` : "", articleHtml(a.content), `</article>`].filter(Boolean).join("\n");
}

function articleSchema(a, url, image) {
  const day = String(a.publishedAt || "").slice(0, 10);
  return {
    "@context": "https://schema.org", "@type": "Article", headline: String(a.title || "").slice(0, 110), description: short(a.metaDescription || a.excerpt || a.content, 300),
    image: [image], url, mainEntityOfPage: url, inLanguage: "vi",
    ...(day ? { datePublished: day } : {}),
    author: { "@type": "Person", name: "Tia Nguyễn", url: `${SITE}/` },
    publisher: { "@type": "Organization", name: "Tiahere", logo: { "@type": "ImageObject", url: `${SITE}/apple-touch-icon.png` } },
  };
}

// 404: link mới chưa có trang riêng → về trang chủ kèm tên sản phẩm/bài viết để web tự tìm
const PAGE_404 = `<!doctype html>
<html lang="vi"><head><meta charset="UTF-8" /><meta name="robots" content="noindex" /><title>Tiahere</title>
<script>
(function () {
  var m = location.pathname.match(/^\\/(p|bai-viet)\\/([^\\/]+)\\/?$/);
  location.replace(m ? "/#" + (m[1] === "p" ? "p" : "bv") + "=" + m[2] : "/");
})();
</script></head><body></body></html>
`;

const ROBOTS = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

// Danh sách link gửi Google (sitemap.xml)
const sitemapUrls = [{ loc: `${SITE}/` }];
function sitemapXml() {
  const rows = sitemapUrls.map((u) =>
    `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

async function write(path, html) {
  await mkdir(`${OUT}/${path}`, { recursive: true });
  await writeFile(`${OUT}/${path}/index.html`, html);
}

async function main() {
  TEMPLATE = await readFile(`${OUT}/index.html`, "utf8");
  await writeFile(`${OUT}/404.html`, PAGE_404);
  await writeFile(`${OUT}/robots.txt`, ROBOTS);

  const todayVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const homeProducts = [], homeArticles = [];

  try {
    // Cùng điều kiện với web: chỉ sản phẩm "Đang bán", combo chưa hết hạn
    const products = (await listProducts())
      .filter((p) => p.status === "Đang bán" && !(p.saleEnd && String(p.saleEnd) < todayVN))
      .map((p) => ({ ...p, title: p.title || p.name || "", kind: p.kind || "document" }));
    const slugs = buildShareSlugs(products);
    const linked = products.map((p) => ({ title: p.title, slug: slugs[p.id], kind: p.kind, description: p.description }));
    for (const p of products) {
      const slug = slugs[p.id];
      const url = `${SITE}/p/${slug}/`;
      const image = shareImage(p.image || p.imageCard);
      const description = short(p.description || list(p.outcomes).join(" · ") || "Tài liệu, công cụ và khoá học của Tia Nguyễn trên Tiahere.");
      const others = linked.filter((o) => o.slug !== slug).slice(0, 8);
      await write(`p/${slug}`, render({
        title: `${p.title} - Tiahere`, description, image, url, type: "website",
        jsonld: productSchema(p, url, image), body: productBody(p, others),
      }));
      sitemapUrls.push({ loc: url });
    }
    homeProducts.push(...linked);
    console.log(`Đã tạo ${products.length} trang sản phẩm`);
  } catch (e) {
    console.log("Bỏ qua trang sản phẩm:", e.message);
  }

  try {
    const articles = (await listArticles()).filter((a) => !a.publishedAt || String(a.publishedAt).slice(0, 10) <= todayVN);
    const slugs = buildShareSlugs(articles.map((a) => ({ ...a, title: a.title || "" })));
    for (const a of articles) {
      const slug = slugs[a.id];
      const url = `${SITE}/bai-viet/${slug}/`;
      const image = shareImage(a.image);
      await write(`bai-viet/${slug}`, render({
        title: `${a.title || "Bài viết"} - Tiahere`, description: short(a.metaDescription || a.excerpt || a.content), image, url, type: "article",
        jsonld: articleSchema(a, url, image), body: articleBody(a),
      }));
      const day = String(a.publishedAt || "").slice(0, 10);
      sitemapUrls.push({ loc: url, lastmod: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "" });
      homeArticles.push({ title: a.title, slug, excerpt: a.excerpt });
    }
    console.log(`Đã tạo ${articles.length} trang bài viết`);
  } catch (e) {
    console.log("Bỏ qua trang bài viết:", e.message);
  }

  // Trang chủ: thêm nội dung chữ (giới thiệu + danh sách sản phẩm, bài viết) cho Google / AI đọc
  const home = [NAV_LINKS, `<h1>Tiahere - Hiểu mình, định hướng sự nghiệp cùng Tia Nguyễn</h1>`,
    `<p>Tài liệu, công cụ, khoá học và đồng hành 1:1 giúp bạn hiểu mình và định hướng sự nghiệp, cùng Tia Nguyễn.</p>`];
  if (homeProducts.length) home.push(`<h2>Sản phẩm</h2><ul>${homeProducts.map((p) => `<li><a href="/p/${p.slug}/">${esc(p.title)}</a>${p.description ? ` - ${esc(short(p.description, 140))}` : ""}</li>`).join("")}</ul>`);
  if (homeArticles.length) home.push(`<h2>Bài viết</h2><ul>${homeArticles.map((a) => `<li><a href="/bai-viet/${a.slug}/">${esc(a.title)}</a>${a.excerpt ? ` - ${esc(short(a.excerpt, 140))}` : ""}</li>`).join("")}</ul>`);
  await writeFile(`${OUT}/index.html`, withBody(TEMPLATE, home.join("\n")));

  // Luôn tạo sitemap (ít nhất có trang chủ), kể cả khi đọc dữ liệu lỗi
  await writeFile(`${OUT}/sitemap.xml`, sitemapXml());
  console.log(`Đã tạo sitemap.xml với ${sitemapUrls.length} link`);
}

main().catch((e) => console.log("Lỗi tạo trang:", e.message));
