import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, addDoc, updateDoc, increment, arrayUnion, arrayRemove, collection, getDocs, query as fsQuery, where, orderBy, limit, writeBatch, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

// ── Email System ──────────────────────────────────────────────
// Sau khi deploy Apps Script, dán Web App URL vào đây:
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHk_e9y3DD6usREe2LmmRvwUK4iSjlaLG8MydWQmQT7Q_y_9JuVT75SprasejnQ0iFng/exec";

type EmailPayload =
  | { type: "welcome"; email: string; name: string }
  | { type: "order_pending"; email: string; name: string; productName: string }
  | { type: "free_confirmed"; email: string; name: string; productName: string; date?: string }
  | { type: "booking_pending"; email: string; name: string; date: string; time: string }
  | { type: "order_confirmed"; email: string; name: string; productName: string }
  | { type: "booking_confirmed"; email: string; name: string; date: string; time: string };

// Gửi kèm idToken của người đang đăng nhập để Apps Script xác minh người gửi
function sendEmail(payload: EmailPayload): void {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "PASTE_YOUR_WEB_APP_URL_HERE") return;
  const current = auth.currentUser;
  (current ? current.getIdToken() : Promise.resolve(""))
    .catch(() => "")
    .then((idToken) => fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ ...payload, idToken }),
    }))
    .catch(() => { /* silent fail — không block UI */ });
}
// ─────────────────────────────────────────────────────────────

// ── Đơn hàng & lịch đồng hành ─────────────────────────────────
type OrderRecord = {
  code: string;
  productId: string;
  productTitle: string;
  priceLabel: string;
  amount: number;
  status: string; // "Chờ xác nhận" | "Đã xác nhận" | "Đã huỷ"
  createdAt: string;
};

type BookingRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  issue: string;
  topic: string;
  status: string; // "Chờ xác nhận" | "Đã xác nhận" | "Đã huỷ"
  meetUrl?: string;
  userNote?: string;
  createdAt: string;
};

// Mã đơn ngắn, không dấu, bỏ các ký tự dễ nhầm (0/O, 1/I)
const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateOrderCode(): string {
  const values = new Uint32Array(5);
  crypto.getRandomValues(values);
  return "TIA" + Array.from(values, (value) => ORDER_CODE_ALPHABET[value % ORDER_CODE_ALPHABET.length]).join("");
}

function formatDateVN(isoDate: string, withWeekday = false): string {
  if (!isoDate) return "";
  const date = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00` : isoDate);
  return date.toLocaleDateString("vi-VN", withWeekday ? { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" });
}

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function statusTone(status: string): string {
  return status === "Đã xác nhận" ? "#2e7d32" : status === "Đã huỷ" ? "#9e9e9e" : "#b26a00";
}
// ──────────────────────────────────────────────────────────────

const AdminApp = lazy(() => import("./AdminApp"));
// Công cụ (worksheet) chỉ tải khi người dùng mở, không làm nặng trang chủ
const HieuMinhTool = lazy(() => import("./HieuMinhTool"));
const TktksnTool = lazy(() => import("./TktksnTool"));

type IconName =
  | "home"
  | "book"
  | "grid"
  | "heart"
  | "user"
  | "search"
  | "bell"
  | "sun"
  | "arrow"
  | "play"
  | "clock"
  | "sparkle"
  | "menu"
  | "close"
  | "document"
  | "sliders"
  | "graduation"
  | "users"
  | "briefcase"
  | "brain"
  | "chart"
  | "clipboard"
  | "message"
  | "article"
  | "check";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    play: <path d="m9 7 8 5-8 5Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    sparkle: <><path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8Z" /><path d="m5 15 .7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7Z" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    document: <><path d="M6 2h8l4 4v16H6Z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
    graduation: <><path d="m2 9 10-5 10 5-10 5Z" /><path d="M6 11.5V16c3 3 9 3 12 0v-4.5M22 9v6" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 15.5A5 5 0 0 1 21 20" /></>,
    briefcase: <><rect x="4" y="7" width="16" height="14" rx="2" /><path d="M9 7V4h6v3M8 12v4M12 10v6M16 13v3" /></>,
    brain: <><path d="M9.5 4.5A3 3 0 0 0 5 7a3 3 0 0 0-1 5.8A3.5 3.5 0 0 0 9.5 18" /><path d="M14.5 4.5A3 3 0 0 1 19 7a3 3 0 0 1 1 5.8 3.5 3.5 0 0 1-5.5 5.2M9.5 4.5V20M14.5 4.5V20M7 10h2.5M14.5 9H17M6.5 15H9M14.5 14H18" /></>,
    chart: <><path d="M4 19h16M6 16h4v-4H6ZM14 16h4V6h-4Z" /><path d="M16 3v3" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a3 3 0 0 1 6 0v2H9ZM9 11h.01M12 11h3M9 15h.01M12 15h3" /></>,
    message: <><path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a9 9 0 1 1 18-5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    article: <><path d="M5 3h14v18H5Z" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
const navItems: { label: string; icon: IconName }[] = [
  { label: "Trang chủ", icon: "home" },
  { label: "Tài liệu", icon: "document" },
  { label: "Công cụ", icon: "sliders" },
  { label: "Khoá học", icon: "graduation" },
  { label: "Sự kiện", icon: "sparkle" },
  { label: "Bài viết", icon: "article" },
  { label: "Đồng hành 1:1", icon: "users" },
];

const discoveryTabs = ["Khám phá", "Mới nhất", "Phổ biến", "Ưu đãi"];

type ProductKind = "document" | "tool" | "course" | "mentoring" | "event" | "combo";

type Product = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: string;
  image: string;
  tabs: string[];
  kind: ProductKind;
  badge?: string;
  verified?: boolean;
  externalUrl?: string;
  ebookUrl?: string;
  imageCard?: string;
  toolKey?: string; // công cụ gắn với sản phẩm, ví dụ "hieu-minh"
  buyers?: number; // số người mua thật (tự tăng khi admin xác nhận đơn)
  bonusBuyers?: number; // số admin tự điền thêm (X)
  showBuyers?: boolean; // false = ẩn số người mua
  interested?: number; // số người quan tâm thật (bấm trái tim)
  bonusInterest?: number; // số admin tự điền thêm (X)
  showInterest?: boolean; // false = ẩn số người quan tâm
  originalPrice?: string; // giá gốc, ví dụ "199.000đ"
  courseMode?: string; // khoá học: "external" (Udemy/link ngoài) | "paid" (tự tổ chức, trả phí) | "refund" (tự tổ chức, trả phí rồi hoàn lại)
  contentText?: string; // nội dung sự kiện / khoá học
  eventDate?: string; // YYYY-MM-DD
  eventTime?: string; // "19:30"
  eventEndTime?: string;
  eventFormat?: string; // "online" | "offline"
  location?: string; // nền tảng (Google Meet...) hoặc địa chỉ
  startDate?: string; // khoá học: ngày khai giảng
  schedule?: string; // khoá học: lịch học (chữ tự do)
  note?: string; // lưu ý cho người tham gia (công khai)
  comboItems?: string[]; // combo: mã các sản phẩm bên trong
  saleEnd?: string; // combo: hạn bán YYYY-MM-DD
  outcomes?: string[];
  audience?: string[];
};

// Ảnh Cloudinary: tự chọn định dạng nhẹ nhất (f_auto), tự nén (q_auto) và giới hạn chiều rộng
function optimizeImage(url: string, width = 1200): string {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}

function DiscoveryTabs({ active, onChange }: { active: string; onChange: (tab: string) => void }) {
  return (
    <div className="filter-row">
      {discoveryTabs.map((item) => (
        <button key={item} className={active === item ? "selected" : ""} onClick={() => onChange(item)}>{item}</button>
      ))}
    </div>
  );
}

// Products được load từ Firestore trong App component (state allProducts)
// Các biến dưới là computed helper dùng trong JSX — sẽ được khai báo bên trong component

// ── Giá: miễn phí / giá gốc ──
const priceNumber = (price?: string) => Number((price || "").replace(/\D/g, "")) || 0;
const isFreeProduct = (product: Product) => priceNumber(product.price) === 0;
const priceText = (product: Product) => (isFreeProduct(product) ? "Miễn phí" : product.price);
function discountPercent(product: Product) {
  const now = priceNumber(product.price), was = priceNumber(product.originalPrice);
  return was > now ? Math.round(((was - now) / was) * 100) : 0;
}
// Hiển thị giá bán + giá gốc gạch ngang + nhãn -%
function PriceTag({ product }: { product: Product }) {
  const pct = discountPercent(product);
  return (
    <span className="price-tag">
      <strong>{priceText(product)}</strong>
      {pct > 0 && <><s>{product.originalPrice}</s><em>-{pct}%</em></>}
    </span>
  );
}

// ── Sự kiện & khoá học tự tổ chức ──
// Khoá học hoàn lại học phí: chuyển khoản vào tài khoản riêng
const REFUND_BANK = { bin: "970407", bank: "Techcombank", holder: "Nguyễn Thị Thu Trang", qrName: "NGUYEN THI THU TRANG", number: "19030287685014", display: "1903 0287 6850 14" };
const isSelfCourse = (p: Product) => p.kind === "course" && (p.courseMode === "paid" || p.courseMode === "refund");
const needsRegistration = (p: Product) => p.kind === "event" || isSelfCourse(p);
const isPastEvent = (p: Product) => p.kind === "event" && !!p.eventDate && p.eventDate < todayISO();
const formatLabel = (p: Product) => (p.eventFormat === "offline" ? "Offline" : "Online");
function eventWhen(p: Product) {
  const time = p.eventTime ? `${p.eventTime}${p.eventEndTime ? ` - ${p.eventEndTime}` : ""}` : "";
  const date = p.eventDate ? formatDateVN(p.eventDate, true) : "";
  return [time, date].filter(Boolean).join(" · ");
}
function shortDate(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
// Nút "Xem ..." và nhãn ngày trên các ô ở trang chủ
const viewLabel = (p: Product) => ({ event: "Xem sự kiện", course: "Xem khoá học", document: "Xem tài liệu", tool: "Xem công cụ", combo: "Xem combo", mentoring: "Xem chi tiết" } as Record<string, string>)[p.kind] || "Xem chi tiết";
const eventTag = (p: Product) => (p.kind === "combo" ? ` · COMBO${discountPercent(p) ? ` TIẾT KIỆM ${discountPercent(p)}%` : ""}` : p.kind === "event" ? ` · SỰ KIỆN${p.eventDate ? ` ${shortDate(p.eventDate)}` : ""}${p.eventTime ? ` · ${p.eventTime}` : ""} · ${formatLabel(p).toUpperCase()}` : "");
// Khối thông tin thời gian / hình thức trên trang chi tiết và trang tham gia
function EventInfo({ product }: { product: Product }) {
  const rows: [string, string][] = product.kind === "event"
    ? [["Thời gian", eventWhen(product) || "Sẽ cập nhật"], ["Hình thức", `${formatLabel(product)}${product.location ? ` · ${product.location}` : ""}`]]
    : [["Khai giảng", product.startDate ? formatDateVN(product.startDate, true) : "Sẽ cập nhật"], ["Lịch học", product.schedule || "Sẽ cập nhật"], ["Hình thức", `${formatLabel(product)}${product.location ? ` · ${product.location}` : ""}`]];
  return (
    <div className="event-info">
      {rows.map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}
      {product.courseMode === "refund" && <p className="refund-note">✓ Được hoàn 100% học phí khi hoàn thành yêu cầu</p>}
    </div>
  );
}

// ── Quan tâm (trái tim) ──
type FavApi = { favs: string[]; delta: Record<string, number>; toggle: (product: Product) => void };
const FavContext = createContext<FavApi>({ favs: [], delta: {}, toggle: () => {} });
function HeartButton({ product, size = 17, className = "" }: { product: Product; size?: number; className?: string }) {
  const { favs, toggle } = useContext(FavContext);
  const on = favs.includes(product.id);
  return (
    <button className={`${className} ${on ? "heart-on" : ""}`.trim()} aria-pressed={on} aria-label={on ? `Bỏ quan tâm ${product.title}` : `Quan tâm ${product.title}`} title={on ? "Bỏ quan tâm" : "Quan tâm"} onClick={(event) => { event.stopPropagation(); toggle(product); }}>
      <Icon name="heart" size={size} />
    </button>
  );
}

// Số hiển thị = số thật + X (admin tự điền). Khoá học bán trên Udemy nên số người mua chỉ dùng X.
// Admin có thể ẩn từng loại số.
function ProductEngagement({ product, light = false }: { product: Product; light?: boolean }) {
  const { delta } = useContext(FavContext);
  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.max(0, n));
  const udemy = product.kind === "course" && !isSelfCourse(product);
  const buyers = (udemy ? 0 : product.buyers || 0) + (product.bonusBuyers || 0);
  const interest = (product.interested || 0) + (delta[product.id] || 0) + (product.bonusInterest || 0);
  const showB = product.showBuyers !== false;
  const showI = product.showInterest !== false && interest > 0;
  if (!showB && !showI) return null;
  return (
    <small className={`product-engagement ${light ? "light" : ""}`}>
      {showB && <><Icon name={udemy ? "play" : "users"} size={13} /> {fmt(buyers)} {udemy ? "lượt xem khoá học" : product.kind === "event" ? "người đã đăng ký" : isSelfCourse(product) ? "học viên đã đăng ký" : isFreeProduct(product) ? "người đã nhận" : "người đã mua"}</>}
      {showB && showI && <span className="engagement-dot">·</span>}
      {showI && <><Icon name="heart" size={13} /> {fmt(interest)} người quan tâm</>}
    </small>
  );
}

const EXTRA_CSS = `
.price-tag{display:inline-flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.price-tag s{opacity:.55;font-size:.85em;font-weight:400;}
.price-tag em{font-style:normal;font-size:.72em;font-weight:600;color:#fff;background:#c0675a;border-radius:999px;padding:2px 8px;align-self:center;}
.heart-on{color:#c0675a !important;}
.heart-on svg{fill:currentColor;}
.engagement-dot{margin:0 6px;opacity:.6;}
.combo-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px;}
.combo-item{display:flex;gap:12px;align-items:center;text-align:left;font:inherit;color:inherit;background:rgba(255,255,255,.6);border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:8px;cursor:pointer;min-width:0;}
.combo-item img{width:56px;height:56px;object-fit:cover;border-radius:8px;flex:none;}
.combo-item span{display:flex;flex-direction:column;min-width:0;}
.combo-item small{font-size:.7em;letter-spacing:.08em;opacity:.65;}
.combo-item strong{font-weight:600;font-size:.92em;line-height:1.35;}
.combo-item em{font-style:normal;font-size:.85em;opacity:.8;}
.combo-warn{background:rgba(192,103,90,.1);border-radius:10px;padding:10px 12px;margin:6px 0 4px;}
.copy-link-btn{font:inherit;font-size:.85em;padding:8px 16px;border-radius:999px;border:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.7);cursor:pointer;color:inherit;}
/* Lưới Khám phá (màn hình lớn): 2 hàng cố định 330px, ảnh ô nhỏ cao 180px */
@media (min-width:1024px){
  .showcase-grid{grid-template-rows:none !important;grid-auto-rows:330px !important;}
  .showcase-grid > *{height:330px !important;min-height:0 !important;max-height:330px;overflow:hidden;}
  .showcase-grid .showcase-hero > img,.showcase-grid .showcase-deal > img{position:absolute;inset:0;width:100%;height:100% !important;object-fit:cover;}
  .showcase-grid .showcase-product{display:flex !important;flex-direction:column;}
  .showcase-grid .showcase-product .product-media{flex:none;height:180px !important;min-height:0;position:relative;overflow:hidden;}
  .showcase-grid .showcase-product .product-media img{width:100%;height:100% !important;object-fit:cover;}
}
/* Trái tim trên ô lớn (nổi bật / Dành cho bạn) */
.showcase-hero,.showcase-deal{position:relative;}
.big-card-heart{position:absolute !important;top:16px;right:16px;left:auto !important;bottom:auto !important;z-index:3;}
.booking-phone{font:inherit;width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(0,0,0,.15);background:#fff;box-sizing:border-box;}
/* Ô lớn trang chủ: tên + mô tả ngắn chỉ chiếm nửa trái ảnh bìa, tự xuống dòng */
.showcase-hero-copy,.deal-copy{max-width:50%;}
.showcase-hero-copy h2,.showcase-hero-copy p,.deal-copy h2,.deal-copy p{overflow-wrap:break-word;}
@media (max-width:760px){.showcase-hero-copy,.deal-copy{max-width:100%;}}
/* Trang chi tiết: khung ảnh cố định tỉ lệ 4:5, không kéo dài theo nội dung */
.product-detail-page .detail-image{aspect-ratio:4/5;height:auto !important;min-height:0 !important;align-self:start;overflow:hidden;}
.product-detail-page .detail-image img{width:100%;height:100%;object-fit:cover;}
/* Trang chi tiết: mô tả ngắn hiện đầy đủ, rộng hết khung */
.product-detail-page .detail-summary > p{max-width:none !important;width:auto;display:block;overflow:visible;-webkit-line-clamp:unset;line-clamp:unset;-webkit-box-orient:initial;text-overflow:clip;white-space:normal;}
.event-info{display:grid;gap:8px;margin:14px 0;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.06);}
.event-info div{display:flex;gap:12px;flex-wrap:wrap;}
.event-info span{min-width:90px;opacity:.65;}
.refund-note{margin:4px 0 0;font-weight:600;color:#3f7d4e;}
.detail-content-text{margin:20px 0 0;padding:20px;border-radius:16px;background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.06);}
.detail-content-text h2{margin:0 0 10px;}
.detail-content-text p{white-space:pre-line;margin:0;line-height:1.7;}
.reg-form{max-width:720px;margin:0 auto;}
.reg-form label{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
.reg-form label > span{font-weight:600;}
.reg-form input,.reg-form textarea{font:inherit;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.15);background:#fff;}
.reg-form .reg-check{flex-direction:row;align-items:flex-start;gap:10px;}
.reg-form .reg-check input{margin-top:4px;}
.reg-form .reg-box{padding:16px;border-radius:14px;background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.06);margin-bottom:16px;}
.reg-form .reg-error{color:#c00;margin:0 0 12px;}
.reg-form .reg-actions{display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap;}
.reg-form .reg-actions button{font:inherit;padding:12px 22px;border-radius:999px;border:1px solid rgba(0,0,0,.15);background:#fff;cursor:pointer;}
.reg-form .reg-actions button.primary{background:#3f3b37;color:#fff;border-color:#3f3b37;}
.legal-links{display:block;opacity:.75;line-height:1.6;}
.legal-links a{color:inherit;text-decoration:underline;}
.legal-text h2{margin:20px 0 8px;}
.legal-text h3{margin:16px 0 6px;font-size:1.05em;}
.legal-text p{white-space:normal;margin:0 0 10px;}
.legal-text ul{margin:0 0 10px;padding-left:22px;line-height:1.7;}
.sidebar-legal{display:block;padding:10px 18px 4px;font-size:.78em;opacity:.7;}
.sidebar-legal a{color:inherit;}
.site-footer{margin-top:40px;}
.site-footer a{color:inherit;}
.participant-links{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0;}
.participant-links a{display:inline-flex;align-items:center;gap:6px;padding:11px 20px;border-radius:999px;background:#3f3b37;color:#fff;text-decoration:none;}
.participant-links a.secondary{background:#fff;color:#3f3b37;border:1px solid rgba(0,0,0,.15);}
.product-engagement{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;}
`;

function ShowcaseProductCard({ product, owned, onSelect }: { product: Product; owned: boolean; onSelect: (product: Product) => void }) {
  return (
    <article className="showcase-product clickable-product" role="button" tabIndex={0} onClick={() => onSelect(product)} onKeyDown={(event) => event.key === "Enter" && onSelect(product)}>
      <div className="product-media">
        <img src={product.imageCard || product.image} alt={product.title} />
        <HeartButton product={product} size={16} className="heart-button" />
        <span className="product-pill">{owned ? "Đã sở hữu" : product.badge || product.category}</span>
      </div>
      <div className="product-details">
        <span>{product.kind === "combo" ? `COMBO${discountPercent(product) ? ` · TIẾT KIỆM ${discountPercent(product)}%` : ""}` : product.kind === "event" ? `SỰ KIỆN${product.eventDate ? ` · ${shortDate(product.eventDate)}` : ""}` : product.kind === "document" ? "TÀI LIỆU" : product.kind === "course" ? "KHOÁ HỌC" : "CÔNG CỤ"}</span>
        <h2>{product.title}</h2>
        <p>{product.description}</p>
        <ProductEngagement product={product} />
        <PriceTag product={product} />
      </div>
    </article>
  );
}

function ProductCatalogShowcase({ products, ownedProductIds, onSelect }: { products: Product[]; ownedProductIds: string[]; onSelect: (product: Product) => void }) {
  if (products.length === 0) {
    return (
      <div className="documents-empty">
        <p>Sản phẩm đang được cập nhật. Quay lại sớm nhé 🌱</p>
      </div>
    );
  }

  const [featured, second, third, fourth, fifth, deal] = products;

  return (
    <section className="showcase-grid catalog-showcase" aria-label="Sản phẩm khám phá">
      <article className="showcase-hero clickable-product" role="button" tabIndex={0} onClick={() => onSelect(featured)} onKeyDown={(event) => event.key === "Enter" && onSelect(featured)}>
        <img src={featured.image} alt={featured.title} />
        <div className="showcase-shade" />
        <HeartButton product={featured} size={17} className="heart-button big-card-heart" />
        <div className="showcase-hero-copy">
          <span>{ownedProductIds.includes(featured.id) ? "ĐÃ SỞ HỮU" : featured.badge?.toUpperCase() || "NỔI BẬT"}{eventTag(featured)}</span>
          <h2>{featured.title}</h2>
          <p>{featured.description}</p>
          <ProductEngagement product={featured} />
          <button>{viewLabel(featured)} · {priceText(featured)}</button>
        </div>
      </article>

      {second && <ShowcaseProductCard product={second} owned={ownedProductIds.includes(second.id)} onSelect={onSelect} />}
      {third && <ShowcaseProductCard product={third} owned={ownedProductIds.includes(third.id)} onSelect={onSelect} />}
      {fourth && <ShowcaseProductCard product={fourth} owned={ownedProductIds.includes(fourth.id)} onSelect={onSelect} />}
      {fifth && <ShowcaseProductCard product={fifth} owned={ownedProductIds.includes(fifth.id)} onSelect={onSelect} />}

      {deal && (
        <article className="showcase-deal clickable-product" role="button" tabIndex={0} onClick={() => onSelect(deal)} onKeyDown={(event) => event.key === "Enter" && onSelect(deal)}>
          <img src={deal.image} alt={deal.title} />
          <div className="deal-shade" />
          <HeartButton product={deal} size={17} className="heart-button big-card-heart" />
          <div className="deal-copy">
            <span>{ownedProductIds.includes(deal.id) ? "ĐÃ SỞ HỮU" : "DÀNH CHO BẠN"}{eventTag(deal)}</span>
            <h2>{deal.title}</h2>
            <p>{deal.description}</p>
            <ProductEngagement product={deal} />
            <button>{viewLabel(deal)} · {priceText(deal)}</button>
          </div>
        </article>
      )}
    </section>
  );
}

const detailCopy: Record<ProductKind, { heading: string; outcomes: string[]; audience: string[]; buy: string; access: string }> = {
  document: {
    heading: "Bạn sẽ đọc và nhận được gì?",
    outcomes: ["Nội dung được hệ thống hóa, dễ đọc và áp dụng", "Bài tập thực hành giúp biến kiến thức thành hành động", "Tài liệu tải về để sử dụng lâu dài"],
    audience: ["Người muốn tự học theo lộ trình rõ ràng", "Người đang cần một góc nhìn thực tế, dễ áp dụng", "Người muốn chủ động phát triển sự nghiệp"],
    buy: "Mua tài liệu",
    access: "Đọc ngay",
  },
  tool: {
    heading: "Bạn sẽ sử dụng được gì?",
    outcomes: ["Bộ template sẵn sàng để bắt đầu ngay", "Hướng dẫn từng bước, không cần kinh nghiệm", "Cập nhật miễn phí khi có phiên bản mới"],
    audience: ["Người muốn làm việc có hệ thống hơn", "Người cần tiết kiệm thời gian và công sức", "Người yêu thích công cụ trực quan, tối giản"],
    buy: "Mua công cụ",
    access: "Sử dụng ngay",
  },
  course: {
    heading: "Bạn sẽ học được gì?",
    outcomes: ["Lộ trình bài học ngắn gọn và có hệ thống", "Bài tập thực hành sau mỗi nội dung", "Quyền truy cập tài liệu bổ trợ đi kèm"],
    audience: ["Người muốn học theo một lộ trình rõ ràng", "Người cần nâng cấp kỹ năng nghề nghiệp", "Người thích học linh hoạt theo tốc độ riêng"],
    buy: "Mua khoá học",
    access: "Học ngay",
  },
  combo: {
    heading: "Bạn sẽ nhận được gì?",
    outcomes: ["Trọn bộ sản phẩm trong combo, dùng vĩnh viễn", "Tiết kiệm hơn so với mua lẻ từng sản phẩm", "Mở quyền tất cả cùng lúc sau khi thanh toán"],
    audience: ["Người muốn có trọn bộ tài liệu và công cụ", "Người muốn tiết kiệm chi phí", "Người muốn bắt đầu bài bản ngay từ đầu"],
    buy: "Mua combo",
    access: "Xem sản phẩm của tôi",
  },
  event: {
    heading: "Sau khi tham gia bạn sẽ nhận được gì?",
    outcomes: ["Góc nhìn thực tế từ người trong nghề", "Giải đáp trực tiếp câu hỏi của bạn", "Tài liệu tổng hợp sau sự kiện"],
    audience: ["Người muốn hiểu rõ hơn về chủ đề của sự kiện", "Người đang cần định hướng cho bước tiếp theo", "Người muốn kết nối với cộng đồng cùng mối quan tâm"],
    buy: "Đăng ký tham gia",
    access: "Xem thông tin tham gia",
  },
  mentoring: {
    heading: "Bạn sẽ nhận được gì?",
    outcomes: ["Buổi trò chuyện riêng tập trung vào vấn đề của bạn", "Góc nhìn khách quan và định hướng hành động", "Tóm tắt kế hoạch sau buổi đồng hành"],
    audience: ["Người đang đứng trước một lựa chọn quan trọng", "Người cần gỡ rối và xác định bước tiếp theo", "Người muốn có một không gian lắng nghe an toàn"],
    buy: "Đặt lịch đồng hành",
    access: "Tham gia ngay",
  },
};

// Chữ trên trang chi tiết theo từng loại (khoá học tự tổ chức khác khoá Udemy)
function copyFor(product: Product) {
  const base = detailCopy[product.kind] || detailCopy.document;
  if (!isSelfCourse(product)) return base;
  return { ...base, heading: "Sau khoá học bạn sẽ nhận được gì?", buy: "Đăng ký khoá học", access: "Xem thông tin lớp học" };
}

function ProductCatalogPage({
  query,
  products: catalogProducts,
  eyebrow,
  title,
  description,
  countLabel,
  onSelect,
  ownedProductIds,
}: {
  query: string;
  products: Product[];
  eyebrow: string;
  title: string;
  description: string;
  countLabel: string;
  onSelect: (product: Product) => void;
  ownedProductIds: string[];
}) {
  const [filter, setFilter] = useState("Khám phá");
  const products = catalogProducts.filter((product) => {
    const matchesFilter = filter === "Khám phá" || product.tabs.includes(filter);
    const matchesQuery = product.title.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });
  const showShowcase = filter === "Khám phá" && !query.trim();

  return (
    <div className="documents-page">
      <header className="documents-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="document-count"><strong>{catalogProducts.length}</strong><span>{countLabel}<br />đang mở bán</span></div>
      </header>

      <DiscoveryTabs active={filter} onChange={setFilter} />

      {showShowcase ? (
        <ProductCatalogShowcase products={catalogProducts} ownedProductIds={ownedProductIds} onSelect={onSelect} />
      ) : (
      <section className="documents-grid" aria-label={`Danh sách ${countLabel.toLowerCase()}`}>
        {products.map((product) => (
          <article className="document-card" key={product.title} role="button" tabIndex={0} onClick={() => onSelect(product)} onKeyDown={(event) => event.key === "Enter" && onSelect(product)}>
            <div className="document-cover">
              <img src={product.imageCard || product.image} alt="" />
              {(ownedProductIds.includes(product.id) || product.badge) && <span>{ownedProductIds.includes(product.id) ? "Đã sở hữu" : product.badge}</span>}
              <HeartButton product={product} />
            </div>
            <div className="document-card-copy">
              <span>{product.kind === "combo" ? "COMBO" : product.kind === "event" ? `${shortDate(product.eventDate) || "SỰ KIỆN"} · ${formatLabel(product).toUpperCase()}${isPastEvent(product) ? " · ĐÃ DIỄN RA" : ""}` : product.category.toUpperCase()}</span>
              <h2>{product.title}</h2>
              <p>{product.description}</p>
              <ProductEngagement product={product} />
              <div><PriceTag product={product} /><button aria-label={`Xem ${product.title}`}><Icon name="arrow" size={16} /></button></div>
            </div>
          </article>
        ))}
      </section>
      )}

      {!showShowcase && products.length === 0 && <div className="documents-empty">Chưa tìm thấy sản phẩm phù hợp. Hãy thử một từ khóa khác nhé.</div>}
    </div>
  );
}

type Article = {
  id: string;
  title: string;
  category: string;
  readTime: string;
  views: string;
  image: string;
  excerpt: string;
  content: string;
  publishedAt: string;
};

// Hiển thị "6 phút đọc · 120 lượt đọc" — ẩn lượt đọc khi chưa có
function articleStats(article: Article) {
  return article.views ? `${article.readTime} · ${article.views} lượt đọc` : article.readTime;
}

// Định dạng trong dòng: **đậm**, *nghiêng*, [liên kết](https://...)
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)\s]+\))/g).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*\n]+\*$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      return /^https?:\/\//i.test(link[2])
        ? <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>
        : link[1];
    }
    return part.split("\n").flatMap((line, i) => (i === 0 ? [line] : [<br key={`${index}-${i}`} />, line]));
  });
}

// Chuyển nội dung soạn trong Admin (kiểu Markdown) thành giao diện bài viết
function renderArticleBlock(block: string, index: number) {
  const trimmed = block.trim();
  if (!trimmed) return null;
  if (trimmed === "---") return <hr key={index} />;
  if (trimmed.startsWith("## ")) return <h2 key={index}>{renderInline(trimmed.slice(3))}</h2>;
  if (trimmed.startsWith("# ")) return <h2 key={index}>{renderInline(trimmed.slice(2))}</h2>;
  if (trimmed.startsWith("> [!NOTE]")) {
    return (
      <div className="article-note" key={index}>
        <span><Icon name="sparkle" size={21} /></span>
        <div><p>{renderInline(trimmed.replace("> [!NOTE]", "").trim())}</p></div>
      </div>
    );
  }
  if (trimmed.startsWith("> ")) return <blockquote key={index}>“{renderInline(trimmed.slice(2))}”</blockquote>;
  const image = trimmed.match(/^!\[(.*?)\]\((\S+?)\)$/);
  if (image) {
    return <figure key={index}><img src={optimizeImage(image[2], 1400)} alt={image[1]} loading="lazy" style={{ width: "100%", borderRadius: 16 }} />{image[1] && <figcaption style={{ fontSize: "0.85em", opacity: 0.7, marginTop: 8, textAlign: "center" }}>{image[1]}</figcaption>}</figure>;
  }
  const lines = trimmed.split("\n");
  if (lines.every((line) => line.startsWith("- "))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{renderInline(line.slice(2))}</li>)}</ul>;
  if (lines.every((line) => /^\d+\. /.test(line))) return <ol key={index}>{lines.map((line, i) => <li key={i}>{renderInline(line.replace(/^\d+\. /, ""))}</li>)}</ol>;
  return <p key={index}>{renderInline(trimmed)}</p>;
}

function ArticlesPage({ articles, onSelect }: { articles: Article[]; onSelect: (article: Article) => void }) {
  return (
    <div className="articles-page">
      <header className="articles-header">
        <div><span className="eyebrow">GÓC VIẾT TIAHERE</span><h1>Những góc nhìn để<br />đi đường dài hơn.</h1></div>
        <p>Câu chuyện, trải nghiệm và những ghi chép thực tế về sự nghiệp, công việc và hành trình hiểu mình.</p>
      </header>

      {articles.length === 0 ? (
        <div className="documents-empty">
          <p>Bài viết đang được cập nhật. Quay lại sớm nhé 🌱</p>
        </div>
      ) : (
        <section className="showcase-grid article-showcase" aria-label="Bài viết nổi bật">
          {articles.map((article, i) => {
            if (i === 0) return (
              <article key={article.id} className="showcase-hero article-link-card" role="button" tabIndex={0} onClick={() => onSelect(article)} onKeyDown={(e) => e.key === "Enter" && onSelect(article)}>
                <img src={article.image} alt={article.title} />
                <div className="showcase-shade" />
                <div className="showcase-hero-copy">
                  <span>BÀI VIẾT MỚI{article.views ? ` · ${article.views} LƯỢT ĐỌC` : ""}</span>
                  <h2>{article.title}</h2>
                  <p>{article.excerpt}</p>
                  <button>Đọc bài viết</button>
                </div>
              </article>
            );
            if (i <= 2) return (
              <article key={article.id} className="showcase-product article-card article-link-card" role="button" tabIndex={0} onClick={() => onSelect(article)} onKeyDown={(e) => e.key === "Enter" && onSelect(article)}>
                <div className="product-media">
                  <img src={article.image} alt={article.title} />
                  <span className="product-pill">{article.category}</span>
                </div>
                <div className="product-details">
                  <span>{article.category.toUpperCase()}</span>
                  <h2>{article.title}</h2>
                  <p>{articleStats(article)}</p>
                  <strong>Đọc ngay →</strong>
                </div>
              </article>
            );
            return (
              <article key={article.id} className={`article-square-card ${i % 2 === 0 ? "light" : ""} article-link-card`} role="button" tabIndex={0} onClick={() => onSelect(article)} onKeyDown={(e) => e.key === "Enter" && onSelect(article)}>
                <img src={article.image} alt={article.title} />
                <div className="square-card-shade" />
                <div><span>{article.category.toUpperCase()}</span><h2>{article.title}</h2><p>{articleStats(article)}</p></div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function ArticleDetailPage({ article, articles, onBack, onSelect }: { article: Article; articles: Article[]; onBack: () => void; onSelect: (article: Article) => void }) {
  const related = articles.filter((item) => item.id !== article.id).slice(0, 3);
  const [copied, setCopied] = useState(false);

  // Đếm lượt đọc thật: mỗi trình duyệt chỉ tính 1 lần cho mỗi bài trong một phiên (tải lại trang không bị cộng thêm)
  useEffect(() => {
    const key = `tia-read-${article.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* trình duyệt chặn lưu tạm */ }
    updateDoc(doc(db, "articles", article.id), { views: increment(1) }).catch(() => { /* bỏ qua nếu không ghi được */ });
  }, [article.id]);
  const shareUrl = `${window.location.origin}${window.location.pathname}#article=${article.id}`;
  const encodedUrl = encodeURIComponent(shareUrl);

  const shareArticle = (network: "facebook" | "linkedin") => {
    const url = network === "facebook"
      ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
      : `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=620");
  };

  const copyArticleLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="article-detail-page">
      <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại Bài viết</button>
      <header className="article-detail-header">
        <div className="article-meta"><span>{article.category.toUpperCase()}</span><i /> <span>{article.readTime}</span>{article.views && <><i /> <span>{article.views} lượt đọc</span></>}{article.publishedAt && <><i /> <span>{new Date(`${article.publishedAt}T12:00:00`).toLocaleDateString("vi-VN")}</span></>}</div>
        <h1>{article.title}</h1>
        <p>{article.excerpt}</p>
        <div className="article-author">
          <span className="avatar">TN</span>
          <div><strong>Tia Nguyễn</strong><small>Người viết tại tiahere</small></div>
        </div>
      </header>

      {article.image && <div className="article-cover"><img src={article.image} alt={article.title} /></div>}

      <article className="article-body">
        {article.content.split(/\n{2,}/).map(renderArticleBlock)}

        <footer>
          <span>Chia sẻ bài viết</span>
          <div>
            <button onClick={() => shareArticle("facebook")}>Facebook</button>
            <button onClick={() => shareArticle("linkedin")}>LinkedIn</button>
            <button onClick={copyArticleLink}>{copied ? "Đã sao chép" : "Sao chép liên kết"}</button>
          </div>
        </footer>
      </article>

      {related.length > 0 && <section className="related-articles">
        <header><span className="eyebrow">ĐỌC TIẾP</span><h2>Có thể bạn cũng quan tâm</h2></header>
        <div>
          {related.map((item) => (
            <article key={item.id} onClick={() => onSelect(item)}>
              <img src={item.image} alt="" />
              <div><span>{item.category.toUpperCase()}</span><h3>{item.title}</h3><p>{articleStats(item)}</p></div>
            </article>
          ))}
        </div>
      </section>}
    </div>
  );
}

// Default mentoring content — mirrors defaultMentoringData in AdminApp
const DEFAULT_MENTORING = {
  header: {
    eyebrow: "ĐỒNG HÀNH CÙNG TIA",
    title: "Một khoảng dừng để đi tiếp.",
    description: "Không phán xét, không áp đặt. Chỉ là một cuộc trò chuyện đủ sâu để bạn nhìn rõ điều mình đang cần.",
  },
  cardFree: {
    imageUrl: "https://images.unsplash.com/photo-1648737966150-0ca228eedfa0?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Hai người trò chuyện và đồng hành cùng nhau",
    badge: "MIỄN PHÍ",
    eyebrow: "ĐỒNG HÀNH 1:1 · 30 PHÚT",
    title: "Cuộc trò chuyện đầu tiên",
    description: "Một buổi call ngắn để lắng nghe điều bạn đang băn khoăn, cùng gọi tên vấn đề và xác định một bước nhỏ tiếp theo.",
    bullet1: "Call trực tuyến riêng tư cùng Tia",
    bullet2: "Thời lượng 30 phút",
    bullet3: "Hoàn toàn miễn phí",
    ctaLoggedIn: "Đặt lịch miễn phí",
    ctaGuest: "Đăng nhập để đặt lịch",
  },
  cardPaid: {
    imageUrl: "https://images.unsplash.com/photo-1758874384556-cc2b9dcbb6e0?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Người hướng dẫn làm việc tại bàn",
    badge: "THEO GÓI",
    eyebrow: "ĐỒNG HÀNH 1:1 · CHUYÊN SÂU",
    title: "Đi cùng bạn trên một chặng",
    description: "Chương trình đồng hành trả phí dành cho những vấn đề cần thời gian, chiều sâu và một lộ trình cá nhân hóa.",
    bullet1: "Nhiều buổi call theo lộ trình riêng",
    bullet2: "Kế hoạch hành động sau mỗi buổi",
    bullet3: "Theo dõi tiến độ giữa các buổi",
    cta: "Đặt lịch riêng ở Zalo",
  },
};

function MentoringPage({ user, onBookFree, onBookPrivate }: { user: User | null; onBookFree: () => void; onBookPrivate: () => void }) {
  const [filter, setFilter] = useState("Khám phá");
  const [content, setContent] = useState(DEFAULT_MENTORING);
  const showFree = filter === "Khám phá" || filter === "Phổ biến" || filter === "Ưu đãi";
  const showPaid = filter === "Khám phá" || filter === "Mới nhất";

  useEffect(() => {
    getDoc(doc(db, "settings", "mentoring"))
      .then((snap) => {
        if (snap.exists()) {
          setContent(snap.data() as typeof DEFAULT_MENTORING);
        }
      })
      .catch(() => { /* giữ default nếu lỗi */ });
  }, []);

  const { header, cardFree, cardPaid } = content;

  return (
    <div className="mentoring-page">
      <header className="mentoring-header">
        <span className="eyebrow">{header.eyebrow}</span>
        <h1>{header.title}</h1>
        <p>{header.description}</p>
      </header>

      <section className="mentoring-grid">
        {showFree && (
          <article className="mentoring-card free">
            <div className="mentoring-image">
              <img src={cardFree.imageUrl} alt={cardFree.imageAlt} />
              <span>{cardFree.badge}</span>
            </div>
            <div className="mentoring-copy">
              <span className="eyebrow">{cardFree.eyebrow}</span>
              <h2>{cardFree.title}</h2>
              <p>{cardFree.description}</p>
              <ul>
                <li><i>✓</i> {cardFree.bullet1}</li>
                <li><i>✓</i> {cardFree.bullet2}</li>
                <li><i>✓</i> {cardFree.bullet3}</li>
              </ul>
              <button onClick={onBookFree}>{user ? cardFree.ctaLoggedIn : cardFree.ctaGuest}<Icon name="arrow" size={17} /></button>
            </div>
          </article>
        )}

        {showPaid && (
          <article className="mentoring-card paid">
            <div className="mentoring-image">
              <img src={cardPaid.imageUrl} alt={cardPaid.imageAlt} />
              <span>{cardPaid.badge}</span>
            </div>
            <div className="mentoring-copy">
              <span className="eyebrow">{cardPaid.eyebrow}</span>
              <h2>{cardPaid.title}</h2>
              <p>{cardPaid.description}</p>
              <ul>
                <li><i>✓</i> {cardPaid.bullet1}</li>
                <li><i>✓</i> {cardPaid.bullet2}</li>
                <li><i>✓</i> {cardPaid.bullet3}</li>
              </ul>
              <button onClick={onBookPrivate}>{cardPaid.cta}</button>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}

// Chuẩn hoá số điện thoại VN: bỏ khoảng trắng/dấu, +84/84 → 0. Trả "" nếu không hợp lệ.
function normalizeVNPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : "";
}

function FreeBookingPage({ user, onBack, onComplete, onBooked }: { user: User; onBack: () => void; onComplete: () => void; onBooked: (booking: BookingRecord) => void }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [issue, setIssue] = useState("");
  const [topic, setTopic] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const phone = normalizeVNPhone(phoneRaw);
  const [submitted, setSubmitted] = useState(false);
  const [takenDates, setTakenDates] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const today = todayISO();
  const currentMonthStart = (() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); })();

  // Tải các ngày đã có người đặt hoặc admin đã chặn
  const loadSlots = () => {
    getDocs(collection(db, "slots"))
      .then((snapshot) => {
        const map: Record<string, string> = {};
        snapshot.docs.forEach((d) => { map[d.id] = String(d.data().type || "booked"); });
        setTakenDates(map);
      })
      .catch(() => { /* lỗi mạng — vẫn cho chọn, khi gửi sẽ kiểm tra lại */ });
  };
  useEffect(loadSlots, []);

  const submitBooking = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !selectedDate) return;
    setSending(true);
    setError("");
    if (!phone) { setError("Số Zalo chưa đúng. Bạn nhập số điện thoại Việt Nam gồm 10 số, ví dụ 0912345678."); setSending(false); return; }
    // Mỗi tài khoản và mỗi số Zalo chỉ được đặt 1 buổi miễn phí
    try {
      const [phoneSnap, userSnap] = await Promise.all([getDoc(doc(db, "bookingPhones", phone)), getDoc(doc(db, "bookingUsers", uid))]);
      if (userSnap.exists()) { setError("Mỗi tài khoản được đặt 1 buổi Đồng hành 1:1 miễn phí, và tài khoản của bạn đã đặt rồi. Nếu cần hỗ trợ thêm, bạn nhắn Zalo cho Tia nhé."); setSending(false); return; }
      if (phoneSnap.exists()) { setError("Số Zalo này đã được dùng để đặt buổi Đồng hành 1:1 miễn phí. Mỗi người được đặt 1 buổi. Nếu cần hỗ trợ thêm, bạn nhắn Zalo cho Tia nhé."); setSending(false); return; }
    } catch { /* lỗi mạng: vẫn thử gửi, quy tắc bảo mật sẽ chặn nếu trùng */ }
    const booking = {
      uid,
      email: user.email,
      name: user.name,
      phone,
      date: selectedDate,
      time: "20:30–21:00",
      issue,
      topic: topic.trim(),
      status: "Chờ xác nhận",
      createdAt: new Date().toISOString(),
    };
    try {
      // Ghi cùng lúc: khoá ngày + tạo lịch. Nếu ngày vừa có người khác đặt, cả hai cùng bị từ chối.
      const batch = writeBatch(db);
      const bookingRef = doc(collection(db, "bookings"));
      batch.set(doc(db, "slots", selectedDate), { type: "booked", createdAt: booking.createdAt, bookingId: bookingRef.id });
      batch.set(bookingRef, booking);
      batch.set(doc(db, "bookingPhones", phone), { bookingId: bookingRef.id, createdAt: booking.createdAt });
      batch.set(doc(db, "bookingUsers", uid), { bookingId: bookingRef.id, createdAt: booking.createdAt });
      await batch.commit();
      sendEmail({ type: "booking_pending", email: user.email, name: user.name, date: formatDateVN(selectedDate, true), time: "20:30–21:00" });
      onBooked({ id: bookingRef.id, date: booking.date, time: booking.time, issue: booking.issue, topic: booking.topic, status: booking.status, createdAt: booking.createdAt });
      setSubmitted(true);
    } catch {
      setError("Ngày này vừa có người đặt hoặc đã bị khoá. Bạn chọn ngày khác giúp Tia nhé.");
      setSelectedDate(null);
      loadSlots();
    } finally {
      setSending(false);
    }
  };
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const monthLabel = month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  const changeMonth = (offset: number) => {
    const next = new Date(year, monthIndex + offset, 1);
    if (next < currentMonthStart) return;
    setMonth(next);
    setSelectedDate(null);
  };

  if (submitted) {
    return (
      <div className="booking-success">
        <span className="pending-icon"><Icon name="clock" size={32} /></span>
        <span className="eyebrow">ĐÃ NHẬN ĐĂNG KÝ</span>
        <h1>Tia sẽ sớm xác nhận<br />lịch cùng bạn.</h1>
        <p>Yêu cầu đặt lịch đã được ghi nhận. Tia Nguyễn sẽ xác nhận qua email <strong>{user.email}</strong> trong vòng 24 giờ.</p>
        <p style={{ fontSize: "0.9em", opacity: 0.8 }}>Không thấy email? Bạn kiểm tra giúp mục <strong>Spam</strong> hoặc <strong>Quảng cáo</strong> trong hộp thư, và bấm "Không phải thư rác" để lần sau nhận đúng chỗ nhé.</p>
        <div><span>Thời gian bạn chọn</span><strong>{selectedDate ? formatDateVN(selectedDate, true) : ""} · 20:30–21:00</strong></div>
        <button onClick={onComplete}>Xem lịch call của tôi <Icon name="arrow" size={17} /></button>
      </div>
    );
  }

  return (
    <div className="booking-page">
      <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại Đồng hành 1:1</button>
      <header className="booking-header">
        <span className="eyebrow">ĐỒNG HÀNH 1:1 MIỄN PHÍ</span>
        <h1>Chọn khoảng thời gian<br />của bạn.</h1>
        <p>Tia Nguyễn nhận lịch vào thứ 3, thứ 5 và thứ 6, từ 20:30 đến 21:00.</p>
      </header>

      <div className="booking-layout">
        <section className="booking-calendar">
          <header>
            <button onClick={() => changeMonth(-1)} aria-label="Tháng trước" disabled={month <= currentMonthStart}><Icon name="arrow" size={17} /></button>
            <h2>{monthLabel}</h2>
            <button onClick={() => changeMonth(1)} aria-label="Tháng sau"><Icon name="arrow" size={17} /></button>
          </header>
          <div className="calendar-weekdays">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {Array.from({ length: startOffset }).map((_, index) => <span className="calendar-blank" key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const date = new Date(year, monthIndex, day);
              const value = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const available = [2, 4, 5].includes(date.getDay()) && value > today;
              const booked = available && Boolean(takenDates[value]);
              const selected = selectedDate === value;
              return (
                <button
                  key={day}
                  disabled={!available || booked}
                  className={`${available ? "available" : "unavailable"} ${booked ? "booked" : ""} ${selected ? "selected" : ""}`}
                  onClick={() => setSelectedDate(value)}
                  aria-label={`${day} ${monthLabel}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span><i className="available" /> Còn trống</span>
            <span><i className="booked" /> Đã kín lịch</span>
            <span><i className="selected" /> Bạn đang chọn</span>
          </div>
        </section>

        <section className="booking-form-card">
          <div className="booking-time"><span><Icon name="clock" size={20} /></span><div><small>KHUNG GIỜ CỐ ĐỊNH</small><strong>20:30–21:00</strong><p>30 phút · Google Meet</p></div></div>
          <div className="booking-fee"><span>Phí tham gia</span><strong>0đ</strong><small>Không cần thanh toán</small></div>
          <fieldset className="booking-issues">
            <legend>Bạn đang muốn trao đổi về vấn đề nào?</legend>
            {[
              "Sinh viên muốn xây dựng sự nghiệp",
              "Người đi làm muốn trao đổi về sự nghiệp bền vững",
              "Người muốn chuyển việc",
              "Khác",
            ].map((item) => (
              <button type="button" key={item} className={issue === item ? "selected" : ""} onClick={() => setIssue(item)}>
                <i />{item}
              </button>
            ))}
          </fieldset>
          <label>
            <span>Bạn muốn trao đổi về điều gì?</span>
            <textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải và điều mà bạn muốn nhận được sau buổi trò chuyện này..." rows={6} />
          </label>
          <label>
            <span>Số điện thoại Zalo *</span>
            <input className="booking-phone" type="tel" inputMode="tel" value={phoneRaw} onChange={(event) => setPhoneRaw(event.target.value)} placeholder="Ví dụ: 0912345678" />
            <small style={{ opacity: 0.7 }}>Tia có thể nhắn Zalo để hỏi thêm thông tin trước buổi call. Mỗi số Zalo và mỗi tài khoản được đặt 1 buổi miễn phí.</small>
          </label>
          <div className="booking-account"><Icon name="user" size={18} /><div><span>Đăng ký với tài khoản</span><strong>{user.email}</strong></div></div>
          <div className="booking-confirm-note"><Icon name="message" size={19} /><p>Tia Nguyễn sẽ xác nhận lịch qua email trong vòng 24h sau khi nhận đăng ký.</p></div>
          {error && <p style={{ color: "#c00", margin: "0 0 12px" }}>{error}</p>}
          <button disabled={!selectedDate || !issue || !topic.trim() || !phoneRaw.trim() || sending} onClick={submitBooking}>{sending ? "Đang gửi..." : "Gửi đăng ký lịch"} <Icon name="arrow" size={17} /></button>
        </section>
      </div>
    </div>
  );
}

type ReaderChapter = {
  title: string;
  eyebrow: string;
  introduction: string;
  paragraphs: string[];
  checklist: string[];
  quote?: string;
};

function createReaderChapters(product: Product): ReaderChapter[] {
  return [
    {
      title: "Bắt đầu hành trình",
      eyebrow: "CHƯƠNG 01",
      introduction: `Chào mừng bạn đến với ${product.title}. Đây là không gian để bạn chậm lại, quan sát điều đang diễn ra và bắt đầu bằng một bước đủ nhỏ.`,
      paragraphs: [
        "Tài liệu được thiết kế để bạn có thể đọc theo tốc độ riêng. Đừng cố hoàn thành tất cả trong một lần; hãy dừng lại ở những câu hỏi khiến bạn suy nghĩ.",
        "Chuẩn bị một cuốn sổ hoặc mở trang ghi chú. Những điều bạn tự viết ra sẽ quan trọng hơn bất kỳ câu trả lời có sẵn nào.",
      ],
      checklist: ["Chọn một không gian yên tĩnh", "Dành tối thiểu 20 phút không bị gián đoạn", "Viết xuống điều bạn mong muốn nhận được"],
      quote: "Không cần nhìn thấy toàn bộ con đường. Bạn chỉ cần nhìn rõ bước tiếp theo.",
    },
    {
      title: "Nhìn lại điểm xuất phát",
      eyebrow: "CHƯƠNG 02",
      introduction: "Trước khi lên kế hoạch cho một hướng đi mới, bạn cần hiểu rõ mình đang đứng ở đâu và điều gì đang thật sự cần được thay đổi.",
      paragraphs: [
        "Hãy quan sát công việc hiện tại qua ba khía cạnh: điều đang cho bạn năng lượng, điều đang lấy đi năng lượng và điều bạn muốn có nhiều hơn trong tương lai.",
        "Không có câu trả lời đúng hay sai. Mục tiêu của phần này là tạo ra một bức tranh trung thực, không phải một phiên bản hoàn hảo.",
      ],
      checklist: ["Liệt kê ba điều đang diễn ra tốt", "Gọi tên một khó khăn lớn nhất", "Chọn một điều bạn có thể chủ động thay đổi"],
    },
    {
      title: "Khung thực hành",
      eyebrow: "CHƯƠNG 03",
      introduction: "Biến những điều vừa nhận ra thành một khung hành động đơn giản, thực tế và có thể bắt đầu ngay trong tuần này.",
      paragraphs: [
        "Một kế hoạch tốt không cần quá nhiều đầu việc. Nó cần đủ rõ để bạn biết lúc nào nên bắt đầu, làm trong bao lâu và dấu hiệu nào cho thấy mình đang tiến bộ.",
        "Ưu tiên những thử nghiệm nhỏ thay vì quyết định lớn ngay lập tức. Mỗi thử nghiệm sẽ mang lại dữ liệu thật để bạn hiểu mình hơn.",
      ],
      checklist: ["Chọn một mục tiêu trong 30 ngày", "Chia mục tiêu thành bốn bước theo tuần", "Xác định người hoặc nguồn lực có thể hỗ trợ"],
      quote: "Sự rõ ràng đến từ hành động, không chỉ đến từ suy nghĩ.",
    },
    {
      title: "Kế hoạch tiếp theo",
      eyebrow: "CHƯƠNG 04",
      introduction: "Khép lại tài liệu bằng một cam kết vừa sức để những điều bạn vừa đọc không dừng lại trên trang giấy.",
      paragraphs: [
        "Hãy chọn một hành động duy nhất bạn sẽ thực hiện trong 48 giờ tới. Hành động càng cụ thể, khả năng bạn thực hiện càng cao.",
        "Bạn có thể quay lại tài liệu bất cứ lúc nào. Mỗi giai đoạn mới sẽ giúp bạn nhìn thấy một lớp ý nghĩa khác trong cùng một câu hỏi.",
      ],
      checklist: ["Viết hành động đầu tiên vào lịch", "Chọn ngày xem lại tiến độ", "Ghi lại một câu nhắc nhở dành cho chính mình"],
    },
  ];
}

function DocumentReaderPage({ product, user, onBack }: { product: Product; user: User; onBack: () => void }) {
  const chapters = createReaderChapters(product);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(1);
  const chapter = chapters[chapterIndex];

  return (
    <div className="reader-page">
      <header className="reader-toolbar">
        <button className="reader-back" onClick={onBack}><Icon name="arrow" size={16} /> Thoát trình đọc</button>
        <div className="reader-title"><span>{product.category.toUpperCase()}</span><strong>{product.title}</strong></div>
        <div className="reader-font-controls">
          <button disabled={fontSize === 0} onClick={() => setFontSize((size) => Math.max(0, size - 1))}>A−</button>
          <span>Cỡ chữ</span>
          <button disabled={fontSize === 2} onClick={() => setFontSize((size) => Math.min(2, size + 1))}>A+</button>
        </div>
      </header>

      <div className="reader-progress"><progress value={chapterIndex + 1} max={chapters.length} /><span>{chapterIndex + 1}/{chapters.length} chương</span></div>

      <div className="reader-layout">
        <aside className="reader-sidebar">
          <span className="eyebrow">MỤC LỤC</span>
          <nav>
            {chapters.map((item, index) => (
              <button className={index === chapterIndex ? "active" : ""} key={item.title} onClick={() => setChapterIndex(index)}>
                <i>{String(index + 1).padStart(2, "0")}</i><span>{item.title}</span>{index < chapterIndex && <b>✓</b>}
              </button>
            ))}
          </nav>
          <div className="reader-owned"><Icon name="sparkle" size={18} /><p>Sản phẩm thuộc quyền truy cập của <strong>{user.email}</strong></p></div>
        </aside>

        <main
          className={`reader-content reader-font-${fontSize}`}
          onCopy={(event) => event.preventDefault()}
          onCut={(event) => event.preventDefault()}
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
        >
          <div className="reader-watermark" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, index) => <span key={index}>{user.email} · tiahere</span>)}
          </div>
          <article>
            <span className="eyebrow">{chapter.eyebrow}</span>
            <h1>{chapter.title}</h1>
            <p className="reader-introduction">{chapter.introduction}</p>
            {chapter.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {chapter.quote && <blockquote>“{chapter.quote}”</blockquote>}
            <section className="reader-exercise">
              <span><Icon name="document" size={19} /></span>
              <div><h2>Thực hành ngay</h2><p>Đánh dấu khi bạn đã hoàn thành từng bước.</p></div>
              <ul>{chapter.checklist.map((item) => <li key={item}><i>✓</i>{item}</li>)}</ul>
            </section>
          </article>
          <footer className="reader-navigation">
            <button disabled={chapterIndex === 0} onClick={() => setChapterIndex((index) => index - 1)}><Icon name="arrow" size={16} /> Chương trước</button>
            <button disabled={chapterIndex === chapters.length - 1} onClick={() => setChapterIndex((index) => index + 1)}>Chương tiếp theo <Icon name="arrow" size={16} /></button>
          </footer>
        </main>
      </div>
    </div>
  );
}

// Trình đọc ebook: ưu tiên file lưu trong Firestore, sau đó đến URL, cuối cùng là nội dung mẫu
function EbookReaderPage({ product, user, onBack }: { product: Product; user: User; onBack: () => void }) {
  const [state, setState] = useState<"loading" | "html" | "url" | "fallback">("loading");
  const [html, setHtml] = useState("");

  useEffect(() => {
    getDoc(doc(db, "ebooks", product.id))
      .then((snap) => {
        const content = snap.exists() ? String(snap.data().html || "") : "";
        if (content) {
          setHtml(content);
          setState("html");
        } else {
          setState(product.ebookUrl ? "url" : "fallback");
        }
      })
      .catch(() => setState(product.ebookUrl ? "url" : "fallback"));
  }, [product.id, product.ebookUrl]);

  if (state === "fallback") return <DocumentReaderPage product={product} user={user} onBack={onBack} />;

  const userParam = `?user=${encodeURIComponent(user.email)}`;
  // Ebook tự vẽ watermark từ tham số ?user= trên URL. Khi hiển thị từ Firestore không có URL,
  // nên truyền email qua biến __TIA_SEARCH__ để ebook vẫn đọc được.
  const srcDoc = html
    ? `<script>window.__TIA_SEARCH__=${JSON.stringify(userParam)};</script>` +
      html.split("window.location.search").join("(window.__TIA_SEARCH__||window.location.search)")
    : "";

  return (
    <div className="reader-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="reader-toolbar">
        <button className="reader-back" onClick={onBack}><Icon name="arrow" size={16} /> Thoát trình đọc</button>
        <div className="reader-title"><span>{product.category.toUpperCase()}</span><strong>{product.title}</strong></div>
        <div />
      </header>
      {state === "loading" ? (
        <div style={{ padding: "80px 20px", textAlign: "center", opacity: 0.7 }}>Đang mở tài liệu...</div>
      ) : (
        <iframe
          title={product.title}
          {...(state === "html" ? { srcDoc } : { src: `${product.ebookUrl}${userParam}` })}
          sandbox="allow-scripts allow-popups"
          style={{ flex: 1, width: "100%", minHeight: "calc(100vh - 80px)", border: 0, background: "#fff" }}
        />
      )}
    </div>
  );
}

function ProductDetailPage({ product, pendingOrder, claiming = false, comboProducts = [], ownedIds = [], onOpenProduct, onBack, onPurchase, onAccess }: { product: Product; pendingOrder?: OrderRecord; claiming?: boolean; comboProducts?: Product[]; ownedIds?: string[]; onOpenProduct?: (product: Product) => void; onBack: () => void; onPurchase: () => void; onAccess: () => void }) {
  const copy = copyFor(product);
  const past = isPastEvent(product);
  const [linkCopied, setLinkCopied] = useState(false);
  // Combo: khách đã có sẵn một phần → không bán combo, gợi ý mua lẻ phần còn thiếu
  const isCombo = product.kind === "combo";
  const comboOwned = isCombo ? comboProducts.filter((p) => ownedIds.includes(p.id)) : [];
  const comboMissing = isCombo ? comboProducts.filter((p) => !ownedIds.includes(p.id)) : [];
  const comboBlocked = isCombo && !product.verified && comboOwned.length > 0 && comboMissing.length > 0;

  return (
    <div className="product-detail-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại</button>
        <button className="copy-link-btn" onClick={() => { navigator.clipboard?.writeText(productLink(product.id)); setLinkCopied(true); window.setTimeout(() => setLinkCopied(false), 1800); }}>{linkCopied ? "✓ Đã sao chép link" : "Sao chép link"}</button>
      </div>

      <section className="detail-hero">
        <div className="detail-image">
          {/* Ưu tiên ảnh đứng (Cover card 4:5) cho khung ảnh trang chi tiết */}
          <img src={product.imageCard || product.image} alt={product.title} />
          {product.badge && <span>{product.badge}</span>}
        </div>
        <div className="detail-summary">
          <span className="detail-label">{product.category.toUpperCase()}</span>
          <h1>{product.title}</h1>
          <p>{product.description}</p>
          {needsRegistration(product) && <EventInfo product={product} />}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><ProductEngagement product={product} /><HeartButton product={product} className="heart-button detail-heart" /></div>
          <div className={`access-status ${product.verified ? "verified" : ""}`}>
            <Icon name={product.verified ? "sparkle" : "clock"} size={18} />
            <span>{product.verified ? (needsRegistration(product) ? "Bạn đã đăng ký thành công" : "Bạn đã được xác thực quyền truy cập") : pendingOrder ? `Đơn ${pendingOrder.code} đang chờ admin xác nhận thanh toán` : past ? "Sự kiện đã diễn ra" : needsRegistration(product) ? (isFreeProduct(product) ? "Miễn phí - đăng nhập và điền form để đăng ký" : "Chỗ của bạn được giữ sau khi thanh toán và admin xác nhận") : isFreeProduct(product) ? "Sản phẩm miễn phí - đăng nhập để nhận và dùng ngay" : "Quyền truy cập được mở sau khi thanh toán và admin xác thực"}</span>
          </div>
          <div className="detail-purchase">
            <div><small>GIÁ SẢN PHẨM</small><PriceTag product={product} /></div>
            {!product.verified && pendingOrder
              ? <button disabled>Đang chờ xác nhận</button>
              : !product.verified && past
              ? <button disabled>Sự kiện đã diễn ra</button>
              : comboBlocked
              ? <button disabled>Không áp dụng</button>
              : <button className={product.verified ? "has-access" : ""} onClick={product.verified ? onAccess : onPurchase}>{product.verified ? copy.access : needsRegistration(product) ? copy.buy : isFreeProduct(product) ? (claiming ? "Đang mở quyền..." : "Nhận miễn phí") : copy.buy}<Icon name="arrow" size={17} /></button>}
          </div>

          {isCombo && comboProducts.length > 0 && (
            <section className="detail-content-text combo-list">
              <h2>Combo gồm {comboProducts.length} sản phẩm</h2>
              {comboBlocked && <p className="combo-warn">Bạn đã có {comboOwned.map((p) => p.title).join(", ")}, nên combo này không áp dụng cho tài khoản của bạn. Bạn có thể mua lẻ phần còn thiếu bên dưới.</p>}
              <div className="combo-items">
                {comboProducts.map((p) => (
                  <button type="button" key={p.id} className="combo-item" onClick={() => onOpenProduct?.(p)}>
                    <img src={p.imageCard || p.image} alt="" />
                    <span><small>{p.kind === "tool" ? "CÔNG CỤ" : "TÀI LIỆU"}</small><strong>{p.title}</strong><em>{ownedIds.includes(p.id) ? "Đã sở hữu" : priceText(p)}</em></span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {product.contentText && (
            <section className="detail-content-text">
              <h2>{product.kind === "event" ? "Nội dung sự kiện" : "Nội dung khoá học"}</h2>
              <p>{product.contentText}</p>
            </section>
          )}
          {needsRegistration(product) && product.note && (
            <section className="detail-content-text">
              <h2>Lưu ý cho người tham gia</h2>
              <p>{product.note}</p>
            </section>
          )}
          <section className="detail-content-grid detail-inline-grid">
            <article>
              <span className="detail-section-icon"><Icon name={product.kind === "course" ? "graduation" : product.kind === "mentoring" ? "users" : "document"} /></span>
              <h2>{copy.heading}</h2>
              <ul>{(product.outcomes?.length ? product.outcomes : copy.outcomes).map((item) => <li key={item}><i>✓</i><span>{item}</span></li>)}</ul>
            </article>
            <article>
              <span className="detail-section-icon"><Icon name="user" /></span>
              <h2>{needsRegistration(product) ? "Ai nên tham gia?" : "Ai nên sử dụng sản phẩm này?"}</h2>
              <ul>{(product.audience?.length ? product.audience : copy.audience).map((item) => <li key={item}><i>✓</i><span>{item}</span></li>)}</ul>
            </article>
          </section>
        </div>
      </section>
    </div>
  );
}

type User = { name: string; email: string; age?: string; location?: string; gender?: string; careerProfiles?: string[]; emailUpdates?: boolean; isNew?: boolean; profileComplete?: boolean };
type PurchaseStep = "auth" | "profile" | "register" | "checkout" | "pending" | null;
type ProfileDestination = "purchase" | "booking" | "zalo";
type SiteNotification = { id: string; title: string; body: string; link: string; createdAt: string; general?: boolean };
// "vừa xong", "5 phút trước", "3 giờ trước", "17/10"
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (!isFinite(diff)) return "";
  if (diff < 1) return "vừa xong";
  if (diff < 60) return `${Math.floor(diff)} phút trước`;
  if (diff < 24 * 60) return `${Math.floor(diff / 60)} giờ trước`;
  if (diff < 7 * 24 * 60) return `${Math.floor(diff / 1440)} ngày trước`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const vietnamLocations = [
  "An Giang", "Bắc Ninh", "Cà Mau", "Cao Bằng", "Cần Thơ", "Đà Nẵng", "Đắk Lắk", "Điện Biên",
  "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Nội", "Hà Tĩnh", "Hải Phòng", "Huế", "Hưng Yên",
  "Khánh Hòa", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Nghệ An", "Ninh Bình", "Phú Thọ",
  "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sơn La", "Tây Ninh", "Thái Nguyên", "Thanh Hóa",
  "TP. Hồ Chí Minh", "Tuyên Quang", "Vĩnh Long",
];

const careerProfileOptions = [
  "Sinh viên",
  "Người đi làm",
  "Người muốn chuyển lĩnh vực",
  "Người muốn chuyển hình thức làm việc",
];

function CareerProfileChoices({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const toggle = (item: string) => {
    onChange(value.includes(item) ? value.filter((choice) => choice !== item) : [...value, item]);
  };

  return (
    <fieldset className="career-profile-choices">
      <legend>Nghề nghiệp hiện tại hoặc định hướng <small>Có thể chọn nhiều</small></legend>
      <div>
        {careerProfileOptions.map((item) => (
          <button type="button" key={item} className={value.includes(item) ? "selected" : ""} onClick={() => toggle(item)}>
            <i>{value.includes(item) ? "✓" : ""}</i>{item}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function EmailUpdatesChoice({ value, onChange }: { value: "" | "yes" | "no"; onChange: (value: "yes" | "no") => void }) {
  return (
    <label>
      <span>Nhận email khi có ấn phẩm mới?</span>
      <select required value={value} onChange={(event) => onChange(event.target.value as "yes" | "no")}>
        <option value="" disabled>Chọn lựa chọn</option>
        <option value="yes">Có, mình muốn nhận</option>
        <option value="no">Không, cảm ơn</option>
      </select>
    </label>
  );
}


function AuthPage({ product, onBack, onAuthenticated }: { product?: Product; onBack: () => void; onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [gender, setGender] = useState("");
  const [careerProfiles, setCareerProfiles] = useState<string[]>([]);
  const [emailUpdates, setEmailUpdates] = useState<"" | "yes" | "no">("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "register" && password !== confirmPassword) {
      setFormError("Mật khẩu xác nhận chưa trùng khớp.");
      return;
    }
    if (mode === "register" && !gender) {
      setFormError("Vui lòng chọn giới tính.");
      return;
    }
    if (mode === "register" && careerProfiles.length === 0) {
      setFormError("Vui lòng chọn ít nhất một lựa chọn về nghề nghiệp.");
      return;
    }
    if (mode === "register" && !emailUpdates) {
      setFormError("Vui lòng chọn có hoặc không nhận email ấn phẩm mới.");
      return;
    }
    setFormError("");
    setAuthLoading(true);
    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const profile = {
          name: name || email.split("@")[0] || "Thành viên tiahere",
          email,
          age,
          location,
          gender,
          careerProfiles,
          emailUpdates: emailUpdates === "yes",
          profileComplete: true,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "users", credential.user.uid), profile);
        sendEmail({ type: "welcome", email, name: profile.name });
        onAuthenticated({ ...profile, isNew: true });
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const snap = await getDoc(doc(db, "users", credential.user.uid));
        if (snap.exists()) {
          onAuthenticated({ ...snap.data() as User, isNew: false });
        } else {
          onAuthenticated({ name: email.split("@")[0] || "Thành viên tiahere", email, isNew: false, profileComplete: true });
        }
      }
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setFormError("Email hoặc mật khẩu không đúng.");
      } else if (code === "auth/email-already-in-use") {
        setFormError("Email này đã được đăng ký. Vui lòng đăng nhập.");
      } else if (code === "auth/weak-password") {
        setFormError("Mật khẩu phải có ít nhất 6 ký tự.");
      } else {
        setFormError("Đã xảy ra lỗi. Vui lòng thử lại.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const snap = await getDoc(doc(db, "users", result.user.uid));
      if (snap.exists()) {
        onAuthenticated({ ...snap.data() as User, isNew: false });
      } else {
        const googleName = result.user.displayName || "Thành viên Google";
        const googleEmail = result.user.email || "";
        // Lưu doc ngay lập tức để tránh gửi email chào mừng lặp lại
        // nếu user đóng tab trước khi hoàn thiện profile
        const minimalProfile = {
          name: googleName,
          email: googleEmail,
          profileComplete: false,
          createdAt: new Date().toISOString(),
        };
        try {
          await setDoc(doc(db, "users", result.user.uid), minimalProfile);
        } catch {
          // bỏ qua lỗi lưu — vẫn gửi email và tiếp tục
        }
        sendEmail({ type: "welcome", email: googleEmail, name: googleName });
        onAuthenticated({ name: googleName, email: googleEmail, isNew: true, profileComplete: false });
      }
    } catch (error: unknown) {
      const code = (error as { code?: string }).code || "unknown";
      console.error("Đăng nhập Google thất bại:", error);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") setFormError("Bạn đã đóng cửa sổ đăng nhập Google. Bấm lại để thử nhé.");
      else if (code === "auth/popup-blocked") setFormError("Trình duyệt đang chặn cửa sổ đăng nhập. Bạn cho phép pop-up với trang này rồi thử lại nhé.");
      else setFormError(`Đăng nhập Google thất bại (mã lỗi: ${code}). Vui lòng thử lại.`);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="purchase-page auth-page">
      <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại sản phẩm</button>
      <div className="auth-layout">
        <section className="auth-intro">
          <span className="eyebrow">TIAHERE MEMBER</span>
          <h1>Một tài khoản,<br />mọi hành trình của bạn.</h1>
          <p>Đăng nhập để mua sản phẩm, theo dõi trạng thái xác thực và truy cập nội dung đã sở hữu ở bất cứ đâu.</p>
          {product ? (
            <div className="auth-product-preview">
              <img src={product.image} alt="" />
              <div><span>BẠN ĐANG MUA</span><strong>{product.title}</strong><small>{product.price}</small></div>
            </div>
          ) : (
            <div className="auth-benefits">
              <span><Icon name="heart" size={18} /> Lưu sản phẩm bạn quan tâm</span>
              <span><Icon name="document" size={18} /> Truy cập nội dung đã sở hữu</span>
              <span><Icon name="clock" size={18} /> Theo dõi trạng thái đơn hàng</span>
              <span><Icon name="users" size={18} /> Book lịch đồng hành 1:1 miễn phí</span>
            </div>
          )}
        </section>

        <section className="auth-form-card">
          <div className="auth-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Đăng nhập</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Đăng ký</button>
          </div>
          <div className="auth-heading">
            <h2>{mode === "login" ? "Chào bạn quay lại" : "Tạo tài khoản mới"}</h2>
            <p>{mode === "login" ? "Tiếp tục hành trình cùng tiahere." : "Chỉ mất một phút để bắt đầu."}</p>
          </div>
          <button className="google-auth" type="button" onClick={continueWithGoogle} disabled={authLoading}><i>G</i> Tiếp tục với Google</button>
          <div className="auth-divider"><span>hoặc sử dụng email</span></div>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label><span>Họ và tên</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên của bạn" /></label>
            )}
            <label><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@email.com" /></label>
            <label><span>Mật khẩu</span><div style={{position:"relative",display:"flex",alignItems:"center"}}><input required type={showPassword ? "text" : "password"} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 6 ký tự" style={{paddingRight:"52px",width:"100%"}} /><button type="button" onClick={() => setShowPassword(!showPassword)} style={{position:"absolute",right:"10px",background:"none",border:"none",cursor:"pointer",fontSize:"12px",color:"#a0845c",fontWeight:600,padding:"4px"}}>{showPassword ? "Ẩn" : "Hiện"}</button></div></label>
            {mode === "register" && (
              <>
                <label><span>Xác nhận mật khẩu</span><div style={{position:"relative",display:"flex",alignItems:"center"}}><input required type={showConfirm ? "text" : "password"} minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" style={{paddingRight:"52px",width:"100%"}} /><button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{position:"absolute",right:"10px",background:"none",border:"none",cursor:"pointer",fontSize:"12px",color:"#a0845c",fontWeight:600,padding:"4px"}}>{showConfirm ? "Ẩn" : "Hiện"}</button></div></label>
                <div className="auth-form-row">
                  <label>
                    <span>Độ tuổi</span>
                    <select required value={age} onChange={(event) => setAge(event.target.value)}>
                      <option value="" disabled>Chọn độ tuổi</option>
                      {["Dưới 18", "18–22", "23–27", "28–32", "33+"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Khu vực sống</span>
                    <select required value={location} onChange={(event) => setLocation(event.target.value)}>
                      <option value="" disabled>Chọn tỉnh/thành</option>
                      {vietnamLocations.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Giới tính</span>
                  <select required value={gender} onChange={(event) => setGender(event.target.value)}>
                    <option value="" disabled>Chọn giới tính</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Không chia sẻ">Không chia sẻ</option>
                  </select>
                </label>
                <CareerProfileChoices value={careerProfiles} onChange={setCareerProfiles} />
                <EmailUpdatesChoice value={emailUpdates} onChange={setEmailUpdates} />
              </>
            )}
            {formError && <p className="auth-error">{formError}</p>}
            {mode === "register" && <p style={{ margin: "0 0 10px" }}><LegalLinks prefix="Bằng việc tạo tài khoản, bạn đồng ý với " /></p>}
            <button className="auth-submit" type="submit" disabled={authLoading}>{authLoading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập & tiếp tục" : "Tạo tài khoản & tiếp tục"}<Icon name="arrow" size={17} /></button>
          </form>
          <p className="auth-terms">Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của tiahere.</p>
        </section>
      </div>
    </div>
  );
}

function CompleteGoogleProfilePage({ user, destination, onBack, onComplete }: { user: User; destination: ProfileDestination; onBack: () => void; onComplete: (user: User) => void }) {
  const [name, setName] = useState(user.name);
  const [age, setAge] = useState(user.age || "");
  const [location, setLocation] = useState(user.location || "");
  const [gender, setGender] = useState(user.gender || "");
  const [careerProfiles, setCareerProfiles] = useState<string[]>(user.careerProfiles || []);
  const [emailUpdates, setEmailUpdates] = useState<"" | "yes" | "no">(user.emailUpdates === undefined ? "" : user.emailUpdates ? "yes" : "no");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!gender) {
      setFormError("Vui lòng chọn giới tính.");
      return;
    }
    if (careerProfiles.length === 0) {
      setFormError("Vui lòng chọn ít nhất một lựa chọn về nghề nghiệp.");
      return;
    }
    if (!emailUpdates) {
      setFormError("Vui lòng chọn có hoặc không nhận email ấn phẩm mới.");
      return;
    }
    const completedUser = { ...user, name, age, location, gender, careerProfiles, emailUpdates: emailUpdates === "yes", profileComplete: true };
    setSaving(true);
    try {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        // Không gửi lại các trường quyền sở hữu / quan tâm (chỉ được đổi qua luồng riêng)
        const { ownedProducts: _o, favorites: _f, lastFav: _l, lastFreeClaim: _c, ...profileOnly } = completedUser as User & Record<string, unknown>;
        await setDoc(doc(db, "users", firebaseUser.uid), { ...profileOnly, updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch {
      // continue even if save fails
    } finally {
      setSaving(false);
    }
    onComplete(completedUser);
  };

  return (
    <div className="purchase-page profile-completion-page">
      <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại sản phẩm</button>
      <section className="profile-completion-card">
        <div className="completion-intro">
          <span className="completion-icon"><Icon name="user" size={27} /></span>
          <span className="eyebrow">HOÀN THIỆN HỒ SƠ</span>
          <h1>Hoàn thiện một chút<br />về bạn nhé.</h1>
          <p>Thông tin này giúp tiahere hỗ trợ đơn hàng và gợi ý nội dung phù hợp hơn. Bạn chỉ cần điền một lần.</p>
          <div className="google-account"><i>G</i><div><span>TÀI KHOẢN GOOGLE</span><strong>{user.email}</strong></div></div>
        </div>
        <form className="completion-form" onSubmit={submit}>
          <div><span className="eyebrow">THÔNG TIN CÁ NHÂN</span><h2>Cho tiahere biết thêm về bạn</h2></div>
          <label><span>Họ và tên</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span>Email</span><input value={user.email} disabled /></label>
          <div className="auth-form-row">
            <label>
              <span>Độ tuổi</span>
              <select required value={age} onChange={(event) => setAge(event.target.value)}>
                <option value="" disabled>Chọn độ tuổi</option>
                {["Dưới 18", "18–22", "23–27", "28–32", "33+"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Khu vực sống</span>
              <select required value={location} onChange={(event) => setLocation(event.target.value)}>
                <option value="" disabled>Chọn tỉnh/thành</option>
                {vietnamLocations.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Giới tính</span>
            <select required value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="" disabled>Chọn giới tính</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Không chia sẻ">Không chia sẻ</option>
            </select>
          </label>
          <CareerProfileChoices value={careerProfiles} onChange={setCareerProfiles} />
          <EmailUpdatesChoice value={emailUpdates} onChange={setEmailUpdates} />
          {formError && <p className="auth-error">{formError}</p>}
          <button type="submit" disabled={saving}>{saving ? "Đang lưu..." : `Lưu và tiếp tục ${destination === "purchase" ? "thanh toán" : destination === "booking" ? "đặt lịch" : "đến Zalo"}`} <Icon name="arrow" size={17} /></button>
          <p>Thông tin của bạn được bảo mật và chỉ sử dụng để phục vụ trải nghiệm tại tiahere.</p>
        </form>
      </section>
    </div>
  );
}
// ── Link riêng cho từng trang (dạng tiahere.com/#...) ──
const NAV_HASH: Record<string, string> = {
  "Trang chủ": "", "Tài liệu": "#tai-lieu", "Công cụ": "#cong-cu", "Khoá học": "#khoa-hoc", "Sự kiện": "#su-kien",
  "Bài viết": "#bai-viet", "Đồng hành 1:1": "#dong-hanh", "Trang cá nhân": "#trang-ca-nhan", "Đặt lịch miễn phí": "#dat-lich",
};
const HASH_NAV: Record<string, string> = Object.fromEntries(Object.entries(NAV_HASH).map(([k, v]) => [v, k]));
const currentHash = () => { try { return decodeURIComponent(window.location.hash); } catch { return window.location.hash; } };
const productLink = (id: string) => `${window.location.origin}${window.location.pathname}#san-pham=${id}`;

// ── Điều khoản sử dụng & Chính sách bảo mật (nội dung do admin soạn trong Admin) ──
const LEGAL_PAGES = {
  terms: { hash: "#dieu-khoan-su-dung", title: "Điều khoản sử dụng", field: "terms" },
  privacy: { hash: "#chinh-sach-bao-mat", title: "Chính sách bảo mật", field: "privacy" },
} as const;
type LegalKey = keyof typeof LEGAL_PAGES;
const legalFromHash = (hash: string): LegalKey | null => (hash === LEGAL_PAGES.terms.hash ? "terms" : hash === LEGAL_PAGES.privacy.hash ? "privacy" : null);
function LegalLinks({ prefix }: { prefix?: string }) {
  return <small className="legal-links">{prefix}<a href={LEGAL_PAGES.terms.hash}>Điều khoản sử dụng</a> và <a href={LEGAL_PAGES.privacy.hash}>Chính sách bảo mật</a>{prefix ? "." : ""}</small>;
}
// Định dạng đơn giản: dòng bắt đầu "# " là tiêu đề lớn, "## " tiêu đề nhỏ, "- " là gạch đầu dòng
function SimpleText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={`u${blocks.length}`}>{list.map((t, i) => <li key={i}>{t}</li>)}</ul>); list = []; } };
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (line.startsWith("- ")) { list.push(line.slice(2)); return; }
    flush();
    if (!line) return;
    if (line.startsWith("## ")) blocks.push(<h3 key={blocks.length}>{line.slice(3)}</h3>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={blocks.length}>{line.slice(2)}</h2>);
    else blocks.push(<p key={blocks.length}>{line}</p>);
  });
  flush();
  return <>{blocks}</>;
}
function LegalPage({ page, onBack }: { page: LegalKey; onBack: () => void }) {
  const [data, setData] = useState<{ text: string; updatedAt: string } | null>(null);
  useEffect(() => {
    setData(null);
    getDoc(doc(db, "settings", "legal"))
      .then((snap) => {
        const d = snap.exists() ? snap.data() : {};
        setData({ text: String(d[LEGAL_PAGES[page].field] || ""), updatedAt: String(d.updatedAt || "") });
      })
      .catch(() => setData({ text: "", updatedAt: "" }));
  }, [page]);
  return (
    <div className="product-detail-page legal-page">
      <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại</button>
      <header className="checkout-header">
        <span className="eyebrow">TIAHERE</span>
        <h1>{LEGAL_PAGES[page].title}</h1>
        {data?.updatedAt && <p>Cập nhật lần cuối: {formatDateVN(data.updatedAt.slice(0, 10))}</p>}
      </header>
      <section className="detail-content-text legal-text">
        {!data ? <p style={{ opacity: 0.7 }}>Đang tải...</p> : data.text ? <SimpleText text={data.text} /> : <p style={{ opacity: 0.7 }}>Nội dung đang được cập nhật.</p>}
      </section>
      <p style={{ marginTop: 16 }}><a href={page === "terms" ? LEGAL_PAGES.privacy.hash : LEGAL_PAGES.terms.hash}>Xem {page === "terms" ? "Chính sách bảo mật" : "Điều khoản sử dụng"} →</a></p>
    </div>
  );
}

// Form đăng ký sự kiện / khoá học tự tổ chức (điền trước khi thanh toán hoặc xác nhận)
type RegAnswers = Record<string, string | boolean>;
function RegistrationPage({ product, user, onBack, onSubmit }: { product: Product; user: User; onBack: () => void; onSubmit: (answers: RegAnswers) => void }) {
  const isEvent = product.kind === "event";
  const refund = product.courseMode === "refund";
  const [a, setA] = useState<RegAnswers>({ phone: "" });
  const [error, setError] = useState("");
  const set = (k: string, v: string | boolean) => setA((x) => ({ ...x, [k]: v }));
  const val = (k: string) => String(a[k] ?? "");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const required = isEvent ? ["phone", "expect"] : ["phone", "wishBefore", "wishAfter", "reason", ...(refund ? ["bankName", "bankNumber", "bankHolder"] : [])];
    if (required.some((k) => !val(k).trim())) { setError("Bạn điền đủ các ô có dấu * giúp Tia nhé."); return; }
    if (!isEvent && !a.commit) { setError("Bạn cần tick vào ô cam kết để đăng ký khoá học."); return; }
    const clean: RegAnswers = {};
    Object.entries(a).forEach(([k, v]) => { clean[k] = typeof v === "string" ? v.trim().slice(0, 2000) : v; });
    onSubmit(clean);
  };
  const field = (k: string, label: string, opts: { area?: boolean; required?: boolean; placeholder?: string } = {}) => (
    <label key={k}>
      <span>{label}{opts.required !== false && " *"}</span>
      {opts.area
        ? <textarea rows={3} value={val(k)} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} />
        : <input value={val(k)} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} />}
    </label>
  );
  return (
    <div className="purchase-page">
      <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại</button>
      <header className="checkout-header">
        <span className="eyebrow">{isEvent ? "ĐĂNG KÝ SỰ KIỆN" : "ĐĂNG KÝ KHOÁ HỌC"}</span>
        <h1>{product.title}</h1>
        <p>{isEvent ? eventWhen(product) : "Điền vài thông tin để Tia hiểu bạn hơn trước khi vào lớp."}</p>
      </header>
      <form className="reg-form" onSubmit={submit}>
        <div className="reg-box">
          <p style={{ margin: "0 0 12px" }}><strong>{user.name}</strong> · {user.email}</p>
          {field("phone", "Số điện thoại", { placeholder: "09..." })}
        </div>
        {isEvent ? <>
          {field("expect", "Điều bạn mong đợi khi tham gia sự kiện", { area: true })}
          {field("question", "Câu hỏi bạn muốn Tia trả lời trong sự kiện", { area: true, required: false, placeholder: "Không bắt buộc" })}
        </> : <>
          {field("wishBefore", "Bạn đang ở đâu / gặp khó khăn gì trước khoá học?", { area: true })}
          {field("wishAfter", "Bạn mong muốn đạt được gì sau khoá học?", { area: true })}
          {field("reason", "Lý do bạn muốn đăng ký khoá học này", { area: true })}
          {refund && (
            <div className="reg-box">
              <p style={{ margin: "0 0 12px" }}><strong>Tài khoản nhận hoàn học phí</strong><br /><small>Khoá học được hoàn 100% học phí khi bạn hoàn thành yêu cầu. Tia sẽ chuyển khoản vào tài khoản này sau khoá học.</small></p>
              {field("bankName", "Ngân hàng", { placeholder: "Ví dụ: Vietcombank" })}
              {field("bankNumber", "Số tài khoản")}
              {field("bankHolder", "Tên chủ tài khoản")}
            </div>
          )}
          <label className="reg-check">
            <input type="checkbox" checked={!!a.commit} onChange={(e) => set("commit", e.target.checked)} />
            <span style={{ fontWeight: 400 }}>Tôi cam kết tham gia đủ các buổi học và hoàn thành bài tập của khoá học{refund ? " trong thời gian quy định" : ""}. *</span>
          </label>
        </>}
        {error && <p className="reg-error">{error}</p>}
        <p style={{ margin: "0 0 14px" }}><LegalLinks prefix="Bằng việc đăng ký, bạn đồng ý với " /></p>
        <div className="reg-actions">
          <button type="button" onClick={onBack}>Quay lại</button>
          <button type="submit" className="primary">{isFreeProduct(product) ? "Xác nhận đăng ký" : "Tiếp tục thanh toán"} →</button>
        </div>
      </form>
    </div>
  );
}

// Trang thông tin tham gia (người đã đăng ký thành công). Link tham gia và tài liệu được gửi qua email.
function ParticipantPage({ product, onBack }: { product: Product; onBack: () => void }) {
  const isEvent = product.kind === "event";
  return (
    <div className="product-detail-page">
      <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại</button>
      <header className="checkout-header">
        <span className="eyebrow">{isEvent ? "BẠN ĐÃ ĐĂNG KÝ SỰ KIỆN" : "BẠN ĐÃ ĐĂNG KÝ KHOÁ HỌC"}</span>
        <h1>{product.title}</h1>
      </header>
      <EventInfo product={product} />
      <p>Link tham gia sẽ được Tia gửi qua email đăng ký của bạn 1 ngày trước {isEvent ? "sự kiện" : "buổi học"}. Bạn nhớ kiểm tra cả hộp thư Spam/Quảng cáo nhé.</p>
      {product.note && <section className="detail-content-text"><h2>Lưu ý cho người tham gia</h2><p>{product.note}</p></section>}
    </div>
  );
}

function CheckoutPage({ product, user, extra, onBack, onComplete }: { product: Product; user: User; extra?: Record<string, unknown> | null; onBack: () => void; onComplete: (order: OrderRecord) => void }) {
  const refundBank = product.courseMode === "refund";
  const [copied, setCopied] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [orderCode] = useState(generateOrderCode);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const copy = copyFor(product);
  const transferContent = orderCode;
  const paymentAmount = product.price.replace(/\D/g, "");

  const placeOrder = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setPlaceError("Phiên đăng nhập đã hết. Bạn đăng nhập lại rồi thử nhé.");
      return;
    }
    setPlacing(true);
    setPlaceError("");
    const order = {
      code: orderCode,
      uid,
      email: user.email,
      name: user.name,
      productId: product.id,
      productTitle: product.title,
      productKind: product.kind,
      priceLabel: product.price,
      amount: Number(paymentAmount) || 0,
      status: "Chờ xác nhận",
      createdAt: new Date().toISOString(),
      ...(extra ? { registration: extra } : {}),
    };
    try {
      await setDoc(doc(db, "orders", orderCode), order);
      onComplete({ code: order.code, productId: order.productId, productTitle: order.productTitle, priceLabel: order.priceLabel, amount: order.amount, status: order.status, createdAt: order.createdAt });
    } catch (err) {
      const code = (err as { code?: string }).code || "unknown";
      console.error("Lưu đơn hàng thất bại:", err);
      setPlaceError(`Chưa ghi nhận được đơn hàng (mã lỗi: ${code}). Kiểm tra mạng rồi bấm lại, hoặc nhắn Zalo cho Tia kèm mã đơn.`);
    } finally {
      setPlacing(false);
    }
  };
  const qrUrl = refundBank
    ? `https://img.vietqr.io/image/${REFUND_BANK.bin}-${REFUND_BANK.number}-compact2.png?amount=${paymentAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(REFUND_BANK.qrName)}`
    : `https://img.vietqr.io/image/MB-355308888-compact2.png?amount=${paymentAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=HO%20KINH%20DOANH%20TRANG%20NGUYEN`;

  const copyAccountNumber = () => {
    navigator.clipboard?.writeText(refundBank ? REFUND_BANK.number : "355308888");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copyTransferContent = () => {
    navigator.clipboard?.writeText(transferContent);
    setCopiedContent(true);
    window.setTimeout(() => setCopiedContent(false), 1800);
  };

  return (
    <div className="purchase-page checkout-page">
      <button className="detail-back" onClick={onBack}><Icon name="arrow" size={16} /> Quay lại sản phẩm</button>
      <header className="checkout-header">
        <span className="eyebrow">THANH TOÁN AN TOÀN</span>
        <h1>Hoàn tất đơn hàng</h1>
        <p>Kiểm tra thông tin trước khi xác nhận {copy.buy.toLowerCase()}.</p>
      </header>
      <div className="checkout-layout">
        <section className="checkout-form">
          <div className="checkout-section-heading"><span>01</span><div><h2>Thông tin người mua</h2><p>Quyền truy cập sẽ được gửi tới tài khoản này.</p></div></div>
          <div className="buyer-card">
            <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <div><strong>{user.name}</strong><small>{user.email}</small></div>
            <button>Thay đổi</button>
          </div>

          <div className="checkout-section-heading"><span>02</span><div><h2>Chuyển khoản ngân hàng</h2><p>Quét mã QR hoặc nhập thông tin bên dưới.</p></div></div>
          <div className="bank-transfer-card">
            <div className="bank-qr">
              <img src={qrUrl} alt="Mã QR chuyển khoản ngân hàng" />
              <span>Quét bằng ứng dụng ngân hàng</span>
            </div>
            <div className="bank-details">
              <div><span>Ngân hàng</span><strong>{refundBank ? REFUND_BANK.bank : "MB Bank"}</strong></div>
              <div><span>Chủ tài khoản</span><strong>{refundBank ? REFUND_BANK.holder : "Hộ kinh doanh Trang Nguyen"}</strong></div>
              <div className="account-number"><span>Số tài khoản</span><strong>{refundBank ? REFUND_BANK.display : "355308888"}</strong><button onClick={copyAccountNumber}>{copied ? "Đã sao chép" : "Sao chép"}</button></div>
              <div className="transfer-content"><span>Nội dung chuyển khoản (mã đơn)</span><strong>{transferContent}</strong><button onClick={copyTransferContent}>{copiedContent ? "Đã sao chép" : "Sao chép"}</button></div>
              <div><span>Lưu ý</span><strong style={{ fontWeight: 500 }}>Ghi đúng mã đơn để Tia đối soát nhanh</strong></div>
            </div>
          </div>
          <div className="payment-notice">
            <Icon name="clock" size={19} />
            <div>
              <strong>Xác nhận thanh toán sau 4–6 tiếng</strong>
              <p>Nếu bạn muốn xác nhận nhanh, vui lòng inbox Zalo <button onClick={() => window.open("https://zalo.me/0362864028", "_blank")}>03 6286 4028 (Tia Nguyễn)</button>.</p>
            </div>
          </div>
        </section>

        <aside className="order-summary">
          <h2>Đơn hàng của bạn</h2>
          <div className="order-product"><img src={product.image} alt="" /><div><span>{product.category.toUpperCase()}</span><strong>{product.title}</strong></div></div>
          <div className="order-lines"><p><span>Tạm tính</span><strong>{product.price}</strong></p><p><span>Phí xử lý</span><strong>0đ</strong></p></div>
          <div className="order-total"><span>Tổng thanh toán</span><strong>{product.price}</strong></div>
          {placeError && <p style={{ color: "#c00", margin: "0 0 10px", fontSize: "0.9em" }}>{placeError}</p>}
          <button onClick={placeOrder} disabled={placing}>{placing ? "Đang ghi nhận..." : "Tôi đã chuyển khoản"} <Icon name="arrow" size={17} /></button>
          <small><Icon name="clock" size={14} /> Quyền truy cập được mở sau khi admin xác nhận đã nhận thanh toán.</small>
          <LegalLinks prefix="Bằng việc thanh toán, bạn đồng ý với " />
        </aside>
      </div>
    </div>
  );
}

function PurchasePendingPage({ product, orderCode, onDone }: { product: Product; orderCode: string; onDone: () => void }) {
  return (
    <div className="purchase-pending">
      <span className="pending-icon"><Icon name="clock" size={32} /></span>
      <span className="eyebrow">ĐÃ GHI NHẬN ĐƠN HÀNG</span>
      <h1>Cảm ơn bạn đã lựa chọn<br />{product.title}</h1>
      <p>Thanh toán của bạn đang chờ admin xác thực. Tiahere sẽ gửi email ngay khi quyền truy cập được mở.</p>
      <p style={{ fontSize: "0.9em", opacity: 0.8 }}>Không thấy email? Bạn kiểm tra giúp mục <strong>Spam</strong> hoặc <strong>Quảng cáo</strong> trong hộp thư, và bấm "Không phải thư rác" để lần sau nhận đúng chỗ nhé.</p>
      <div className="pending-order"><span>Mã đơn hàng</span><strong>{orderCode}</strong><i /><span>Tổng thanh toán</span><strong>{product.price}</strong></div>
      <button onClick={onDone}>Về trang Tài liệu <Icon name="arrow" size={17} /></button>
    </div>
  );
}

type MemberTab = "products" | "favorites" | "meetings" | "orders" | "profile";

function ProfilePage({ user, ownedProducts, favoriteProducts = [], orders, bookings, initialTab, onOpenProduct, onUpdateUser, onSignOut, onBookNew }: { user: User; ownedProducts: Product[]; favoriteProducts?: Product[]; orders: OrderRecord[]; bookings: BookingRecord[]; initialTab: MemberTab; onOpenProduct: (product: Product) => void; onUpdateUser: (user: User) => void; onSignOut: () => void; onBookNew: () => void }) {
  const pendingCount = orders.filter((order) => order.status === "Chờ xác nhận").length;
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 10, flexWrap: "wrap" };
  const [tab, setTab] = useState<MemberTab>(initialTab);
  const [profileCareerProfiles, setProfileCareerProfiles] = useState<string[]>(user.careerProfiles || []);

  return (
    <div className="member-page">
      <section className="member-hero">
        <div className="member-pattern" />
        <div className="member-profile">
          <div className="member-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <span className="eyebrow">THÀNH VIÊN TIAHERE</span>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
          </div>
        </div>
        <button onClick={() => setTab("profile")}><Icon name="user" size={17} /> Chỉnh sửa hồ sơ</button>
      </section>

      <section className="member-stats">
        <article><span className="stat-icon"><Icon name="document" /></span><div><strong>{String(ownedProducts.length).padStart(2, "0")}</strong><p>Sản phẩm đã sở hữu</p></div></article>
        <article><span className="stat-icon"><Icon name="clock" /></span><div><strong>{String(pendingCount).padStart(2, "0")}</strong><p>Đơn chờ xác thực</p></div></article>
        <article><span className="stat-icon"><Icon name="heart" /></span><div><strong>{String(favoriteProducts.length).padStart(2, "0")}</strong><p>Sản phẩm quan tâm</p></div></article>
      </section>

      <nav className="member-tabs" aria-label="Nội dung tài khoản">
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Sản phẩm của tôi</button>
        <button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>Quan tâm</button>
        <button className={tab === "meetings" ? "active" : ""} onClick={() => setTab("meetings")}>Lịch call</button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Đơn hàng</button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>Thông tin cá nhân</button>
      </nav>

      {tab === "products" && (
        <section className="owned-products">
          {ownedProducts.length === 0 ? (
            <div className="empty-state">
              <span><Icon name="document" size={32} /></span>
              <p>Bạn chưa sở hữu sản phẩm nào.<br />Khám phá tài liệu, công cụ và khoá học của tiahere.</p>
            </div>
          ) : ownedProducts.map((product) => (
            <article key={product.title} onClick={() => onOpenProduct({ ...product, verified: true })}>
              <div className="owned-product-image"><img src={product.image} alt="" /><span>Đã sở hữu</span></div>
              <div className="owned-product-copy">
                <span>{product.category.toUpperCase()}</span>
                <h2>{product.title}</h2>
                <p>Quyền truy cập không giới hạn</p>
                <button>{copyFor(product).access}<Icon name="arrow" size={16} /></button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "favorites" && (
        <section className="favorite-section">
          <header><div><span className="eyebrow">ĐÃ LƯU CHO BẠN</span><h2>Sản phẩm quan tâm</h2></div><span>{favoriteProducts.length} sản phẩm</span></header>
          {favoriteProducts.length === 0 ? (
          <div className="empty-state">
            <span><Icon name="heart" size={32} /></span>
            <p>Bạn chưa lưu sản phẩm nào.<br />Bấm vào biểu tượng ♡ để lưu sản phẩm bạn quan tâm.</p>
          </div>
          ) : (
          <div className="owned-products">
            {favoriteProducts.map((product) => (
              <article key={product.id} onClick={() => onOpenProduct(product)}>
                <div className="owned-product-image"><img src={product.imageCard || product.image} alt="" /></div>
                <div className="owned-product-copy">
                  <span>{product.category.toUpperCase()}</span>
                  <h2>{product.title}</h2>
                  <PriceTag product={product} />
                  <button>Xem sản phẩm<Icon name="arrow" size={16} /></button>
                </div>
              </article>
            ))}
          </div>
          )}
        </section>
      )}

      {tab === "meetings" && (
        <section className="meeting-section">
          <header><div><span className="eyebrow">ĐỒNG HÀNH 1:1</span><h2>Lịch call meeting</h2><p>Các buổi trò chuyện và đồng hành đã đặt lịch.</p></div><button onClick={onBookNew}><Icon name="users" size={17} /> Đặt lịch mới</button></header>
          {bookings.length === 0 ? (
            <div className="empty-state">
              <span><Icon name="users" size={32} /></span>
              <p>Bạn chưa có lịch call nào.<br />Đặt lịch đồng hành 1:1 miễn phí để bắt đầu.</p>
            </div>
          ) : (
            <div>
              {bookings.map((booking) => (
                <article key={booking.id} style={rowStyle}>
                  <div>
                    <strong style={{ display: "block" }}>{formatDateVN(booking.date, true)} · {booking.time}</strong>
                    <small style={{ opacity: 0.75 }}>{booking.issue}</small>
                    {booking.meetUrl && booking.status === "Đã xác nhận" && <div style={{ marginTop: 6 }}><a href={booking.meetUrl} target="_blank" rel="noopener noreferrer">Vào Google Meet</a></div>}
                    {booking.userNote && <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer" }}>Ghi chú sau buổi call từ Tia</summary><p style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{booking.userNote}</p></details>}
                  </div>
                  <span style={{ color: statusTone(booking.status), fontWeight: 600 }}>{booking.status}</span>
                </article>
              ))}
            </div>
          )}
          <div className="meeting-note"><Icon name="message" /><p>Link tham gia sẽ được gửi qua email và hiển thị tại đây trước giờ call 15 phút.</p></div>
        </section>
      )}

      {tab === "orders" && (
        <section className="member-orders">
          <header><div><span className="eyebrow">LỊCH SỬ MUA HÀNG</span><h2>Đơn hàng gần đây</h2></div><span>{orders.length} đơn hàng</span></header>
          {orders.length === 0 ? (
            <div className="empty-state">
              <span><Icon name="clipboard" size={32} /></span>
              <p>Bạn chưa có đơn hàng nào.<br />Sau khi mua sản phẩm, đơn hàng sẽ hiện ở đây.</p>
            </div>
          ) : (
            <div>
              {orders.map((order) => (
                <article key={order.code} style={rowStyle}>
                  <div>
                    <strong style={{ display: "block" }}>{order.productTitle}</strong>
                    <small style={{ opacity: 0.75 }}>Mã đơn {order.code} · {formatDateVN(order.createdAt)} · {order.priceLabel}</small>
                  </div>
                  <span style={{ color: statusTone(order.status), fontWeight: 600 }}>{order.status}</span>
                </article>
              ))}
            </div>
          )}
          <div className="order-help"><Icon name="message" /><p>Cần hỗ trợ? Inbox Zalo <button onClick={() => window.open("https://zalo.me/0362864028", "_blank")}>03 6286 4028 (Tia Nguyễn)</button></p></div>
        </section>
      )}

      {tab === "profile" && (
        <section className="profile-information">
          <header><span className="eyebrow">THÔNG TIN TÀI KHOẢN</span><h2>Thông tin cá nhân</h2><p>Thông tin này giúp tiahere mang tới nội dung phù hợp hơn với bạn.</p></header>
          <div className="profile-fields">
            <label><span>Họ và tên</span><input defaultValue={user.name} /></label>
            <label><span>Email</span><input value={user.email} disabled /></label>
            <label><span>Độ tuổi</span><input defaultValue={user.age || "Chưa cập nhật"} /></label>
            <label><span>Khu vực sống</span><input defaultValue={user.location || "Chưa cập nhật"} /></label>
          </div>
          <div className="profile-career-section">
            <CareerProfileChoices value={profileCareerProfiles} onChange={setProfileCareerProfiles} />
          </div>
          <div className="profile-actions"><button onClick={() => onUpdateUser({ ...user, careerProfiles: profileCareerProfiles })}>Lưu thay đổi</button><button className="sign-out" onClick={onSignOut}>Đăng xuất</button></div>
        </section>
      )}
    </div>
  );
}

const ADMIN_EMAIL = "tianguyen.t88@gmail.com";

export default function App() {
  const [adminMode, setAdminMode] = useState(window.location.hash.startsWith("#admin"));
  const [activeNav, setActiveNav] = useState("Trang chủ");
  const [category, setCategory] = useState("Khám phá");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>(null);
  const [ownedProductIds, setOwnedProductIds] = useState<string[]>([]);
  const [authUid, setAuthUid] = useState("");
  const [myOrders, setMyOrders] = useState<OrderRecord[]>([]);
  const [myBookings, setMyBookings] = useState<BookingRecord[]>([]);
  const [lastOrderCode, setLastOrderCode] = useState("");
  const [profileTab, setProfileTab] = useState<MemberTab>("products");
  const [authDestination, setAuthDestination] = useState<"booking" | "zalo" | null>(null);
  const [readerProduct, setReaderProduct] = useState<Product | null>(null);
  const [toolProduct, setToolProduct] = useState<Product | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [siteNotifications, setSiteNotifications] = useState<SiteNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifReadAt, setNotifReadAt] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [favs, setFavs] = useState<string[]>([]); // sản phẩm user đã bấm quan tâm
  const [favDelta, setFavDelta] = useState<Record<string, number>>({}); // thay đổi số quan tâm trong phiên này
  const [claiming, setClaiming] = useState(false);
  const [regAnswers, setRegAnswers] = useState<RegAnswers | null>(null); // câu trả lời form đăng ký sự kiện/khoá học
  const [participantProduct, setParticipantProduct] = useState<Product | null>(null);
  const [legalPage, setLegalPage] = useState<LegalKey | null>(() => legalFromHash(window.location.hash));

  // Tải bài viết đã xuất bản từ Firestore (bài có ngày xuất bản trong tương lai sẽ tự hiện khi tới ngày)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    getDocs(fsQuery(collection(db, "articles"), where("status", "==", "Đã xuất bản")))
      .then((snapshot) => {
        const list: Article[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || "",
              category: data.category || "Sự nghiệp",
              readTime: `${data.readTime || 1} phút đọc`,
              // Lượt đọc hiển thị = lượt đọc thật + X (admin tự điền)
              views: data.showViews !== false && (Number(data.views) || 0) + (Number(data.bonusViews) || 0) ? new Intl.NumberFormat("vi-VN").format((Number(data.views) || 0) + (Number(data.bonusViews) || 0)) : "",
              image: optimizeImage(data.image || "", 1600),
              excerpt: data.excerpt || "",
              content: data.content || "",
              publishedAt: data.publishedAt || "",
            };
          })
          .filter((article) => !article.publishedAt || article.publishedAt <= today)
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        setArticles(list);
      })
      .catch(() => { /* chưa có bài viết hoặc Rules chặn — giữ danh sách rỗng */ });
  }, []);
  const documentProducts = allProducts.filter((p) => p.kind === "document");
  const toolProducts = allProducts.filter((p) => p.kind === "tool");
  const courseProducts = allProducts.filter((p) => p.kind === "course");
  // Trang chủ: ẩn sự kiện đã diễn ra. Mục Khám phá ưu tiên sản phẩm admin tick "Khám phá (trang chủ)";
  // nếu chưa tick sản phẩm nào thì lấy các sản phẩm đầu danh sách như trước.
  const homeProducts = allProducts.filter((p) => !isPastEvent(p));
  const pickedForHome = homeProducts.filter((p) => p.tabs.includes("Khám phá"));
  const homeShowcase = pickedForHome.length ? pickedForHome : homeProducts;
  // Sự kiện: sắp diễn ra (gần nhất trước), sau đó là sự kiện đã qua
  const eventProducts = allProducts.filter((p) => p.kind === "event").sort((a, b) => {
    const pa = isPastEvent(a), pb = isPastEvent(b);
    if (pa !== pb) return pa ? 1 : -1;
    return pa ? (b.eventDate || "").localeCompare(a.eventDate || "") : (a.eventDate || "9").localeCompare(b.eventDate || "9");
  });

  // Load products từ Firestore
  useEffect(() => {
    getDocs(collection(db, "products"))
      .then((snapshot) => {
        const loaded: Product[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            // Chỉ hiển thị sản phẩm đang bán
            if (data.status !== "Đang bán") return null;
            // Combo quá hạn bán thì tự ẩn
            if (data.saleEnd && String(data.saleEnd) < todayISO()) return null;
            return {
              id: d.id,
              title: data.title || data.name || "",
              kind: (data.kind || "document") as Product["kind"],
              category: data.category || "Sự nghiệp",
              description: data.description || "",
              price: data.price || "0đ",
              image: optimizeImage(data.image) || "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80",
              imageCard: optimizeImage(data.imageCard || "", 1100),
              tabs: Array.isArray(data.tabs) ? data.tabs : ["Mới nhất"],
              badge: data.badge || "",
              verified: data.verified || false,
              externalUrl: data.externalUrl || "",
              ebookUrl: data.ebookUrl || "",
              toolKey: data.toolKey || "",
              buyers: Number(data.buyers) || 0,
              bonusBuyers: Number(data.bonusBuyers) || 0,
              showBuyers: data.showBuyers !== false,
              interested: Number(data.interested) || 0,
              bonusInterest: Number(data.bonusInterest) || 0,
              showInterest: data.showInterest !== false,
              originalPrice: data.originalPrice || "",
              courseMode: data.courseMode || "external",
              contentText: data.contentText || "",
              eventDate: data.eventDate || "",
              eventTime: data.eventTime || "",
              eventEndTime: data.eventEndTime || "",
              eventFormat: data.eventFormat || "online",
              location: data.location || "",
              startDate: data.startDate || "",
              schedule: data.schedule || "",
              note: data.note || "",
              comboItems: Array.isArray(data.comboItems) ? data.comboItems : [],
              saleEnd: data.saleEnd || "",
              outcomes: Array.isArray(data.outcomes) ? data.outcomes : [],
              audience: Array.isArray(data.audience) ? data.audience : [],
            } as Product;
          })
          .filter(Boolean) as Product[];
        setAllProducts(loaded);
      })
      .catch(() => { /* Firestore chưa có data — giữ array rỗng */ });
  }, []);

  useEffect(() => {
    const syncAdminMode = () => {
      setAdminMode(window.location.hash.startsWith("#admin"));
      const legal = legalFromHash(window.location.hash);
      setLegalPage(legal);
      if (legal) { setMobileOpen(false); window.scrollTo(0, 0); }
    };
    window.addEventListener("hashchange", syncAdminMode);
    return () => window.removeEventListener("hashchange", syncAdminMode);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthUid(firebaseUser ? firebaseUser.uid : "");
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        // Đơn hàng và lịch call của chính user (không chặn việc hiển thị trang)
        getDocs(fsQuery(collection(db, "orders"), where("uid", "==", firebaseUser.uid)))
          .then((result) => setMyOrders(result.docs
            .map((d) => d.data() as OrderRecord)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
          .catch(() => setMyOrders([]));
        getDocs(fsQuery(collection(db, "bookings"), where("uid", "==", firebaseUser.uid)))
          .then((result) => setMyBookings(result.docs
            .map((d) => ({ ...(d.data() as BookingRecord), id: d.id }))
            .sort((a, b) => b.date.localeCompare(a.date))))
          .catch(() => setMyBookings([]));
        if (snap.exists()) {
          const data = snap.data();
          setOwnedProductIds(Array.isArray(data.ownedProducts) ? data.ownedProducts : []);
          setFavs(Array.isArray(data.favorites) ? data.favorites : []);
          setUser(data as User);
        } else {
          setUser({
            name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Thành viên tiahere",
            email: firebaseUser.email || "",
            profileComplete: false,
          });
        }
      } else {
        setUser(null);
        setOwnedProductIds([]);
        setFavs([]);
        setMyOrders([]);
        setMyBookings([]);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Tự cập nhật khi admin xác nhận đơn / lịch: quyền sở hữu, đơn hàng, lịch call thay đổi là trang đổi ngay, không cần tải lại
  useEffect(() => {
    if (!authUid) return;
    const unsubs = [
      onSnapshot(doc(db, "users", authUid), (snap) => {
        const data = snap.data();
        if (data && Array.isArray(data.ownedProducts)) setOwnedProductIds(data.ownedProducts);
      }, () => {}),
      onSnapshot(fsQuery(collection(db, "orders"), where("uid", "==", authUid)), (result) => {
        setMyOrders(result.docs.map((d) => d.data() as OrderRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      }, () => {}),
      onSnapshot(fsQuery(collection(db, "bookings"), where("uid", "==", authUid)), (result) => {
        setMyBookings(result.docs.map((d) => ({ ...(d.data() as BookingRecord), id: d.id })).sort((a, b) => b.date.localeCompare(a.date)));
      }, () => {}),
    ];
    return () => unsubs.forEach((u) => u());
  }, [authUid]);

  // Sản phẩm miễn phí: tới bước thanh toán thì mở quyền ngay, không cần chờ admin xác nhận
  useEffect(() => {
    if (purchaseStep !== "checkout" || !selectedProduct || !user || !isFreeProduct(selectedProduct) || claiming) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const product = selectedProduct;
    setClaiming(true);
    const now = new Date().toISOString();
    const code = `FREE${Date.now().toString(36).toUpperCase()}`;
    const batch = writeBatch(db);
    batch.set(doc(db, "orders", code), {
      code, uid, email: user.email, name: user.name, productId: product.id, productTitle: product.title, productKind: product.kind,
      priceLabel: "Miễn phí", amount: 0, status: "Đã xác nhận", source: "free", countedBuyer: true, createdAt: now, confirmedAt: now,
      ...(regAnswers ? { registration: regAnswers } : {}),
    });
    batch.update(doc(db, "users", uid), { ownedProducts: arrayUnion(product.id), lastFreeClaim: product.id });
    batch.update(doc(db, "products", product.id), { buyers: increment(1) });
    batch.commit()
      .then(() => {
        setOwnedProductIds((ids) => [...ids, product.id]);
        setMyOrders((items) => [{ code, productId: product.id, productTitle: product.title, priceLabel: "Miễn phí", amount: 0, status: "Đã xác nhận", createdAt: now }, ...items.filter((i) => i.code !== code)]);
        setAllProducts((items) => items.map((x) => x.id === product.id ? { ...x, buyers: (x.buyers || 0) + 1 } : x));
        setSelectedProduct({ ...product, verified: true, buyers: (product.buyers || 0) + 1 });
        setPurchaseStep(null);
        setRegAnswers(null);
        sendEmail({ type: "free_confirmed", email: user.email, name: user.name, productName: product.title, date: product.kind === "event" ? eventWhen(product) : "" });
        if (needsRegistration(product)) {
          const when = product.kind === "event" ? eventWhen(product) : product.startDate ? `khai giảng ${formatDateVN(product.startDate)}` : "";
          const item = { title: "Đăng ký thành công", body: `Bạn đã đăng ký ${product.title}${when ? ` - ${when}` : ""}. Link tham gia sẽ được gửi qua email 1 ngày trước.`, link: `#san-pham=${product.id}`, createdAt: new Date().toISOString() };
          addDoc(collection(db, "users", uid, "notifications"), item)
            .then((ref) => setSiteNotifications((list) => [{ ...item, id: `u-${ref.id}` }, ...list]))
            .catch(() => { /* bỏ qua */ });
        }
      })
      .catch(() => {
        setPurchaseStep(null);
        window.alert("Chưa nhận được sản phẩm. Bạn kiểm tra kết nối mạng rồi thử lại, hoặc nhắn Zalo cho Tia nhé.");
      })
      .finally(() => setClaiming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseStep, selectedProduct, user]);

  // ── Chuông thông báo: thông báo chung (mọi người) + thông báo cá nhân (khách đã đăng nhập) ──
  useEffect(() => {
    if (authLoading) return;
    const uid = auth.currentUser?.uid;
    const general = getDocs(fsQuery(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20)))
      .then((snap) => snap.docs.map((d) => ({ ...(d.data() as Omit<SiteNotification, "id">), id: `a-${d.id}`, general: true })))
      .catch(() => [] as SiteNotification[]);
    const personal = uid
      ? getDocs(fsQuery(collection(db, "users", uid, "notifications"), orderBy("createdAt", "desc"), limit(20)))
        .then((snap) => snap.docs.map((d) => ({ ...(d.data() as Omit<SiteNotification, "id">), id: `u-${d.id}` })))
        .catch(() => [] as SiteNotification[])
      : Promise.resolve([] as SiteNotification[]);
    Promise.all([general, personal]).then(([a, b]) => {
      setSiteNotifications([...a, ...b].sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))).slice(0, 20));
    });
    let readAt = "";
    try { readAt = localStorage.getItem("tia-notif-read") || ""; } catch { /* trình duyệt chặn lưu trữ */ }
    if (uid) getDoc(doc(db, "users", uid)).then((snap) => { const r = String(snap.data()?.notifReadAt || ""); setNotifReadAt(r > readAt ? r : readAt); }).catch(() => setNotifReadAt(readAt));
    else setNotifReadAt(readAt);
  }, [authLoading, user?.email]);

  // ── Link riêng: đọc link → mở đúng trang (khi vào bằng link, F5, bấm Back/Forward) ──
  const appliedHash = useRef<string | null>(null);
  const [hashTick, setHashTick] = useState(0);
  useEffect(() => {
    const onHash = () => setHashTick((t) => t + 1);
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => { window.removeEventListener("hashchange", onHash); window.removeEventListener("popstate", onHash); };
  }, []);
  useEffect(() => {
    const h = currentHash();
    if (appliedHash.current === h || h.startsWith("#admin") || legalFromHash(h)) return;
    const clearOverlays = () => { setReaderProduct(null); setToolProduct(null); setParticipantProduct(null); setPurchaseStep(null); setMobileOpen(false); };
    const prod = h.match(/^#san-pham=(.+)$/);
    const art = h.match(/^#article=(.+)$/);
    if (prod) {
      const product = allProducts.find((x) => x.id === prod[1]);
      if (!product) return; // sản phẩm chưa tải xong → thử lại khi tải xong
      clearOverlays(); setSelectedArticle(null); setSelectedProduct(product);
    } else if (art) {
      const article = articles.find((x) => x.id === art[1]);
      if (!article) return;
      clearOverlays(); setSelectedProduct(null); setSelectedArticle(article);
    } else {
      const sub = h.match(/^#trang-ca-nhan\/(.+)$/);
      if (sub) setProfileTab(({ "don-hang": "orders", "lich-call": "meetings", "quan-tam": "favorites", "san-pham": "products" } as Record<string, MemberTab>)[sub[1]] || "products");
      let nav = sub ? "Trang cá nhân" : HASH_NAV[h] ?? "Trang chủ";
      if ((nav === "Trang cá nhân" || nav === "Đặt lịch miễn phí") && !user) {
        if (authLoading) return; // chờ biết đã đăng nhập chưa
        clearOverlays(); setSelectedProduct(null); setSelectedArticle(null);
        if (nav === "Trang cá nhân") { setActiveNav(nav); setAuthDestination(null); setPurchaseStep("auth"); }
        else setActiveNav("Đồng hành 1:1");
        appliedHash.current = h;
        return;
      }
      clearOverlays(); setSelectedProduct(null); setSelectedArticle(null); setActiveNav(nav);
    }
    appliedHash.current = h;
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashTick, allProducts, articles, user, authLoading]);
  // ── Link riêng: đổi trang → cập nhật link trên thanh địa chỉ ──
  useEffect(() => {
    if (adminMode || legalPage) return;
    const want = selectedArticle ? `#article=${selectedArticle.id}` : selectedProduct ? `#san-pham=${selectedProduct.id}` : NAV_HASH[activeNav] ?? "";
    const now = currentHash();
    if (now === want || (want === "#trang-ca-nhan" && now.startsWith("#trang-ca-nhan/"))) { appliedHash.current = now; return; }
    if (appliedHash.current !== now) return; // link mới vào chưa mở xong → không ghi đè
    window.history.pushState(null, "", want || window.location.pathname + window.location.search);
    appliedHash.current = want;
  }, [activeNav, selectedProduct?.id, selectedArticle?.id, adminMode, legalPage]);

  if (authLoading) {
    return <div className="admin-loading">Đang tải...</div>;
  }

  // Quyền admin xét theo email của tài khoản đăng nhập (không theo hồ sơ, vì hồ sơ user tự sửa được)
  const isAdminUser = Boolean(user) && auth.currentUser?.email === ADMIN_EMAIL;
  if (adminMode && isAdminUser) {
    return (
      <Suspense fallback={<div className="admin-loading">Đang mở trang quản trị...</div>}>
        <AdminApp
          onExit={() => { window.location.hash = ""; setAdminMode(false); }}
          onAdminEvent={() => { /* thông báo cho khách được lưu vào tài khoản của họ trong AdminApp */ }}
        />
      </Suspense>
    );
  }

  if (adminMode && !isAdminUser) {
    window.location.hash = "";
    setAdminMode(false);
  }

  // Sự kiện / khoá học tự tổ chức: điền form đăng ký trước khi thanh toán
  const buyStep = (product?: Product | null): PurchaseStep => (product && needsRegistration(product) ? "register" : "checkout");
  const beginPurchase = () => {
    setRegAnswers(null);
    if (selectedProduct?.kind === "combo" && (selectedProduct.comboItems || []).some((id) => ownedProductIds.includes(id))) return;
    if (!user) {
      setAuthDestination(null);
      setPurchaseStep("auth");
    } else {
      setPurchaseStep(user.profileComplete === false ? "profile" : buyStep(selectedProduct));
    }
  };
  const openProduct = (product: Product) => {
    setSelectedProduct({
      ...product,
      verified: product.kind === "combo"
        ? Boolean(user) && (product.comboItems || []).length > 0 && (product.comboItems || []).every((id) => ownedProductIds.includes(id))
        : Boolean(user) && (ownedProductIds.includes(product.id) || isAdminUser),
    });
  };
  const accessProduct = (product: Product) => {
    if (product.kind === "combo") {
      setSelectedProduct(null);
      setProfileTab("products");
      setActiveNav("Trang cá nhân");
      window.scrollTo(0, 0);
    } else if (needsRegistration(product)) {
      setParticipantProduct(product);
      window.scrollTo(0, 0);
    } else if (product.kind === "tool" && (product.toolKey === "hieu-minh" || product.toolKey === "tktksn")) {
      setToolProduct(product);
      window.scrollTo(0, 0);
    } else if (product.kind === "document" || product.kind === "tool") {
      setReaderProduct(product);
    } else if (product.kind === "course") {
      window.open(product.externalUrl || "https://www.udemy.com/", "_blank", "noopener,noreferrer");
    }
  };
  // Bấm trái tim: lưu vào hồ sơ user + cộng/trừ 1 số người quan tâm của sản phẩm
  const toggleFav = (product: Product) => {
    const uid = auth.currentUser?.uid;
    if (!user || !uid) {
      setAuthDestination(null);
      setPurchaseStep("auth");
      return;
    }
    const on = favs.includes(product.id);
    const step = on ? -1 : 1;
    setFavs((list) => (on ? list.filter((id) => id !== product.id) : [...list, product.id]));
    setFavDelta((d) => ({ ...d, [product.id]: (d[product.id] || 0) + step }));
    const batch = writeBatch(db);
    batch.set(doc(db, "users", uid), { favorites: on ? arrayRemove(product.id) : arrayUnion(product.id), lastFav: product.id }, { merge: true });
    batch.update(doc(db, "products", product.id), { interested: increment(step) });
    batch.commit().catch(() => {
      // Ghi thất bại → trả lại trạng thái cũ
      setFavs((list) => (on ? [...list, product.id] : list.filter((id) => id !== product.id)));
      setFavDelta((d) => ({ ...d, [product.id]: (d[product.id] || 0) - step }));
    });
  };
  const favApi: FavApi = { favs, delta: favDelta, toggle: toggleFav };
  const openTiaZalo = () => window.open("https://zalo.me/0362864028", "_blank", "noopener,noreferrer");
  const userNotifications = siteNotifications;
  const unreadNotifications = siteNotifications.filter((item) => String(item.createdAt) > notifReadAt).length;
  // Mở chuông = đã đọc hết
  const markNotificationsRead = () => {
    const latest = siteNotifications[0]?.createdAt;
    if (!latest || latest <= notifReadAt) return;
    setNotifReadAt(latest);
    try { localStorage.setItem("tia-notif-read", latest); } catch { /* bỏ qua */ }
    const uid = auth.currentUser?.uid;
    if (uid) setDoc(doc(db, "users", uid), { notifReadAt: latest }, { merge: true }).catch(() => { /* bỏ qua */ });
  };
  const openNotification = (item: SiteNotification) => {
    setNotificationOpen(false);
    if (!item.link) return;
    if (item.link.startsWith("#")) window.location.hash = item.link;
    else window.open(item.link, "_blank", "noopener,noreferrer");
  };

  return (
    <FavContext.Provider value={favApi}>
    <style>{EXTRA_CSS}</style>
    <main className="app-shell">
      <button className="mobile-menu" aria-label="Mở menu" onClick={() => setMobileOpen(true)}>
        <Icon name="menu" />
      </button>

      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <button className="sidebar-close" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}>
          <Icon name="close" />
        </button>
        <div className="brand">
          <div className="brand-mark"><span>t</span></div>
          <div>
            <div className="brand-name">tiahere</div>
            <div className="brand-tagline">A soft place to grow</div>
          </div>
        </div>

        <nav className="nav-list" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activeNav === item.label ? "active" : ""}`}
              onClick={() => {
                setActiveNav(item.label);
                setSelectedProduct(null);
                setReaderProduct(null);
                setToolProduct(null);
                setParticipantProduct(null);
                setSelectedArticle(null);
                setPurchaseStep(null);
                setAuthDestination(null);
                setMobileOpen(false);
              }}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </button>
          ))}
          {isAdminUser && (
            <button
              className={`nav-item ${adminMode ? "active" : ""}`}
              onClick={() => { setAdminMode(true); setMobileOpen(false); }}
            >
              <Icon name="grid" size={19} />
              <span>Admin Panel</span>
            </button>
          )}
        </nav>

        {user ? (
          <button
            className="sidebar-footer member-button"
            onClick={() => {
              setProfileTab("products");
              setActiveNav("Trang cá nhân");
              setSelectedProduct(null);
              setReaderProduct(null);
              setToolProduct(null);
              setParticipantProduct(null);
              setSelectedArticle(null);
              setPurchaseStep(null);
            }}
          >
            <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <span>Xem trang cá nhân</span>
            </div>
            <Icon name="arrow" size={17} />
          </button>
        ) : (
          <button className="sidebar-footer sidebar-login" onClick={() => { setAuthDestination(null); setPurchaseStep("auth"); }}>
            <span className="avatar"><Icon name="user" size={17} /></span>
            <span className="sidebar-login-copy">
              <strong>Đăng nhập / Đăng ký</strong>
              <span>Truy cập sản phẩm của bạn</span>
            </span>
            <Icon name="arrow" size={17} />
          </button>
        )}
        <span className="sidebar-legal"><a href="https://zalo.me/0362864028" target="_blank" rel="noopener noreferrer">Hỗ trợ Zalo: 0362 864 028</a></span>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}

      <section className="main-content">
        <header className="topbar">
          <div className="date-block">
            <strong>{new Date().getDate()}</strong>
            <span>{new Date().toLocaleDateString("vi-VN", { month: "long" }).replace("tháng", "THÁNG").toUpperCase()}<br /><small>{new Date().toLocaleDateString("vi-VN", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase())}</small></span>
          </div>
          <label className="search-box">
            <Icon name="search" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tài liệu, khóa học, bài viết..." />
          </label>
          <div className="top-actions">
            <div className="site-notification-wrap">
              <button
                className="notification"
                aria-label="Thông báo"
                onClick={() => {
                  setNotificationOpen((open) => !open);
                  markNotificationsRead();
                }}
              >
                <Icon name="bell" />
                {unreadNotifications > 0 && <i />}
              </button>
              {notificationOpen && (
                <div className="site-notification-panel">
                  <header><strong>Thông báo</strong><span>{userNotifications.length} thông báo</span></header>
                  {userNotifications.length ? userNotifications.map((item) => (
                    <article key={item.id} onClick={() => openNotification(item)} style={{ cursor: item.link ? "pointer" : "default" }}><span><Icon name={item.general ? "sparkle" : "check"} size={15} /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{timeAgo(item.createdAt)}{item.general ? " · Thông báo chung" : ""}</small></div></article>
                  )) : <p className="notification-empty">Bạn chưa có thông báo nào.</p>}
                </div>
              )}
            </div>
            {user ? (
              <button
                className="mini-avatar"
                onClick={() => {
                  setProfileTab("products");
                  setActiveNav("Trang cá nhân");
                  setSelectedProduct(null);
                  setReaderProduct(null);
                  setToolProduct(null);
                  setParticipantProduct(null);
                  setSelectedArticle(null);
                  setPurchaseStep(null);
                }}
                aria-label="Mở trang cá nhân"
              >
                {user.name.slice(0, 2).toUpperCase()}
              </button>
            ) : (
              <button className="top-login-button" onClick={() => { setAuthDestination(null); setPurchaseStep("auth"); }}>Đăng nhập / Đăng ký</button>
            )}
          </div>
        </header>

        {legalPage ? (
          <LegalPage page={legalPage} onBack={() => { if (window.history.length > 1) window.history.back(); else { window.location.hash = ""; setLegalPage(null); } }} />
        ) : purchaseStep === "auth" ? (
          <AuthPage
            product={selectedProduct}
            onBack={() => setPurchaseStep(null)}
            onAuthenticated={(account) => {
              setUser(account);
              setOwnedProductIds([]);
              if (authDestination === "booking" || authDestination === "zalo") {
                if (account.profileComplete === false) {
                  setPurchaseStep("profile");
                } else if (authDestination === "zalo") {
                  openTiaZalo();
                  setPurchaseStep(null);
                  setAuthDestination(null);
                } else {
                  setActiveNav("Đặt lịch miễn phí");
                  setPurchaseStep(null);
                  setAuthDestination(null);
                }
              } else if (selectedProduct && ownedProductIds.includes(selectedProduct.id)) {
                setSelectedProduct({ ...selectedProduct, verified: true });
                setPurchaseStep(null);
              } else {
                setPurchaseStep(selectedProduct ? (account.profileComplete === false ? "profile" : buyStep(selectedProduct)) : null);
              }
            }}
          />
        ) : purchaseStep === "profile" && user ? (
          <CompleteGoogleProfilePage
            user={user}
            destination={authDestination || "purchase"}
            onBack={() => setPurchaseStep(null)}
            onComplete={(completedUser) => {
              setUser(completedUser);
              if (authDestination === "booking") {
                setActiveNav("Đặt lịch miễn phí");
                setPurchaseStep(null);
                setAuthDestination(null);
              } else if (authDestination === "zalo") {
                openTiaZalo();
                setPurchaseStep(null);
                setAuthDestination(null);
              } else {
                setPurchaseStep(buyStep(selectedProduct));
              }
            }}
          />
        ) : purchaseStep === "register" && selectedProduct && user ? (
          <RegistrationPage product={selectedProduct} user={user} onBack={() => setPurchaseStep(null)} onSubmit={(answers) => { setRegAnswers(answers); setPurchaseStep("checkout"); window.scrollTo(0, 0); }} />
        ) : purchaseStep === "checkout" && selectedProduct && user && isFreeProduct(selectedProduct) ? (
          <div style={{ padding: "80px 20px", textAlign: "center", opacity: 0.7 }}>Đang mở quyền truy cập...</div>
        ) : purchaseStep === "checkout" && selectedProduct && user ? (
          <CheckoutPage product={selectedProduct} user={user} extra={needsRegistration(selectedProduct) ? regAnswers : null} onBack={() => setPurchaseStep(needsRegistration(selectedProduct) ? "register" : null)} onComplete={(order) => {
            sendEmail({ type: "order_pending", email: user.email, name: user.name, productName: `${selectedProduct.title} (mã đơn ${order.code})` });
            setMyOrders((items) => [order, ...items.filter((i) => i.code !== order.code)]);
            setLastOrderCode(order.code);
            setPurchaseStep("pending");
          }} />
        ) : purchaseStep === "pending" && selectedProduct ? (
          <PurchasePendingPage
            product={selectedProduct}
            orderCode={lastOrderCode}
            onDone={() => {
              setPurchaseStep(null);
              setSelectedProduct(null);
              setActiveNav("Tài liệu");
            }}
          />
        ) : toolProduct && user ? (
          <Suspense fallback={<div style={{ padding: "80px 20px", textAlign: "center", opacity: 0.7 }}>Đang mở công cụ...</div>}>
            {toolProduct.toolKey === "tktksn"
              ? <TktksnTool product={toolProduct} user={user} onBack={() => setToolProduct(null)} />
              : <HieuMinhTool product={toolProduct} user={user} onBack={() => setToolProduct(null)} />}
          </Suspense>
        ) : participantProduct && user ? (
          <ParticipantPage product={participantProduct} onBack={() => setParticipantProduct(null)} />
        ) : readerProduct && user ? (
          <EbookReaderPage product={readerProduct} user={user} onBack={() => setReaderProduct(null)} />
        ) : selectedArticle ? (
          <ArticleDetailPage article={selectedArticle} articles={articles} onBack={() => setSelectedArticle(null)} onSelect={(article) => { setSelectedArticle(article); window.scrollTo(0, 0); }} />
        ) : selectedProduct ? (
          <ProductDetailPage
            product={{ ...selectedProduct, verified: selectedProduct.kind === "combo"
              ? Boolean(user) && (selectedProduct.comboItems || []).length > 0 && (selectedProduct.comboItems || []).every((id) => ownedProductIds.includes(id))
              : Boolean(selectedProduct.verified) || (Boolean(user) && (ownedProductIds.includes(selectedProduct.id) || isAdminUser)) }}
            comboProducts={(selectedProduct.comboItems || []).map((id) => allProducts.find((p) => p.id === id)).filter(Boolean) as Product[]}
            ownedIds={user ? ownedProductIds : []}
            onOpenProduct={(p) => { openProduct(p); window.scrollTo(0, 0); }}
            pendingOrder={user ? myOrders.find((order) => order.productId === selectedProduct.id && order.status === "Chờ xác nhận") : undefined}
            onBack={() => setSelectedProduct(null)}
            claiming={claiming}
            onPurchase={beginPurchase}
            onAccess={() => accessProduct(selectedProduct)}
          />
        ) : activeNav === "Trang cá nhân" && user ? (
          <ProfilePage
            key={profileTab}
            user={user}
            ownedProducts={allProducts.filter((product) => ownedProductIds.includes(product.id))}
            favoriteProducts={allProducts.filter((product) => favs.includes(product.id))}
            orders={myOrders}
            bookings={myBookings}
            onBookNew={() => setActiveNav("Đặt lịch miễn phí")}
            initialTab={profileTab}
            onOpenProduct={openProduct}
            onUpdateUser={setUser}
            onSignOut={async () => {
              await signOut(auth);
              setUser(null);
              setOwnedProductIds([]);
              setActiveNav("Trang chủ");
            }}
          />
        ) : activeNav === "Đặt lịch miễn phí" && user ? (
          <FreeBookingPage
            user={user}
            onBooked={(booking) => setMyBookings((items) => [booking, ...items.filter((i) => i.id !== booking.id)])}
            onBack={() => setActiveNav("Đồng hành 1:1")}
            onComplete={() => {
              setProfileTab("meetings");
              setActiveNav("Trang cá nhân");
            }}
          />
        ) : activeNav === "Tài liệu" ? (
          <ProductCatalogPage
            query={query}
            products={documentProducts}
            eyebrow="THƯ VIỆN TIAHERE"
            title="Tài liệu cho hành trình của bạn"
            description="Những bộ tài liệu thực tế giúp bạn hiểu mình, vững nghề và tự do hơn trong công việc."
            countLabel="Tài liệu"
            onSelect={openProduct}
            ownedProductIds={user ? ownedProductIds : []}
          />
        ) : activeNav === "Công cụ" ? (
          <ProductCatalogPage
            query={query}
            products={toolProducts}
            eyebrow="BỘ CÔNG CỤ TIAHERE"
            title="Làm việc rõ ràng và nhẹ nhàng hơn"
            description="Template và công cụ thực tế giúp bạn tổ chức công việc, sự nghiệp và tài chính theo cách của riêng mình."
            countLabel="Công cụ"
            onSelect={openProduct}
            ownedProductIds={user ? ownedProductIds : []}
          />
        ) : activeNav === "Khoá học" ? (
          <ProductCatalogPage
            query={query}
            products={courseProducts}
            eyebrow="HỌC CÙNG TIAHERE"
            title="Khoá học cho một hành trình bền vững"
            description="Các lộ trình học ngắn gọn, thực tế và linh hoạt để bạn chủ động phát triển theo tốc độ riêng."
            countLabel="Khoá học"
            onSelect={openProduct}
            ownedProductIds={user ? ownedProductIds : []}
          />
        ) : activeNav === "Sự kiện" ? (
          <ProductCatalogPage
            query={query}
            products={eventProducts}
            eyebrow="GẶP NHAU TẠI TIAHERE"
            title="Sự kiện sắp diễn ra"
            description="Những buổi chia sẻ, workshop online và offline để bạn học hỏi, đặt câu hỏi và kết nối."
            countLabel="Sự kiện"
            onSelect={openProduct}
            ownedProductIds={user ? ownedProductIds : []}
          />
        ) : activeNav === "Bài viết" ? (
          <ArticlesPage articles={articles} onSelect={(article) => { setSelectedArticle(article); window.scrollTo(0, 0); }} />
        ) : activeNav === "Đồng hành 1:1" ? (
          <MentoringPage
            user={user}
            onBookFree={() => {
              if (!user) {
                setAuthDestination("booking");
                setPurchaseStep("auth");
              } else if (user.profileComplete === false) {
                setAuthDestination("booking");
                setPurchaseStep("profile");
              } else {
                setActiveNav("Đặt lịch miễn phí");
              }
            }}
            onBookPrivate={() => {
              if (!user) {
                setAuthDestination("zalo");
                setPurchaseStep("auth");
              } else if (user.profileComplete === false) {
                setAuthDestination("zalo");
                setPurchaseStep("profile");
              } else {
                openTiaZalo();
              }
            }}
          />
        ) : (
          <>
        <header className="home-page-header">
          <span className="eyebrow">KHÔNG GIAN TIAHERE</span>
          <h1 style={{ maxWidth: "none" }}>Hiểu mình, vững nghề và tự do.</h1>
          <p>Tài liệu, công cụ, khoá học và những góc nhìn thực tế giúp bạn chủ động thiết kế hành trình sự nghiệp theo cách của riêng mình.</p>
        </header>

        <DiscoveryTabs active={category} onChange={setCategory} />

        {category === "Khám phá" ? (
          homeShowcase.length === 0 ? (
            <div className="documents-empty" style={{ padding: "60px 0", textAlign: "center" }}>
              <p style={{ fontSize: "1.1rem", color: "var(--c-text-2, #666)" }}>Nội dung đang được cập nhật. Quay lại sớm nhé 🌱</p>
            </div>
          ) : (
          <section className="showcase-grid" aria-label="Sản phẩm nổi bật">
            {homeShowcase[0] && (
              <article className="showcase-hero clickable-product" role="button" tabIndex={0} onClick={() => openProduct(homeShowcase[0])} onKeyDown={(event) => event.key === "Enter" && openProduct(homeShowcase[0])}>
                <img src={homeShowcase[0].image} alt={homeShowcase[0].title} />
                <div className="showcase-shade" />
                <HeartButton product={homeShowcase[0]} size={17} className="heart-button big-card-heart" />
                <div className="showcase-hero-copy">
                  <span>{homeShowcase[0].badge?.toUpperCase() || "NỔI BẬT"}{eventTag(homeShowcase[0])}</span>
                  <h2>{homeShowcase[0].title}</h2>
                  <p>{homeShowcase[0].description}</p>
                  <ProductEngagement product={homeShowcase[0]} />
                  <button>{viewLabel(homeShowcase[0])} · {priceText(homeShowcase[0])}</button>
                </div>
              </article>
            )}
            {homeShowcase.slice(1, 5).map((product) => (
              <ShowcaseProductCard key={product.id} product={product} owned={user ? ownedProductIds.includes(product.id) : false} onSelect={openProduct} />
            ))}
            {homeShowcase[5] && (
              <article className="showcase-deal clickable-product" role="button" tabIndex={0} onClick={() => openProduct(homeShowcase[5])} onKeyDown={(event) => event.key === "Enter" && openProduct(homeShowcase[5])}>
                <img src={homeShowcase[5].image} alt={homeShowcase[5].title} />
                <div className="deal-shade" />
                <HeartButton product={homeShowcase[5]} size={17} className="heart-button big-card-heart" />
                <div className="deal-copy">
                  <span>{user && ownedProductIds.includes(homeShowcase[5].id) ? "ĐÃ SỞ HỮU" : "DÀNH CHO BẠN"}{eventTag(homeShowcase[5])}</span>
                  <h2>{homeShowcase[5].title}</h2>
                  <p>{homeShowcase[5].description}</p>
                  <ProductEngagement product={homeShowcase[5]} />
                  <button>{viewLabel(homeShowcase[5])} · {priceText(homeShowcase[5])}</button>
                </div>
              </article>
            )}
          </section>
          )
        ) : (
          <section className="home-filter-results">
            <header>
              <div><span className="eyebrow">SẢN PHẨM {category.toUpperCase()}</span><h2>{category} tại tiahere</h2></div>
              <span>{homeProducts.filter((product) => product.tabs.includes(category)).length} sản phẩm</span>
            </header>
            <div className="documents-grid">
              {homeProducts.filter((product) => product.tabs.includes(category)).length === 0 ? (
                <p className="documents-empty">Chưa có sản phẩm trong mục này. Quay lại sớm nhé 🌱</p>
              ) : homeProducts.filter((product) => product.tabs.includes(category)).map((product) => (
                <article
                  className="document-card"
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProduct(product)}
                  onKeyDown={(event) => event.key === "Enter" && openProduct(product)}
                >
                  <div className="document-cover">
                    <img src={product.image} alt="" />
                    <span>{user && ownedProductIds.includes(product.id) ? "Đã sở hữu" : category}</span>
                    <HeartButton product={product} />
                  </div>
                  <div className="document-card-copy">
                    <span>{product.category.toUpperCase()}</span>
                    <h2>{product.title}</h2>
                    <p>{product.description}</p>
                    <ProductEngagement product={product} />
                    <div><PriceTag product={product} /><button aria-label={`Xem ${product.title}`}><Icon name="arrow" size={16} /></button></div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
          </>
        )}
        {/* Chân trang chung cho mọi trang */}
        <footer className="home-footer site-footer">
          <span>tiahere</span>
          <div><p>Bản thử nghiệm beta 10/2026 · <a href={LEGAL_PAGES.terms.hash}>Điều khoản sử dụng</a> · <a href={LEGAL_PAGES.privacy.hash}>Chính sách bảo mật</a></p></div>
        </footer>
      </section>
    </main>
    </FavContext.Provider>
  );
}
