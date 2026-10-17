import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { doc, setDoc, getDoc, collection, addDoc, updateDoc, getDocs, deleteDoc, writeBatch, arrayUnion, arrayRemove, increment, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import "./admin.css";

// ── Email helper (dùng chung APPS_SCRIPT_URL với App.tsx) ──────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHk_e9y3DD6usREe2LmmRvwUK4iSjlaLG8MydWQmQT7Q_y_9JuVT75SprasejnQ0iFng/exec";
// Gửi kèm idToken để Apps Script xác minh đúng là admin đang gửi
function sendAdminEmail(payload: Record<string, string>): void {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "PASTE_YOUR_WEB_APP_URL_HERE") return;
  const current = auth.currentUser;
  (current ? current.getIdToken() : Promise.resolve(""))
    .catch(() => "")
    .then((idToken) => fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ ...payload, idToken }) }))
    .catch(() => { /* lỗi gửi email không chặn thao tác của admin */ });
}
// ──────────────────────────────────────────────────────────────

// ── Tải ảnh lên Cloudinary (unsigned preset) ──────────────────
const CLOUDINARY_CLOUD_NAME = "feeka2m5";
const CLOUDINARY_UPLOAD_PRESET = "tiahere_upload";
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Chỉ nhận ảnh JPG, PNG hoặc WEBP.");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(`Ảnh nặng ${(file.size / 1024 / 1024).toFixed(1)}MB, vượt giới hạn 10MB.`);
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) {
    throw new Error(data?.error?.message ? `Cloudinary báo lỗi: ${data.error.message}` : "Tải ảnh thất bại. Kiểm tra mạng và thử lại.");
  }
  return data.secure_url as string;
}

function CoverUploadBox({ variant, title, hint, size, value, onChange }: { variant: "landscape" | "portrait"; title: string; hint: string; size: string; value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      onChange(await uploadImageToCloudinary(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div>
      <label className={`cover-upload ${variant}`} style={{ overflow: "hidden" }}>
        {value && !uploading ? (
          <img src={value} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div className="cover-placeholder"><AdminIcon name="plus" /><strong>{uploading ? "Đang tải ảnh lên..." : title}</strong><span>{hint}</span><small>{size}</small></div>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} disabled={uploading} />
      </label>
      {value && !uploading && <small style={{ display: "block", marginTop: 6, opacity: 0.75 }}>Bấm vào ảnh để đổi ảnh khác · <button type="button" onClick={() => onChange("")} style={{ background: "none", border: 0, padding: 0, color: "#c00", cursor: "pointer", font: "inherit" }}>Xoá ảnh</button></small>}
      {error && <small style={{ display: "block", marginTop: 6, color: "#c00" }}>{error}</small>}
    </div>
  );
}
// ──────────────────────────────────────────────────────────────

type AdminSection = "overview" | "products" | "content" | "articles" | "orders" | "registrations" | "access" | "members" | "meetings" | "mentoring" | "homepage" | "legal" | "announcements" | "analytics" | "settings";
type IconName = AdminSection | "search" | "bell" | "plus" | "check" | "arrow" | "logout";
export type AdminEvent = { email: string; title: string; message: string };

function AdminIcon({ name, size = 19 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    products: <><path d="m4 7 8-4 8 4-8 4Z" /><path d="m4 7 8 4 8-4v10l-8 4-8-4Z" /><path d="M12 11v10" /></>,
    content: <><path d="M6 2h8l4 4v16H6Z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    articles: <><path d="M5 3h14v18H5Z" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    orders: <><path d="M4 6h17l-2 9H7Z" /><path d="m4 6-1-3H1M8 20h.01M18 20h.01" /></>,
    registrations: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 3v3h6V3M8 11h8M8 15h5" /></>,
    access: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M15 8l3 3M17 6l3 3" /></>,
    members: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 15.5A5 5 0 0 1 21 20" /></>,
    meetings: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" /></>,
    mentoring: <><circle cx="12" cy="8" r="3" /><path d="M6 20v-2a6 6 0 0 1 12 0v2" /><path d="M17 14h1a4 4 0 0 1 4 4v2M7 14H6a4 4 0 0 0-4 4v2" /></>,
    homepage: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    legal: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></>,
    announcements: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    analytics: <><path d="M4 19h16M6 16h3v-5H6ZM11 16h3V6h-3ZM16 16h3V9h-3Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M9 12h9" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navItems: { id: AdminSection; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "products", label: "Sản phẩm" },
  { id: "articles", label: "Bài viết" },
  { id: "orders", label: "Đơn hàng" },
  { id: "registrations", label: "Người đăng ký" },
  { id: "access", label: "Quyền truy cập" },
  { id: "members", label: "Thành viên" },
  { id: "meetings", label: "Lịch Đồng hành 1:1" },
  { id: "mentoring", label: "Trang Đồng hành 1:1" },
  { id: "announcements", label: "Thông báo chung" },
  { id: "legal", label: "Điều khoản & Bảo mật" },
  { id: "analytics", label: "Thống kê" },
  { id: "settings", label: "Cài đặt" },
];

const initialProducts: { id: string; name: string; type: string; price: string; sold: number; status: string; ebookUrl?: string; description?: string; category?: string; badge?: string; image?: string; externalUrl?: string; tabs?: string[]; outcomes?: string[]; audience?: string[]; ebookFileName?: string; imageCard?: string; toolKey?: string; buyers?: number; bonusBuyers?: number; originalPrice?: string; showBuyers?: boolean; interested?: number; bonusInterest?: number; showInterest?: boolean; courseMode?: string; contentText?: string; eventDate?: string; eventTime?: string; eventEndTime?: string; eventFormat?: string; location?: string; startDate?: string; schedule?: string; note?: string; comboItems?: string[]; saleEnd?: string }[] = [];

const initialOrders: { id: string; customer: string; email: string; product: string; amount: string; transfer: string; time: string; status: string }[] = [];

const members: { name: string; email: string; segment: string; location: string; products: number; joined: string }[] = [];

const initialMeetings: { id: string; uid: string; name: string; email: string; date: string; issue: string; topic: string; plan: string; status: string; meetUrl?: string; phone?: string }[] = [];

// ── Thông báo trong chuông của khách: lưu vào users/{uid}/notifications ──
function notifyUser(uid: string, title: string, body: string, link = "") {
  if (!uid) return;
  addDoc(collection(db, "users", uid, "notifications"), { title, body, link, createdAt: new Date().toISOString() })
    .catch(() => { /* không chặn thao tác chính nếu ghi thông báo lỗi */ });
}

// ── Tiện ích ngày tháng & đơn hàng ────────────────────────────
type AdminOrder = { code: string; uid: string; email: string; name: string; productId: string; productTitle: string; priceLabel: string; amount: number; status: string; createdAt: string; confirmedAt?: string; source?: string; registration?: Record<string, string | boolean> };

function adminToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function adminDateLabel(iso: string, withWeekday = false): string {
  if (!iso) return "";
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return date.toLocaleDateString("vi-VN", withWeekday ? { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" });
}
function adminTimeLabel(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}
const ADMIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function adminCode(prefix: string): string {
  const values = new Uint32Array(5);
  crypto.getRandomValues(values);
  return prefix + Array.from(values, (value) => ADMIN_CODE_ALPHABET[value % ADMIN_CODE_ALPHABET.length]).join("");
}
const errorBoxStyle: React.CSSProperties = { background: "#fff0f0", border: "1px solid #fcc", borderRadius: "10px", padding: "12px 16px", color: "#c00", marginBottom: "16px" };
// ──────────────────────────────────────────────────────────────

// ─── MENTORING DATA TYPES ────────────────────────────────────────────────────

export type MentoringData = {
  header: {
    eyebrow: string;
    title: string;
    description: string;
  };
  cardFree: {
    imageUrl: string;
    imageAlt: string;
    badge: string;
    eyebrow: string;
    title: string;
    description: string;
    bullet1: string;
    bullet2: string;
    bullet3: string;
    ctaLoggedIn: string;
    ctaGuest: string;
  };
  cardPaid: {
    imageUrl: string;
    imageAlt: string;
    badge: string;
    eyebrow: string;
    title: string;
    description: string;
    bullet1: string;
    bullet2: string;
    bullet3: string;
    cta: string;
  };
};

export const defaultMentoringData: MentoringData = {
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

// ─── MENTORING SETTINGS PAGE ─────────────────────────────────────────────────

function MentoringSettingsPage({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<MentoringData>(defaultMentoringData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Load from Firestore on mount
  useEffect(() => {
    getDoc(doc(db, "settings", "mentoring"))
      .then((snap) => {
        if (snap.exists()) {
          setData(snap.data() as MentoringData);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await setDoc(doc(db, "settings", "mentoring"), data);
      setSaved(true);
    } catch {
      setError("Không thể lưu. Kiểm tra kết nối và thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const set = (path: string, value: string) => {
    setSaved(false);
    setData((prev) => {
      const keys = path.split(".");
      if (keys.length === 2) {
        return { ...prev, [keys[0]]: { ...(prev as Record<string, Record<string, string>>)[keys[0]], [keys[1]]: value } };
      }
      return prev;
    });
  };

  if (loading) {
    return (
      <div className="admin-form-page">
        <button className="admin-form-back" onClick={onBack}><AdminIcon name="arrow" size={16} /> Quay lại</button>
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--c-text-2, #888)" }}>Đang tải nội dung...</div>
      </div>
    );
  }

  return (
    <div className="admin-form-page">
      <button className="admin-form-back" onClick={onBack}><AdminIcon name="arrow" size={16} /> Quay lại</button>
      <header className="admin-page-header">
        <div>
          <span>TRANG ĐỒNG HÀNH 1:1</span>
          <h1>Chỉnh sửa trang Đồng hành</h1>
          <p>Thay đổi sẽ được hiển thị ngay khi thành viên reload trang.</p>
        </div>
      </header>

      <form className="admin-editor-form" onSubmit={handleSubmit}>
        {saved && <div className="admin-form-success"><AdminIcon name="check" />Đã lưu thành công lên Firestore.</div>}
        {error && <div className="admin-form-error" style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: "10px", padding: "12px 16px", color: "#c00", marginBottom: "16px" }}>{error}</div>}

        {/* SECTION 1: HEADER */}
        <section>
          <header>
            <span>01</span>
            <div>
              <h2>Header trang</h2>
              <p>Dòng eyebrow, tiêu đề lớn và đoạn mô tả phía trên hai card.</p>
            </div>
          </header>
          <div className="admin-form-grid">
            <label><span>Eyebrow (in hoa nhỏ)</span><input value={data.header.eyebrow} onChange={(e) => set("header.eyebrow", e.target.value)} placeholder="ĐỒNG HÀNH CÙNG TIA" /></label>
            <label className="wide"><span>Tiêu đề lớn (h1)</span><input value={data.header.title} onChange={(e) => set("header.title", e.target.value)} placeholder="Một khoảng dừng để đi tiếp." /></label>
            <label className="wide"><span>Mô tả dưới tiêu đề</span><textarea rows={2} value={data.header.description} onChange={(e) => set("header.description", e.target.value)} placeholder="Không phán xét, không áp đặt..." /></label>
          </div>
        </section>

        {/* SECTION 2: CARD FREE */}
        <section>
          <header>
            <span>02</span>
            <div>
              <h2>Card miễn phí (trái)</h2>
              <p>Buổi call 30 phút, không mất phí.</p>
            </div>
          </header>
          <div className="admin-form-grid">
            <div className="wide"><span style={{ display: "block", marginBottom: 8 }}>Ảnh card miễn phí</span><CoverUploadBox variant="landscape" title="Tải ảnh lên" hint="Ảnh nằm phía trên card" size="Khuyến nghị 1200 × 800px · 3:2" value={data.cardFree.imageUrl} onChange={(url) => set("cardFree.imageUrl", url)} /></div>
            <label><span>Alt text ảnh</span><input value={data.cardFree.imageAlt} onChange={(e) => set("cardFree.imageAlt", e.target.value)} placeholder="Mô tả ảnh cho screen reader" /></label>
            <label><span>Badge (ví dụ: MIỄN PHÍ)</span><input value={data.cardFree.badge} onChange={(e) => set("cardFree.badge", e.target.value)} placeholder="MIỄN PHÍ" /></label>
            <label><span>Eyebrow nhỏ</span><input value={data.cardFree.eyebrow} onChange={(e) => set("cardFree.eyebrow", e.target.value)} placeholder="ĐỒNG HÀNH 1:1 · 30 PHÚT" /></label>
            <label className="wide"><span>Tiêu đề card (h2)</span><input value={data.cardFree.title} onChange={(e) => set("cardFree.title", e.target.value)} placeholder="Cuộc trò chuyện đầu tiên" /></label>
            <label className="wide"><span>Mô tả</span><textarea rows={3} value={data.cardFree.description} onChange={(e) => set("cardFree.description", e.target.value)} placeholder="Một buổi call ngắn để..." /></label>
            <label><span>Bullet 1</span><input value={data.cardFree.bullet1} onChange={(e) => set("cardFree.bullet1", e.target.value)} placeholder="Call trực tuyến riêng tư cùng Tia" /></label>
            <label><span>Bullet 2</span><input value={data.cardFree.bullet2} onChange={(e) => set("cardFree.bullet2", e.target.value)} placeholder="Thời lượng 30 phút" /></label>
            <label><span>Bullet 3</span><input value={data.cardFree.bullet3} onChange={(e) => set("cardFree.bullet3", e.target.value)} placeholder="Hoàn toàn miễn phí" /></label>
            <label><span>Nút CTA (đã đăng nhập)</span><input value={data.cardFree.ctaLoggedIn} onChange={(e) => set("cardFree.ctaLoggedIn", e.target.value)} placeholder="Đặt lịch miễn phí" /></label>
            <label><span>Nút CTA (chưa đăng nhập)</span><input value={data.cardFree.ctaGuest} onChange={(e) => set("cardFree.ctaGuest", e.target.value)} placeholder="Đăng nhập để đặt lịch" /></label>
          </div>
        </section>

        {/* SECTION 3: CARD PAID */}
        <section>
          <header>
            <span>03</span>
            <div>
              <h2>Card trả phí (phải)</h2>
              <p>Gói đồng hành chuyên sâu nhiều buổi.</p>
            </div>
          </header>
          <div className="admin-form-grid">
            <div className="wide"><span style={{ display: "block", marginBottom: 8 }}>Ảnh card trả phí</span><CoverUploadBox variant="landscape" title="Tải ảnh lên" hint="Ảnh nằm phía trên card" size="Khuyến nghị 1200 × 800px · 3:2" value={data.cardPaid.imageUrl} onChange={(url) => set("cardPaid.imageUrl", url)} /></div>
            <label><span>Alt text ảnh</span><input value={data.cardPaid.imageAlt} onChange={(e) => set("cardPaid.imageAlt", e.target.value)} placeholder="Mô tả ảnh cho screen reader" /></label>
            <label><span>Badge (ví dụ: THEO GÓI)</span><input value={data.cardPaid.badge} onChange={(e) => set("cardPaid.badge", e.target.value)} placeholder="THEO GÓI" /></label>
            <label><span>Eyebrow nhỏ</span><input value={data.cardPaid.eyebrow} onChange={(e) => set("cardPaid.eyebrow", e.target.value)} placeholder="ĐỒNG HÀNH 1:1 · CHUYÊN SÂU" /></label>
            <label className="wide"><span>Tiêu đề card (h2)</span><input value={data.cardPaid.title} onChange={(e) => set("cardPaid.title", e.target.value)} placeholder="Đi cùng bạn trên một chặng" /></label>
            <label className="wide"><span>Mô tả</span><textarea rows={3} value={data.cardPaid.description} onChange={(e) => set("cardPaid.description", e.target.value)} placeholder="Chương trình đồng hành trả phí..." /></label>
            <label><span>Bullet 1</span><input value={data.cardPaid.bullet1} onChange={(e) => set("cardPaid.bullet1", e.target.value)} placeholder="Nhiều buổi call theo lộ trình riêng" /></label>
            <label><span>Bullet 2</span><input value={data.cardPaid.bullet2} onChange={(e) => set("cardPaid.bullet2", e.target.value)} placeholder="Kế hoạch hành động sau mỗi buổi" /></label>
            <label><span>Bullet 3</span><input value={data.cardPaid.bullet3} onChange={(e) => set("cardPaid.bullet3", e.target.value)} placeholder="Theo dõi tiến độ giữa các buổi" /></label>
            <label><span>Nút CTA</span><input value={data.cardPaid.cta} onChange={(e) => set("cardPaid.cta", e.target.value)} placeholder="Đặt lịch riêng ở Zalo" /></label>
          </div>
        </section>

        <footer>
          <button type="button" className="secondary" onClick={onBack}>Huỷ</button>
          <button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu lên Firestore"}</button>
        </footer>
      </form>
    </div>
  );
}

// ─── EXISTING COMPONENTS (UNCHANGED) ─────────────────────────────────────────

function PageHeader({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <header className="admin-page-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <button onClick={onAction}><AdminIcon name="plus" />{action}</button>}</header>;
}

function Status({ children }: { children: string }) {
  const tone = children.includes("Đã") || children === "Đang bán" ? "success" : children.includes("Chờ") ? "waiting" : "neutral";
  return <span className={`admin-status ${tone}`}>{children}</span>;
}

function Overview({ setSection }: { setSection: (section: AdminSection) => void }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [bookings, setBookings] = useState<{ id: string; name: string; email: string; date: string; status: string; createdAt: string }[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [newMembers, setNewMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const monthStart = adminToday().slice(0, 8) + "01";
    Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "bookings")),
      getDocs(collection(db, "users")),
    ])
      .then(([orderSnap, bookingSnap, userSnap]) => {
        setOrders(orderSnap.docs.map((d) => ({ ...(d.data() as AdminOrder), code: d.id })));
        setBookings(bookingSnap.docs.map((d) => { const data = d.data(); return { id: d.id, name: data.name || "", email: data.email || "", date: data.date || "", status: data.status || "", createdAt: data.createdAt || "" }; }));
        setMemberCount(userSnap.size);
        setNewMembers(userSnap.docs.filter((d) => String(d.data().createdAt || "") >= monthStart).length);
      })
      .catch((err) => setError(`Không tải được số liệu (mã lỗi: ${(err as { code?: string }).code || "unknown"}).`))
      .finally(() => setLoading(false));
  }, []);

  const today = adminToday();
  const monthPrefix = today.slice(0, 7);
  // Tuần hiện tại: thứ 2 → chủ nhật
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const weekStart = iso(monday);
  const weekEnd = iso(sunday);

  const paidOrders = orders.filter((order) => order.status === "Đã xác nhận" && order.amount > 0);
  const monthRevenue = paidOrders.filter((order) => (order.confirmedAt || order.createdAt).slice(0, 7) === monthPrefix).reduce((sum, order) => sum + order.amount, 0);
  const pendingOrders = orders.filter((order) => order.status === "Chờ xác nhận").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pendingBookings = bookings.filter((booking) => booking.status === "Chờ xác nhận" && booking.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const weekBookings = bookings.filter((booking) => booking.status !== "Đã huỷ" && booking.date >= weekStart && booking.date <= weekEnd);

  // Sản phẩm bán chạy: đếm theo đơn đã xác nhận
  const productSales = Object.values(paidOrders.reduce<Record<string, { title: string; count: number; revenue: number }>>((acc, order) => {
    const item = acc[order.productId] || { title: order.productTitle, count: 0, revenue: 0 };
    item.count += 1;
    item.revenue += order.amount;
    acc[order.productId] = item;
    return acc;
  }, {})).sort((a, b) => b.count - a.count).slice(0, 5);

  // Hoạt động gần đây: đơn hàng + lịch call mới nhất
  const activities = [
    ...orders.map((order) => ({ key: `o-${order.code}`, time: order.createdAt, text: `${order.name} đặt mua ${order.productTitle}`, status: order.status })),
    ...bookings.map((booking) => ({ key: `b-${booking.id}`, time: booking.createdAt, text: `${booking.name} đặt lịch call ${adminDateLabel(booking.date)}`, status: booking.status })),
  ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);

  const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
  const metrics: [string, string, string][] = [
    ["Doanh thu tháng", loading ? "…" : money(monthRevenue), `${paidOrders.filter((o) => (o.confirmedAt || o.createdAt).slice(0, 7) === monthPrefix).length} đơn đã xác nhận trong tháng`],
    ["Đơn chờ xác nhận", loading ? "…" : String(pendingOrders.length), pendingOrders.length ? "Đối soát sao kê và xác nhận" : "Không có đơn mới"],
    ["Thành viên", loading || memberCount === null ? "…" : String(memberCount), newMembers ? `+${newMembers} thành viên mới tháng này` : "Chưa có thành viên mới tháng này"],
    ["Lịch call tuần này", loading ? "…" : String(weekBookings.length), pendingBookings.length ? `${pendingBookings.length} lịch chờ xác nhận` : "Không có lịch chờ"],
  ];
  const emptyStyle: React.CSSProperties = { padding: "24px 20px", color: "var(--c-text-2, #888)", fontSize: "0.9rem" };
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: "0.92rem" };

  return <>
    <PageHeader eyebrow="TIAHERE ADMIN" title="Chào Tia." description="Đây là tổng quan không gian tiahere của bạn." />
    {error && <div style={errorBoxStyle}>{error}</div>}
    <section className="admin-metrics">
      {metrics.map(([label, value, note], index) => <article key={label}><span className={`metric-icon tone-${index + 1}`}><AdminIcon name={["analytics", "orders", "members", "meetings"][index] as IconName} /></span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}
    </section>
    <div className="admin-dashboard-grid">
      <section className="admin-panel pending-panel"><header><div><span>VIỆC CẦN LÀM</span><h2>Chờ bạn xử lý</h2></div><button onClick={() => setSection(pendingOrders.length || !pendingBookings.length ? "orders" : "meetings")}>Xem tất cả <AdminIcon name="arrow" size={15} /></button></header>
        {loading ? <p style={emptyStyle}>Đang tải...</p>
          : pendingOrders.length + pendingBookings.length === 0 ? <p style={emptyStyle}>Chưa có việc cần xử lý.</p>
          : <div>
            {pendingOrders.slice(0, 5).map((order) => <div key={order.code} style={{ ...rowStyle, cursor: "pointer" }} onClick={() => setSection("orders")}><span><strong>Đơn {order.code}</strong> · {order.name} · {order.productTitle}</span><strong>{order.priceLabel}</strong></div>)}
            {pendingBookings.slice(0, 5).map((booking) => <div key={booking.id} style={{ ...rowStyle, cursor: "pointer" }} onClick={() => setSection("meetings")}><span><strong>Lịch call</strong> · {booking.name}</span><span>{adminDateLabel(booking.date)}</span></div>)}
          </div>}
      </section>
      <section className="admin-panel"><header><div><span>SẢN PHẨM</span><h2>Bán chạy</h2></div></header>
        {loading ? <p style={emptyStyle}>Đang tải...</p>
          : productSales.length === 0 ? <p style={emptyStyle}>Chưa có đơn nào được xác nhận.</p>
          : <div>{productSales.map((item) => <div key={item.title} style={rowStyle}><span>{item.title}</span><span><strong>{item.count}</strong> đơn · {money(item.revenue)}</span></div>)}</div>}
      </section>
      <section className="admin-panel activity-panel"><header><div><span>HOẠT ĐỘNG</span><h2>Gần đây</h2></div></header>
        {loading ? <p style={emptyStyle}>Đang tải...</p>
          : activities.length === 0 ? <p style={emptyStyle}>Chưa có hoạt động nào.</p>
          : <div>{activities.map((item) => <div key={item.key} style={rowStyle}><span>{item.text}<br /><small style={{ opacity: 0.65 }}>{adminTimeLabel(item.time)}</small></span><Status>{item.status}</Status></div>)}</div>}
      </section>
    </div>
  </>;
}

// Xoá sản phẩm: hỏi lại, cảnh báo nếu đã có người mua / có đơn hàng
async function deleteProductFlow(product: { id: string; name: string; buyers?: number }): Promise<boolean> {
  let orderCount = 0;
  try { orderCount = (await getDocs(query(collection(db, "orders"), where("productId", "==", product.id)))).size; } catch { /* vẫn cho xoá */ }
  const buyers = product.buyers || 0;
  const warn = buyers > 0 || orderCount > 0
    ? `\n\nSản phẩm này đã có ${buyers} người mua và ${orderCount} đơn hàng. Người đã mua sẽ mất sản phẩm khỏi trang cá nhân. Nên chuyển sang trạng thái "Tạm ẩn" thay vì xoá.`
    : "";
  if (!window.confirm(`Xoá vĩnh viễn "${product.name}"? Không thể hoàn tác.${warn}`)) return false;
  try {
    await deleteDoc(doc(db, "products", product.id));
    await deleteDoc(doc(db, "ebooks", product.id)).catch(() => {});
    return true;
  } catch (err) {
    window.alert(`Chưa xoá được (mã lỗi: ${(err as { code?: string }).code || "unknown"}).`);
    return false;
  }
}

function ProductsPage({ products, onAdd, onEdit, onDeleted }: { products: typeof initialProducts; onAdd: () => void; onEdit: (product: (typeof initialProducts)[number]) => void; onDeleted?: (id: string) => void }) {
  const [filter, setFilter] = useState("Tất cả");
  const visible = products.filter((product) => filter === "Tất cả" || product.type === filter);
  return <>
    <PageHeader eyebrow="CATALOG" title="Sản phẩm" description="Quản lý tài liệu, công cụ, khoá học, sự kiện và dịch vụ đồng hành." action="Thêm sản phẩm" onAction={onAdd} />
    <div className="admin-filter-row">{["Tất cả", "Tài liệu", "Công cụ", "Khoá học", "Sự kiện", "Combo", "Đồng hành"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
    <section className="admin-table-card"><table><thead><tr><th>Sản phẩm</th><th>Loại</th><th>Giá</th><th>Người mua thật</th><th>Quan tâm thật</th><th>Trạng thái</th><th /></tr></thead><tbody>{visible.map((product) => <tr key={product.id}><td><div className="table-product"><span>{product.name.slice(0, 1)}</span><div><strong>{product.name}</strong><small>{product.id}</small></div></div></td><td>{product.type}</td><td><strong>{product.price}</strong></td><td>{(product.buyers || 0).toLocaleString("vi-VN")}{product.bonusBuyers ? <small style={{ display: "block", opacity: 0.6 }}>Hiển thị: {((product.type === "Khoá học" && (product.courseMode || "external") === "external" ? 0 : product.buyers || 0) + product.bonusBuyers).toLocaleString("vi-VN")}</small> : null}{product.showBuyers === false && <small style={{ display: "block", opacity: 0.6 }}>Đang ẩn</small>}</td><td>{(product.interested || 0).toLocaleString("vi-VN")}{product.showInterest === false && <small style={{ display: "block", opacity: 0.6 }}>Đang ẩn</small>}</td><td><Status>{product.status}</Status></td><td><div style={{ display: "flex", gap: 8 }}><button className="table-action" onClick={() => onEdit(product)}>Chỉnh sửa</button><button className="table-action" style={{ color: "#b3412f" }} onClick={async () => { if (await deleteProductFlow(product)) onDeleted?.(product.id); }}>Xoá</button></div></td></tr>)}</tbody></table></section>
  </>;
}

function OrdersPage({ onConfirmed }: { onConfirmed: (event: AdminEvent) => void }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Chờ xác nhận");
  const [busyCode, setBusyCode] = useState("");

  useEffect(() => {
    getDocs(collection(db, "orders"))
      .then((snapshot) => setOrders(snapshot.docs.map((d) => ({ ...(d.data() as AdminOrder), code: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch((err) => {
        console.error("Tải đơn hàng thất bại:", err);
        setError(`Không tải được đơn hàng (mã lỗi: ${(err as { code?: string }).code || "unknown"}). Kiểm tra Firestore Rules và đăng nhập Admin bằng Google.`);
      })
      .finally(() => setLoading(false));
  }, []);

  const confirmOrder = async (order: AdminOrder) => {
    if (!window.confirm(`Xác nhận đã nhận ${order.priceLabel} cho đơn ${order.code}?\n\n${order.name} (${order.email}) sẽ được mở quyền dùng "${order.productTitle}".`)) return;
    setBusyCode(order.code);
    setError("");
    try {
      const confirmedAt = new Date().toISOString();
      // Ghi cùng lúc: đơn chuyển sang "Đã xác nhận" + thêm sản phẩm vào hồ sơ user
      // Combo: mở quyền tất cả sản phẩm bên trong, mỗi sản phẩm +1 người mua
      const productSnap = await getDoc(doc(db, "products", order.productId));
      const comboItems: string[] = productSnap.exists() && Array.isArray(productSnap.data().comboItems) ? productSnap.data().comboItems : [];
      const isCombo = comboItems.length > 0;
      const batch = writeBatch(db);
      batch.update(doc(db, "orders", order.code), { status: "Đã xác nhận", confirmedAt, countedBuyer: true });
      batch.set(doc(db, "users", order.uid), { ownedProducts: isCombo ? arrayUnion(...comboItems) : arrayUnion(order.productId) }, { merge: true });
      // +1 người mua thật cho sản phẩm (cấp quyền thủ công không tính)
      batch.update(doc(db, "products", order.productId), { buyers: increment(1) });
      comboItems.forEach((id) => batch.update(doc(db, "products", id), { buyers: increment(1) }));
      await batch.commit();
      setOrders((items) => items.map((item) => item.code === order.code ? { ...item, status: "Đã xác nhận", confirmedAt } : item));
      const kind = (order as AdminOrder & { productKind?: string }).productKind || "";
      if (kind === "combo") notifyUser(order.uid, "Thanh toán đã được xác nhận", `Đơn ${order.code} - ${order.productTitle} đã được kích hoạt. Các sản phẩm trong combo đã có trong trang cá nhân của bạn.`, "#trang-ca-nhan/san-pham");
      else if (kind === "event" || kind === "course") notifyUser(order.uid, "Đăng ký đã được xác nhận", `Chỗ của bạn tại ${order.productTitle} đã được giữ. Link tham gia sẽ được gửi qua email 1 ngày trước.`, `#san-pham=${order.productId}`);
      else notifyUser(order.uid, "Thanh toán đã được xác nhận", `Đơn ${order.code} - ${order.productTitle} đã được kích hoạt. Bấm để sử dụng ngay.`, `#san-pham=${order.productId}`);
      onConfirmed({ email: order.email, title: "Thanh toán đã được xác nhận", message: `Đơn ${order.code} cho sản phẩm ${order.productTitle} đã được xác nhận. Quyền truy cập của bạn đã được mở.` });
      sendAdminEmail({ type: "order_confirmed", email: order.email, name: order.name, productName: order.productTitle });
    } catch {
      setError(`Chưa xác nhận được đơn ${order.code}. Kiểm tra kết nối và thử lại.`);
    } finally {
      setBusyCode("");
    }
  };

  const cancelOrder = async (order: AdminOrder) => {
    if (!window.confirm(`Huỷ đơn ${order.code} của ${order.name}?\n\nThành viên sẽ nhận email báo đơn đã huỷ.`)) return;
    setBusyCode(order.code);
    try {
      await updateDoc(doc(db, "orders", order.code), { status: "Đã huỷ" });
      setOrders((items) => items.map((item) => item.code === order.code ? { ...item, status: "Đã huỷ" } : item));
      notifyUser(order.uid, "Đơn hàng đã bị huỷ", `Đơn ${order.code} - ${order.productTitle} đã được huỷ. Nếu có nhầm lẫn, bạn nhắn Zalo cho Tia nhé.`, "#trang-ca-nhan/don-hang");
      sendAdminEmail({ type: "order_cancelled", email: order.email, name: order.name, productName: `${order.productTitle} (mã đơn ${order.code})` });
    } catch {
      setError(`Chưa huỷ được đơn ${order.code}.`);
    } finally {
      setBusyCode("");
    }
  };

  const visible = orders.filter((order) => filter === "Tất cả" || order.status === filter);
  return <>
    <PageHeader eyebrow="THANH TOÁN MB" title="Đơn hàng" description="Đối chiếu mã đơn với nội dung chuyển khoản trong sao kê, rồi bấm Xác nhận để mở quyền cho thành viên." />
    <div className="admin-filter-row">{["Chờ xác nhận", "Đã xác nhận", "Đã huỷ", "Tất cả"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}{item === "Chờ xác nhận" ? ` (${orders.filter((o) => o.status === item).length})` : ""}</button>)}</div>
    {error && <div style={errorBoxStyle}>{error}</div>}
    <section className="admin-table-card"><table><thead><tr><th>Mã đơn / Khách hàng</th><th>Sản phẩm</th><th>Nội dung CK</th><th>Số tiền</th><th>Trạng thái</th><th /></tr></thead><tbody>
      {loading ? <tr><td colSpan={6}>Đang tải...</td></tr>
        : visible.length === 0 ? <tr><td colSpan={6}>Không có đơn nào.</td></tr>
        : visible.map((order) => <tr key={order.code}>
          <td><div className="stacked-cell"><strong>{order.code}</strong><span>{order.name} · {order.email}</span><small>{adminTimeLabel(order.createdAt)}{order.source ? ` · ${order.source}` : ""}</small></div></td>
          <td>{order.productTitle}{order.registration && <details style={{ marginTop: 6 }}><summary style={{ cursor: "pointer", fontSize: "0.85em", opacity: 0.8 }}>Xem form đăng ký</summary><RegAnswersView answers={order.registration} /></details>}</td>
          <td><span className="transfer-message">{order.code}</span></td>
          <td><strong>{order.priceLabel}</strong></td>
          <td><Status>{order.status}</Status></td>
          <td>{order.status === "Chờ xác nhận"
            ? <div style={{ display: "flex", gap: 8 }}><button className="confirm-button" disabled={busyCode === order.code} onClick={() => confirmOrder(order)}><AdminIcon name="check" size={15} />{busyCode === order.code ? "Đang lưu..." : "Xác nhận"}</button><button className="table-action" disabled={busyCode === order.code} onClick={() => cancelOrder(order)}>Huỷ</button></div>
            : order.confirmedAt ? <small>{adminTimeLabel(order.confirmedAt)}</small> : null}</td>
        </tr>)}
    </tbody></table></section>
  </>;
}

// ── Người đăng ký sự kiện / khoá học tự tổ chức ──
type RegOrder = AdminOrder & { registration?: Record<string, string | boolean>; refundStatus?: string };
const REG_LABELS: Record<string, string> = {
  phone: "SĐT", expect: "Mong đợi", question: "Câu hỏi cho Tia", wishBefore: "Trước khoá học", wishAfter: "Mong muốn sau khoá học",
  reason: "Lý do đăng ký", commit: "Cam kết", bankName: "Ngân hàng", bankNumber: "Số TK", bankHolder: "Chủ TK",
};
// Hiển thị câu trả lời form đăng ký (dùng trong trang Đơn hàng)
function RegAnswersView({ answers }: { answers: Record<string, string | boolean> }) {
  const keys = Object.keys(answers).sort((a, b) => Object.keys(REG_LABELS).indexOf(a) - Object.keys(REG_LABELS).indexOf(b));
  return <dl style={{ margin: "8px 0 0", fontSize: "0.85em", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px" }}>
    {keys.map((k) => <Fragment key={k}><dt style={{ opacity: 0.65 }}>{REG_LABELS[k] || k}</dt><dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{answers[k] === true ? "Có" : answers[k] === false ? "Không" : String(answers[k])}</dd></Fragment>)}
  </dl>;
}
const REFUND_STATES = ["Chưa xét", "Đủ điều kiện", "Không đủ điều kiện", "Đã hoàn tiền"];
function RegistrationsPage({ products }: { products: (typeof initialProducts)[number][] }) {
  const regProducts = products.filter((p) => p.type === "Sự kiện" || (p.type === "Khoá học" && p.courseMode && p.courseMode !== "external"));
  const [productId, setProductId] = useState(regProducts[0]?.id || "");
  const [orders, setOrders] = useState<RegOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const product = regProducts.find((p) => p.id === productId);
  const refund = product?.courseMode === "refund";
  useEffect(() => {
    if (!productId && regProducts[0]) setProductId(regProducts[0].id);
  }, [regProducts, productId]);
  useEffect(() => {
    if (!productId) return;
    setLoading(true); setError("");
    getDocs(query(collection(db, "orders"), where("productId", "==", productId)))
      .then((snap) => setOrders(snap.docs.map((d) => ({ ...(d.data() as RegOrder), code: d.id })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))))
      .catch(() => setError("Không tải được danh sách đăng ký. Kiểm tra kết nối và thử lại."))
      .finally(() => setLoading(false));
  }, [productId]);
  const list = orders.filter((o) => o.status !== "Đã huỷ" && (!onlyConfirmed || o.status === "Đã xác nhận"));
  const keys = Array.from(new Set(list.flatMap((o) => Object.keys(o.registration || {})))).sort((a, b) => Object.keys(REG_LABELS).indexOf(a) - Object.keys(REG_LABELS).indexOf(b));
  const show = (v: unknown) => (v === true ? "Có" : v === false ? "Không" : String(v ?? ""));
  const copyEmails = () => {
    navigator.clipboard?.writeText(Array.from(new Set(list.map((o) => o.email))).join(", "));
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };
  const downloadCsv = () => {
    const head = ["Họ tên", "Email", "Trạng thái", "Mã đơn", "Ngày đăng ký", ...keys.map((k) => REG_LABELS[k] || k), ...(refund ? ["Hoàn tiền"] : [])];
    const rows = list.map((o) => [o.name, o.email, o.status, o.code, o.createdAt.slice(0, 10), ...keys.map((k) => show(o.registration?.[k])), ...(refund ? [o.refundStatus || "Chưa xét"] : [])]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `dang-ky-${(product?.name || productId).replace(/\s+/g, "-")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const setRefund = async (order: RegOrder, value: string) => {
    try {
      await updateDoc(doc(db, "orders", order.code), { refundStatus: value });
      setOrders((items) => items.map((o) => (o.code === order.code ? { ...o, refundStatus: value } : o)));
    } catch { setError(`Chưa lưu được trạng thái hoàn tiền cho ${order.name}.`); }
  };
  return <>
    <PageHeader eyebrow="SỰ KIỆN & KHOÁ HỌC" title="Người đăng ký" description="Danh sách người đăng ký và câu trả lời form của từng sự kiện / khoá học tự tổ chức." />
    {regProducts.length === 0 ? <section className="admin-table-card" style={{ padding: 24 }}>Chưa có sự kiện hoặc khoá học tự tổ chức nào. Tạo trong mục Sản phẩm trước nhé.</section> : <>
      <section className="admin-table-card" style={{ padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ minWidth: 260, padding: "8px 10px", borderRadius: 10 }}>
          {regProducts.map((p) => <option key={p.id} value={p.id}>{p.type === "Sự kiện" ? "Sự kiện" : "Khoá học"}: {p.name}{p.eventDate ? ` (${p.eventDate.split("-").reverse().join("/")})` : ""}</option>)}
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={onlyConfirmed} onChange={(e) => setOnlyConfirmed(e.target.checked)} /> Chỉ người đã xác nhận</label>
        <strong>{list.length} người</strong>
        <span style={{ flex: 1 }} />
        <button className="table-action" onClick={copyEmails} disabled={!list.length}>{copied ? "Đã copy" : "Copy danh sách email"}</button>
        <button className="table-action" onClick={downloadCsv} disabled={!list.length}>Tải file CSV</button>
      </section>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <section className="admin-table-card" style={{ overflowX: "auto" }}><table><thead><tr><th>Người đăng ký</th><th>Trạng thái</th>{keys.map((k) => <th key={k}>{REG_LABELS[k] || k}</th>)}{refund && <th>Hoàn tiền</th>}</tr></thead><tbody>
        {loading ? <tr><td colSpan={3 + keys.length}>Đang tải...</td></tr>
          : list.length === 0 ? <tr><td colSpan={3 + keys.length}>Chưa có người đăng ký.</td></tr>
          : list.map((o) => <tr key={o.code}>
            <td><div className="stacked-cell"><strong>{o.name}</strong><span>{o.email}</span><small>{o.code} · {adminTimeLabel(o.createdAt)}</small></div></td>
            <td><Status>{o.status}</Status></td>
            {keys.map((k) => <td key={k} style={{ whiteSpace: "pre-wrap", minWidth: 140, maxWidth: 280 }}>{show(o.registration?.[k])}</td>)}
            {refund && <td><select value={o.refundStatus || "Chưa xét"} onChange={(e) => setRefund(o, e.target.value)}>{REFUND_STATES.map((st) => <option key={st}>{st}</option>)}</select></td>}
          </tr>)}
      </tbody></table></section>
    </>}
  </>;
}

function MeetingsPage({ onBlock, onConfirmed, onNote }: { onBlock: () => void; onConfirmed: (event: AdminEvent) => void; onNote: (meeting: (typeof initialMeetings)[number]) => void }) {
  const [meetings, setMeetings] = useState<(typeof initialMeetings)>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Sắp tới");
  const today = adminToday();

  useEffect(() => {
    getDocs(collection(db, "bookings"))
      .then((snapshot) => setMeetings(snapshot.docs.map((d) => {
        const data = d.data();
        return { id: d.id, uid: data.uid || "", name: data.name || "", email: data.email || "", date: data.date || "", issue: data.issue || "", topic: data.topic || "", plan: "Miễn phí · 30 phút", status: data.status || "Chờ xác nhận", meetUrl: data.meetUrl || "", phone: data.phone || "" };
      }).sort((a, b) => a.date.localeCompare(b.date))))
      .catch(() => setError("Không tải được lịch call. Kiểm tra Firestore Rules và đăng nhập đúng email admin."))
      .finally(() => setLoading(false));
  }, []);

  const update = (id: string, patch: Partial<(typeof initialMeetings)[number]>) => setMeetings((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  const confirmMeeting = async (meeting: (typeof initialMeetings)[number]) => {
    try {
      await updateDoc(doc(db, "bookings", meeting.id), { status: "Đã xác nhận", confirmedAt: new Date().toISOString() });
      update(meeting.id, { status: "Đã xác nhận" });
      const dateLabel = adminDateLabel(meeting.date, true);
      notifyUser(meeting.uid, "Lịch call đã được xác nhận", `Hẹn gặp bạn ${dateLabel} lúc 20:30-21:00. Link Google Meet sẽ được gửi trước giờ call.`, "#trang-ca-nhan/lich-call");
      onConfirmed({ email: meeting.email, title: "Lịch Đồng hành 1:1 đã được xác nhận", message: `Lịch ${dateLabel} lúc 20:30–21:00 đã được Tia xác nhận. Link Google Meet sẽ được cập nhật trước giờ call.` });
      sendAdminEmail({ type: "booking_confirmed", email: meeting.email, name: meeting.name, date: dateLabel, time: "20:30–21:00" });
    } catch {
      setError("Chưa xác nhận được lịch. Thử lại nhé.");
    }
  };

  const cancelMeeting = async (meeting: (typeof initialMeetings)[number]) => {
    if (!window.confirm(`Huỷ lịch ngày ${adminDateLabel(meeting.date)} của ${meeting.name}? Ngày này sẽ mở lại cho người khác đặt.\n\nThành viên sẽ nhận email báo lịch đã huỷ.`)) return;
    try {
      await updateDoc(doc(db, "bookings", meeting.id), { status: "Đã huỷ" });
      await deleteDoc(doc(db, "slots", meeting.date)).catch(() => {});
      update(meeting.id, { status: "Đã huỷ" });
      // Tuỳ chọn: cho người này đặt lại 1 buổi khác (gỡ khoá số Zalo và tài khoản)
      if (window.confirm(`Cho phép ${meeting.name} đặt lại 1 buổi khác?\n\nBấm OK nếu buổi bị huỷ không phải lỗi của họ. Bấm Cancel để giữ quy định mỗi người 1 buổi.`)) {
        if (meeting.phone) await deleteDoc(doc(db, "bookingPhones", meeting.phone)).catch(() => {});
        if (meeting.uid) await deleteDoc(doc(db, "bookingUsers", meeting.uid)).catch(() => {});
      }
      notifyUser(meeting.uid, "Lịch call đã bị huỷ", `Lịch ngày ${adminDateLabel(meeting.date)} đã được huỷ. Bạn có thể nhắn Zalo cho Tia để hẹn lại.`, "#trang-ca-nhan/lich-call");
      sendAdminEmail({ type: "booking_cancelled", email: meeting.email, name: meeting.name, date: adminDateLabel(meeting.date, true), time: "20:30–21:00" });
    } catch {
      setError("Chưa huỷ được lịch. Thử lại nhé.");
    }
  };

  const addMeetUrl = async (meeting: (typeof initialMeetings)[number]) => {
    const url = window.prompt("Dán link Google Meet cho buổi này (thành viên sẽ nhận email kèm link):", meeting.meetUrl || "https://meet.google.com/");
    if (!url || !/^https:\/\/\S+$/i.test(url.trim())) return;
    try {
      await updateDoc(doc(db, "bookings", meeting.id), { meetUrl: url.trim() });
      update(meeting.id, { meetUrl: url.trim() });
      notifyUser(meeting.uid, "Đã có link Google Meet", `Link cho buổi call ${adminDateLabel(meeting.date)} đã sẵn sàng. Bấm để xem.`, "#trang-ca-nhan/lich-call");
      sendAdminEmail({ type: "meet_link", email: meeting.email, name: meeting.name, date: adminDateLabel(meeting.date, true), time: "20:30–21:00", meetUrl: url.trim() });
    } catch {
      setError("Chưa lưu được link Meet.");
    }
  };

  const visible = meetings.filter((meeting) => filter === "Tất cả" || (meeting.date >= today && meeting.status !== "Đã huỷ"));
  return <>
    <PageHeader eyebrow="ĐỒNG HÀNH 1:1" title="Lịch call meeting" description="Tia nhận lịch thứ 3, thứ 5 và thứ 6 lúc 20:30–21:00." action="Chặn khung giờ" onAction={onBlock} />
    <div className="admin-filter-row">{["Sắp tới", "Tất cả"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
    {error && <div style={errorBoxStyle}>{error}</div>}
    {loading ? <p>Đang tải...</p> : visible.length === 0 ? <p style={{ padding: "24px 4px", opacity: 0.7 }}>Chưa có lịch call nào.</p> : (
      <section className="meeting-admin-grid">{visible.map((meeting) => <article key={meeting.id}>
        <time><strong>{meeting.date.slice(8, 10)}</strong><span>THÁNG {Number(meeting.date.slice(5, 7))}</span></time>
        <div><Status>{meeting.status}</Status><h2>{meeting.name}</h2><p>{meeting.email}{meeting.phone && <> · Zalo: <a href={`https://zalo.me/${meeting.phone}`} target="_blank" rel="noopener noreferrer">{meeting.phone}</a></>}</p><small>{meeting.issue}{meeting.topic ? ` · ${meeting.topic}` : ""}</small></div>
        <aside><strong>{adminDateLabel(meeting.date, true)}</strong><span>20:30–21:00 · {meeting.meetUrl ? <a href={meeting.meetUrl} target="_blank" rel="noopener noreferrer">Google Meet</a> : "Chưa có link Meet"}</span>
          <div className="meeting-actions">
            {meeting.status === "Chờ xác nhận" && <button onClick={() => confirmMeeting(meeting)}>Xác nhận lịch</button>}
            {meeting.status === "Đã xác nhận" && <button className="secondary" onClick={() => addMeetUrl(meeting)}>{meeting.meetUrl ? "Sửa Meet URL" : "Thêm Meet URL"}</button>}
            {meeting.status !== "Đã huỷ" && <button className="secondary" onClick={() => cancelMeeting(meeting)}>Huỷ lịch</button>}
            <button className="note-action" onClick={() => onNote(meeting)}>Ghi note</button>
          </div>
        </aside>
      </article>)}</section>
    )}
  </>;
}

type AdminMember = { uid: string; name: string; email: string; age?: string; gender?: string; location?: string; careerProfiles?: string[]; emailUpdates?: boolean; createdAt?: string; ownedProducts?: string[] };

// ---------- Báo cáo chân dung thành viên ----------
type MemberPeriod = "7" | "30" | "month" | "all" | "custom";

function MemberBreakdown({ title, rows, total, note }: { title: string; rows: { label: string; count: number; buyers: number }[]; total: number; note?: string }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  const ink2 = "var(--c-text-2, #7a6a66)";
  return (
    <section className="admin-panel" style={{ minWidth: 0 }}>
      <header><div><span>{title.toUpperCase()}</span><h2>{title}</h2></div></header>
      <div style={{ padding: "4px 20px 18px" }}>
        {rows.length === 0 ? <p style={{ color: ink2, fontSize: "0.9rem" }}>Chưa có dữ liệu.</p> : rows.map((row) => {
          const pct = total ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.label} title={`${row.label}: ${row.count} người (${pct}%) · ${row.buyers} đã mua`} style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.88rem" }}>
                <span>{row.label}</span>
                <span><strong>{row.count}</strong> <span style={{ color: ink2 }}>· {pct}% · {row.buyers} đã mua</span></span>
              </div>
              <div style={{ height: 8, marginTop: 6, background: "rgba(0,0,0,0.06)", borderRadius: 4 }}>
                <div style={{ width: `${(row.count / max) * 100}%`, height: "100%", background: "var(--admin-accent, #b9787a)", borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
        {note && <p style={{ margin: "12px 0 0", fontSize: "0.8rem", color: ink2 }}>{note}</p>}
      </div>
    </section>
  );
}

function MemberReport({ members }: { members: AdminMember[] }) {
  const total = members.length;
  const isBuyer = (member: AdminMember) => (member.ownedProducts || []).length > 0;
  const buyers = members.filter(isBuyer).length;
  const UNKNOWN = "Chưa cập nhật";

  // Đếm theo một tiêu chí; giữ thứ tự cố định nếu có, nhóm "Chưa cập nhật" luôn ở cuối
  const countBy = (pick: (member: AdminMember) => string[], order?: string[], limit?: number) => {
    const map: Record<string, { count: number; buyers: number }> = {};
    members.forEach((member) => {
      const values = pick(member).filter(Boolean);
      (values.length ? values : [UNKNOWN]).forEach((value) => {
        map[value] = map[value] || { count: 0, buyers: 0 };
        map[value].count += 1;
        if (isBuyer(member)) map[value].buyers += 1;
      });
    });
    let rows = Object.entries(map).map(([label, value]) => ({ label, ...value }));
    if (order) rows.sort((a, b) => (order.indexOf(a.label) === -1 ? 99 : order.indexOf(a.label)) - (order.indexOf(b.label) === -1 ? 99 : order.indexOf(b.label)));
    else rows.sort((a, b) => b.count - a.count);
    rows = [...rows.filter((row) => row.label !== UNKNOWN), ...rows.filter((row) => row.label === UNKNOWN)];
    if (limit && rows.length > limit) {
      const kept = rows.slice(0, limit);
      const rest = rows.slice(limit);
      kept.push({ label: `Khác (${rest.length} nơi)`, count: rest.reduce((sum, row) => sum + row.count, 0), buyers: rest.reduce((sum, row) => sum + row.buyers, 0) });
      rows = kept;
    }
    return rows;
  };

  const ageRows = countBy((m) => [m.age || ""], ["Dưới 18", "18–22", "23–27", "28–32", "33+"]);
  const careerRows = countBy((m) => m.careerProfiles || [], ["Sinh viên", "Người đi làm", "Người muốn chuyển lĩnh vực", "Người muốn chuyển hình thức làm việc"]);
  const genderRows = countBy((m) => [m.gender || ""], ["Nữ", "Nam", "Không chia sẻ"]);
  const locationRows = countBy((m) => [m.location || ""], undefined, 8);
  const purchaseRows = [
    { label: "Đã mua sản phẩm", count: buyers, buyers },
    { label: "Chưa mua", count: total - buyers, buyers: 0 },
  ];

  return (
    <>
      <section className="admin-metrics" style={{ marginBottom: 16 }}>
        {([
          ["Thành viên mới", String(total), "Trong khoảng đang xem"],
          ["Đã mua sản phẩm", String(buyers), total ? `${Math.round((buyers / total) * 100)}% thành viên` : "—"],
          ["Nhóm tuổi đông nhất", ageRows.find((r) => r.label !== UNKNOWN)?.label || "—", ageRows.find((r) => r.label !== UNKNOWN) ? `${[...ageRows].filter((r) => r.label !== UNKNOWN).sort((a, b) => b.count - a.count)[0].count} người` : ""],
          ["Định hướng phổ biến", [...careerRows].filter((r) => r.label !== UNKNOWN).sort((a, b) => b.count - a.count)[0]?.label || "—", ""],
        ] as [string, string, string][]).map(([label, value, note], index) => (
          <article key={label}><span className={`metric-icon tone-${index + 1}`}><AdminIcon name="members" /></span><p>{label}</p><strong style={{ fontSize: value.length > 12 ? "1.05rem" : undefined }}>{value}</strong><small>{note}</small></article>
        ))}
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
        <MemberBreakdown title="Độ tuổi" rows={ageRows} total={total} />
        <MemberBreakdown title="Nghề nghiệp / định hướng" rows={careerRows} total={total} note="Một người có thể chọn nhiều định hướng, nên tổng % có thể lớn hơn 100%." />
        <MemberBreakdown title="Giới tính" rows={genderRows} total={total} />
        <MemberBreakdown title="Khu vực sống" rows={locationRows} total={total} />
        <MemberBreakdown title="Mua sản phẩm" rows={purchaseRows} total={total} note="Cột 'đã mua' ở các khung khác cho biết nhóm nào mua nhiều nhất." />
      </div>
    </>
  );
}

function MembersPage({ products }: { products: (typeof initialProducts) }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [openUid, setOpenUid] = useState("");
  const [period, setPeriod] = useState<MemberPeriod>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showReport, setShowReport] = useState(true);
  const productName = (id: string) => products.find((item) => item.id === id)?.name || "Sản phẩm đã xoá";

  // Khoảng thời gian theo ngày đăng ký (YYYY-MM-DD)
  const today = adminToday();
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const from = period === "7" ? daysAgo(7) : period === "30" ? daysAgo(30) : period === "month" ? today.slice(0, 8) + "01" : period === "custom" ? (customFrom || "0000-01-01") : "0000-01-01";
  const to = period === "custom" ? (customTo || today) : "9999-12-31";
  const inPeriod = (member: AdminMember) => period === "all" || (Boolean(member.createdAt) && String(member.createdAt).slice(0, 10) >= from && String(member.createdAt).slice(0, 10) <= to);
  const periodLabel = period === "7" ? "7 ngày gần nhất" : period === "30" ? "30 ngày gần nhất" : period === "month" ? "tháng này" : period === "all" ? "toàn bộ thời gian" : `từ ${customFrom ? adminDateLabel(customFrom) : "đầu"} đến ${adminDateLabel(customTo || today)}`;

  useEffect(() => {
    getDocs(collection(db, "users"))
      .then((snapshot) => setMembers(snapshot.docs
        .map((d) => ({ ...(d.data() as AdminMember), uid: d.id }))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))))
      .catch((err) => setError(`Không tải được thành viên (mã lỗi: ${(err as { code?: string }).code || "unknown"}).`))
      .finally(() => setLoading(false));
  }, []);

  const keyword = search.trim().toLowerCase();
  const periodMembers = members.filter(inPeriod);
  const visible = periodMembers.filter((member) => !keyword || `${member.name} ${member.email} ${member.location || ""}`.toLowerCase().includes(keyword));
  const buyers = members.filter((member) => (member.ownedProducts || []).length > 0).length;

  return <>
    <PageHeader eyebrow="CỘNG ĐỒNG" title="Thành viên" description={loading ? "Đang tải..." : `${members.length} thành viên · ${buyers} người đã sở hữu sản phẩm.`} />
    {error && <div style={errorBoxStyle}>{error}</div>}
    <div className="analytics-period">
      <div>{([["7", "7 ngày"], ["30", "30 ngày"], ["month", "Tháng này"], ["all", "Tất cả"], ["custom", "Lựa chọn"]] as [MemberPeriod, string][]).map(([value, label]) => <button key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{label}</button>)}</div>
      {period === "custom" && <section><label><span>Từ ngày</span><input type="date" value={customFrom} max={customTo || today} onChange={(e) => setCustomFrom(e.target.value)} /></label><i>—</i><label><span>Đến ngày</span><input type="date" value={customTo} min={customFrom} max={today} onChange={(e) => setCustomTo(e.target.value)} /></label></section>}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, margin: "8px 0 12px", flexWrap: "wrap" }}>
      <p style={{ margin: 0, color: "var(--c-text-2, #7a6a66)", fontSize: "0.9rem" }}>Báo cáo thành viên đăng ký trong <strong>{periodLabel}</strong>{period !== "all" ? " (tính theo ngày đăng ký)" : ""}.</p>
      <button className="table-action" onClick={() => setShowReport((v) => !v)}>{showReport ? "Ẩn báo cáo" : "Hiện báo cáo"}</button>
    </div>
    {showReport && !loading && <MemberReport members={periodMembers} />}
    <div style={{ marginBottom: 16 }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên, email, khu vực..." style={{ width: "100%", maxWidth: 420, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", font: "inherit" }} /></div>
    <section className="admin-table-card"><table><thead><tr><th>Thành viên</th><th>Nghề nghiệp / định hướng</th><th>Khu vực</th><th>Sản phẩm</th><th>Ngày tham gia</th><th /></tr></thead><tbody>
      {loading ? <tr><td colSpan={6}>Đang tải...</td></tr>
        : visible.length === 0 ? <tr><td colSpan={6}>Không có thành viên nào đăng ký trong khoảng này.</td></tr>
        : visible.map((member) => <Fragment key={member.uid}>
          <tr>
            <td><div className="member-cell"><span>{(member.name || member.email || "?").slice(0, 2).toUpperCase()}</span><div><strong>{member.name || "(chưa có tên)"}</strong><small>{member.email}</small></div></div></td>
            <td>{(member.careerProfiles || []).join(", ") || "—"}</td>
            <td>{member.location || "—"}</td>
            <td>{(member.ownedProducts || []).length}</td>
            <td>{member.createdAt ? adminDateLabel(member.createdAt) : "—"}</td>
            <td><button className="table-action" onClick={() => setOpenUid(openUid === member.uid ? "" : member.uid)}>{openUid === member.uid ? "Thu gọn" : "Xem hồ sơ"}</button></td>
          </tr>
          {openUid === member.uid && <tr><td colSpan={6} style={{ background: "rgba(0,0,0,0.025)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, padding: "6px 4px" }}>
              <div><small style={{ opacity: 0.6 }}>Độ tuổi</small><div>{member.age || "—"}</div></div>
              <div><small style={{ opacity: 0.6 }}>Giới tính</small><div>{member.gender || "—"}</div></div>
              <div><small style={{ opacity: 0.6 }}>Nhận email ấn phẩm mới</small><div>{member.emailUpdates === undefined ? "—" : member.emailUpdates ? "Có" : "Không"}</div></div>
              <div><small style={{ opacity: 0.6 }}>Sản phẩm đã sở hữu</small><div>{(member.ownedProducts || []).length ? (member.ownedProducts || []).map(productName).join(", ") : "Chưa có"}</div></div>
            </div>
          </td></tr>}
        </Fragment>)}
    </tbody></table></section>
  </>;
}

// ---------- Quyền truy cập: ai đang sở hữu sản phẩm nào
function AccessPage({ products, onGrant }: { products: (typeof initialProducts); onGrant: () => void }) {
  const [rows, setRows] = useState<{ uid: string; name: string; email: string; productId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const productName = (id: string) => products.find((item) => item.id === id)?.name || "Sản phẩm đã xoá";

  useEffect(() => {
    getDocs(collection(db, "users"))
      .then((snapshot) => setRows(snapshot.docs.flatMap((d) => {
        const data = d.data();
        return (Array.isArray(data.ownedProducts) ? data.ownedProducts : []).map((productId: string) => ({ uid: d.id, name: data.name || "", email: data.email || "", productId }));
      })))
      .catch((err) => setError(`Không tải được quyền truy cập (mã lỗi: ${(err as { code?: string }).code || "unknown"}).`))
      .finally(() => setLoading(false));
  }, []);

  const revoke = async (row: { uid: string; name: string; email: string; productId: string }) => {
    if (!window.confirm(`Thu hồi quyền dùng "${productName(row.productId)}" của ${row.name || row.email}?\n\nThành viên sẽ không mở được sản phẩm này nữa. Đơn hàng cũ vẫn giữ nguyên.`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", row.uid), { ownedProducts: arrayRemove(row.productId) });
      // Nếu quyền này đến từ đơn mua đã được đếm → trừ lại 1 người mua thật
      const paid = await getDocs(query(collection(db, "orders"), where("uid", "==", row.uid), where("productId", "==", row.productId)));
      paid.docs.filter((d) => d.data().countedBuyer === true).forEach((d) => {
        batch.update(d.ref, { countedBuyer: false });
        batch.update(doc(db, "products", row.productId), { buyers: increment(-1) });
      });
      await batch.commit();
      setRows((items) => items.filter((item) => !(item.uid === row.uid && item.productId === row.productId)));
    } catch {
      setError("Chưa thu hồi được quyền. Thử lại nhé.");
    }
  };

  const visible = rows.filter((row) => !filterProduct || row.productId === filterProduct);
  return <>
    <PageHeader eyebrow="ENTITLEMENTS" title="Quyền truy cập" description="Danh sách thành viên đang sở hữu từng sản phẩm. Quyền được mở tự động khi bạn xác nhận đơn, hoặc cấp thủ công tại đây." action="Cấp quyền" onAction={onGrant} />
    {error && <div style={errorBoxStyle}>{error}</div>}
    <div style={{ marginBottom: 16 }}><select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", font: "inherit" }}><option value="">Tất cả sản phẩm ({rows.length} lượt sở hữu)</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} ({rows.filter((row) => row.productId === item.id).length})</option>)}</select></div>
    <section className="admin-table-card"><table><thead><tr><th>Thành viên</th><th>Sản phẩm</th><th /></tr></thead><tbody>
      {loading ? <tr><td colSpan={3}>Đang tải...</td></tr>
        : visible.length === 0 ? <tr><td colSpan={3}>Chưa có ai sở hữu sản phẩm.</td></tr>
        : visible.map((row) => <tr key={`${row.uid}-${row.productId}`}><td><div className="member-cell"><span>{(row.name || row.email || "?").slice(0, 2).toUpperCase()}</span><div><strong>{row.name || "(chưa có tên)"}</strong><small>{row.email}</small></div></div></td><td>{productName(row.productId)}</td><td><button className="table-action" onClick={() => revoke(row)}>Thu hồi</button></td></tr>)}
    </tbody></table></section>
  </>;
}

function SimpleContentPage({ section, onAction, onEdit }: { section: AdminSection; onAction: () => void; onEdit: (name: string) => void }) {
  const config: Record<string, [string, string, string, string]> = {
    content: ["NỘI DUNG ĐỘC QUYỀN", "Nội dung tài liệu", "Soạn chương, sắp xếp nội dung và xuất bản lên trình đọc tiahere.", "Thêm chương"],
    articles: ["CMS", "Bài viết", "Viết, lên lịch và quản lý nội dung tại Góc viết tiahere.", "Viết bài mới"],
    access: ["ENTITLEMENTS", "Quyền truy cập", "Cấp hoặc thu hồi sản phẩm cho từng thành viên.", "Cấp quyền"],
  };
  const [eyebrow, title, description, action] = config[section];
  return <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} onAction={onAction} />
    <section className="admin-list-panel">
      <p style={{ padding: "32px 20px", color: "var(--c-text-2, #888)", fontSize: "0.9rem" }}>Chưa có nội dung nào. Bấm "{action}" để bắt đầu.</p>
    </section>
  </>;
}

function AnalyticsPage() {
  const [period, setPeriod] = useState<"7" | "30" | "custom">("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [orders, setOrders] = useState<(AdminOrder & { productKind?: string })[]>([]);
  const [users, setUsers] = useState<{ createdAt: string }[]>([]);
  const [bookings, setBookings] = useState<{ createdAt: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoverMonth, setHoverMonth] = useState("");

  useEffect(() => {
    Promise.all([getDocs(collection(db, "orders")), getDocs(collection(db, "users")), getDocs(collection(db, "bookings"))])
      .then(([orderSnap, userSnap, bookingSnap]) => {
        setOrders(orderSnap.docs.map((d) => ({ ...(d.data() as AdminOrder & { productKind?: string }), code: d.id })));
        setUsers(userSnap.docs.map((d) => ({ createdAt: String(d.data().createdAt || "") })));
        setBookings(bookingSnap.docs.map((d) => ({ createdAt: String(d.data().createdAt || ""), status: String(d.data().status || "") })));
      })
      .catch((err) => setError(`Không tải được số liệu (mã lỗi: ${(err as { code?: string }).code || "unknown"}).`))
      .finally(() => setLoading(false));
  }, []);

  // Khoảng thời gian đang xem (so sánh theo ngày YYYY-MM-DD)
  const today = adminToday();
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const from = period === "custom" ? (customFrom || "0000-01-01") : daysAgo(Number(period));
  const to = period === "custom" ? (customTo || today) : today;
  const inRange = (iso: string) => { const day = (iso || "").slice(0, 10); return day >= from && day <= to; };

  const paid = orders.filter((order) => order.status === "Đã xác nhận" && order.amount > 0);
  const paidInRange = paid.filter((order) => inRange(order.confirmedAt || order.createdAt));
  const revenue = paidInRange.reduce((sum, order) => sum + order.amount, 0);
  const createdInRange = orders.filter((order) => order.amount > 0 && inRange(order.createdAt));
  const newUsers = users.filter((user) => inRange(user.createdAt)).length;
  const bookingsInRange = bookings.filter((booking) => booking.status !== "Đã huỷ" && inRange(booking.createdAt)).length;
  const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

  // Doanh thu 6 tháng gần nhất (một chuỗi số liệu → một màu, không cần chú thích)
  const months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - index));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const total = paid.filter((order) => (order.confirmedAt || order.createdAt).slice(0, 7) === key).reduce((sum, order) => sum + order.amount, 0);
    return { key, label: `T${d.getMonth() + 1}`, total };
  });
  const maxMonth = Math.max(...months.map((m) => m.total), 1);

  // Doanh thu theo sản phẩm trong khoảng đang xem
  const byProduct = Object.values(paidInRange.reduce<Record<string, { title: string; total: number; count: number }>>((acc, order) => {
    const item = acc[order.productId] || { title: order.productTitle, total: 0, count: 0 };
    item.total += order.amount; item.count += 1; acc[order.productId] = item; return acc;
  }, {})).sort((a, b) => b.total - a.total);
  const maxProduct = Math.max(...byProduct.map((p) => p.total), 1);

  const barColor = "var(--admin-accent, #b9787a)";
  const ink2 = "var(--c-text-2, #7a6a66)";
  const metrics: [string, string, string][] = [
    ["Doanh thu", loading ? "…" : money(revenue), `${paidInRange.length} đơn đã xác nhận`],
    ["Đơn đặt mua", loading ? "…" : String(createdInRange.length), `${createdInRange.filter((o) => o.status === "Chờ xác nhận").length} đơn đang chờ xác nhận`],
    ["Thành viên mới", loading ? "…" : String(newUsers), `Tổng ${users.length} thành viên`],
    ["Lịch call đã đặt", loading ? "…" : String(bookingsInRange), "Không tính lịch đã huỷ"],
  ];

  return <>
    <PageHeader eyebrow="INSIGHTS" title="Thống kê" description={`Hiệu quả bán hàng và thành viên ${period === "custom" ? `từ ${customFrom ? adminDateLabel(customFrom) : "đầu"} đến ${adminDateLabel(to)}` : `trong ${period} ngày gần nhất`}.`} />
    <div className="analytics-period">
      <div><button className={period === "7" ? "active" : ""} onClick={() => setPeriod("7")}>7 ngày</button><button className={period === "30" ? "active" : ""} onClick={() => setPeriod("30")}>30 ngày</button><button className={period === "custom" ? "active" : ""} onClick={() => setPeriod("custom")}>Lựa chọn</button></div>
      {period === "custom" && <section><label><span>Từ ngày</span><input type="date" value={customFrom} max={customTo || today} onChange={(e) => setCustomFrom(e.target.value)} /></label><i>—</i><label><span>Đến ngày</span><input type="date" value={customTo} min={customFrom} max={today} onChange={(e) => setCustomTo(e.target.value)} /></label></section>}
    </div>
    {error && <div style={errorBoxStyle}>{error}</div>}
    <section className="admin-metrics analytics-metrics">{metrics.map(([label, value, note], index) => <article key={label}><span className={`metric-icon tone-${index + 1}`}><AdminIcon name="analytics" /></span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}</section>
    <div className="admin-dashboard-grid">
      <section className="admin-panel chart-panel"><header><div><span>DOANH THU</span><h2>6 tháng gần nhất</h2></div></header>
        <div role="img" aria-label={`Doanh thu 6 tháng: ${months.map((m) => `${m.label} ${money(m.total)}`).join(", ")}`} style={{ padding: "20px 20px 12px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 180, borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
            {months.map((m) => (
              <div key={m.key} onMouseEnter={() => setHoverMonth(m.key)} onMouseLeave={() => setHoverMonth("")} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", position: "relative", cursor: "default" }}>
                {hoverMonth === m.key && <div style={{ position: "absolute", bottom: `calc(${(m.total / maxMonth) * 100}% + 8px)`, background: "#2b2321", color: "#fff", fontSize: 12, padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap", zIndex: 1 }}>{m.label}: {money(m.total)}</div>}
                <div style={{ width: "56%", maxWidth: 40, height: `${(m.total / maxMonth) * 100}%`, minHeight: m.total ? 3 : 0, background: barColor, borderRadius: "4px 4px 0 0", opacity: hoverMonth && hoverMonth !== m.key ? 0.55 : 1 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 8 }}>{months.map((m) => <span key={m.key} style={{ flex: 1, textAlign: "center", fontSize: 12, color: ink2 }}>{m.label}</span>)}</div>
          {!loading && months.every((m) => m.total === 0) && <p style={{ margin: "12px 0 0", fontSize: "0.85rem", color: ink2 }}>Chưa có đơn nào được xác nhận trong 6 tháng qua.</p>}
        </div>
      </section>
      <section className="admin-panel"><header><div><span>NGUỒN DOANH THU</span><h2>Theo sản phẩm</h2></div></header>
        {loading ? <p style={{ padding: "24px 20px", color: ink2 }}>Đang tải...</p>
          : byProduct.length === 0 ? <p style={{ padding: "24px 20px", color: ink2, fontSize: "0.9rem" }}>Chưa có doanh thu trong khoảng này.</p>
          : <div style={{ padding: "8px 20px 16px" }}>{byProduct.map((item) => <div key={item.title} title={`${item.title}: ${money(item.total)} · ${item.count} đơn`} style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.88rem" }}><span>{item.title}</span><strong>{money(item.total)}</strong></div>
              <div style={{ height: 8, marginTop: 6, background: "rgba(0,0,0,0.06)", borderRadius: 4 }}><div style={{ width: `${(item.total / maxProduct) * 100}%`, height: "100%", background: barColor, borderRadius: 4 }} /></div>
            </div>)}</div>}
      </section>
    </div>
  </>;
}

// ── Thông báo chung: hiện trong chuông của mọi người (kể cả khách chưa đăng nhập) ──
type Announcement = { id: string; title: string; body: string; link: string; createdAt: string };
const SECTION_LINKS: [string, string][] = [["#tai-lieu", "Mục Tài liệu"], ["#cong-cu", "Mục Công cụ"], ["#khoa-hoc", "Mục Khoá học"], ["#su-kien", "Mục Sự kiện"], ["#bai-viet", "Mục Bài viết"], ["#dong-hanh", "Mục Đồng hành 1:1"]];
function AnnouncementsPage({ products }: { products: (typeof initialProducts)[number][] }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkType, setLinkType] = useState("none");
  const [productLinkId, setProductLinkId] = useState("");
  const [sectionLink, setSectionLink] = useState("#su-kien");
  const [customLink, setCustomLink] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getDocs(query(collection(db, "announcements")))
      .then((snap) => setItems(snap.docs.map((d) => ({ ...(d.data() as Omit<Announcement, "id">), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => setMsg("Không tải được danh sách thông báo."));
  }, []);
  const link = linkType === "product" ? (productLinkId ? `#san-pham=${productLinkId}` : "") : linkType === "section" ? sectionLink : linkType === "custom" ? customLink.trim() : "";
  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setMsg("Bạn điền tiêu đề và nội dung nhé."); return; }
    if (linkType === "custom" && !/^https:\/\/\S+$/i.test(link)) { setMsg("Link ngoài phải bắt đầu bằng https://"); return; }
    setSaving(true); setMsg("");
    try {
      const data = { title: title.trim().slice(0, 60), body: body.trim().slice(0, 200), link, createdAt: new Date().toISOString() };
      const ref = await addDoc(collection(db, "announcements"), data);
      setItems((list) => [{ ...data, id: ref.id }, ...list]);
      setTitle(""); setBody(""); setLinkType("none"); setCustomLink("");
      setMsg("Đã đăng. Thông báo sẽ hiện trong chuông của mọi người.");
    } catch { setMsg("Chưa đăng được. Kiểm tra kết nối rồi thử lại."); }
    finally { setSaving(false); }
  };
  const remove = async (item: Announcement) => {
    if (!window.confirm(`Xoá thông báo "${item.title}"?`)) return;
    try { await deleteDoc(doc(db, "announcements", item.id)); setItems((list) => list.filter((x) => x.id !== item.id)); }
    catch { setMsg("Chưa xoá được thông báo."); }
  };
  const linkLabel = (l: string) => !l ? "Không có link" : l.startsWith("#san-pham=") ? `Sản phẩm: ${products.find((p) => p.id === l.slice(10))?.name || l.slice(10)}` : SECTION_LINKS.find(([v]) => v === l)?.[1] || l;
  return <>
    <PageHeader eyebrow="CHUÔNG THÔNG BÁO" title="Thông báo chung" description="Đăng thông báo cho tất cả mọi người, hiện trong nút chuông trên website (kể cả khách chưa đăng nhập)." />
    <form className="admin-editor-form" onSubmit={post}>
      <section><header><span>01</span><div><h2>Đăng thông báo mới</h2><p>Thông báo cá nhân (đơn hàng, lịch call...) được gửi tự động, không cần đăng ở đây.</p></div></header>
        <div className="admin-form-grid">
          <label className="wide"><span>Tiêu đề * ({title.length}/60)</span><input maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Sự kiện tháng 11 đã mở đăng ký" /></label>
          <label className="wide"><span>Nội dung * ({body.length}/200)</span><textarea maxLength={200} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="1-2 câu ngắn gọn..." /></label>
          <label><span>Bấm vào thông báo sẽ mở</span><select value={linkType} onChange={(e) => setLinkType(e.target.value)}><option value="none">Không mở gì</option><option value="product">Một sản phẩm / sự kiện</option><option value="section">Một mục trên web</option><option value="custom">Link ngoài</option></select></label>
          {linkType === "product" && <label><span>Chọn sản phẩm</span><select value={productLinkId} onChange={(e) => setProductLinkId(e.target.value)}><option value="">-- Chọn --</option>{products.filter((p) => p.status === "Đang bán").map((p) => <option key={p.id} value={p.id}>{p.type}: {p.name}</option>)}</select></label>}
          {linkType === "section" && <label><span>Chọn mục</span><select value={sectionLink} onChange={(e) => setSectionLink(e.target.value)}>{SECTION_LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
          {linkType === "custom" && <label><span>Link ngoài</span><input type="url" value={customLink} onChange={(e) => setCustomLink(e.target.value)} placeholder="https://..." /></label>}
        </div>
      </section>
      {msg && <p style={{ margin: "0 0 12px" }}>{msg}</p>}
      <footer><button type="submit" disabled={saving}>{saving ? "Đang đăng..." : "Đăng thông báo"}</button></footer>
    </form>
    <section className="admin-table-card" style={{ marginTop: 20 }}><table><thead><tr><th>Thông báo</th><th>Link</th><th>Ngày đăng</th><th /></tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={4}>Chưa có thông báo chung nào.</td></tr> : items.map((item) => <tr key={item.id}>
        <td><div className="stacked-cell"><strong>{item.title}</strong><span>{item.body}</span></div></td>
        <td><small>{linkLabel(item.link)}</small></td>
        <td><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small></td>
        <td><button className="table-action" onClick={() => remove(item)}>Xoá</button></td>
      </tr>)}
    </tbody></table></section>
  </>;
}

// ── Điều khoản sử dụng & Chính sách bảo mật: lưu ở settings/legal, hiện công khai trên web ──
function LegalAdminPage() {
  const [terms, setTerms] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    getDoc(doc(db, "settings", "legal"))
      .then((snap) => { if (snap.exists()) { const d = snap.data(); setTerms(d.terms || ""); setPrivacy(d.privacy || ""); setUpdatedAt(d.updatedAt || ""); } })
      .catch(() => setMsg("Không tải được nội dung. Kiểm tra kết nối rồi thử lại."))
      .finally(() => setLoading(false));
  }, []);
  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, "settings", "legal"), { terms, privacy, updatedAt: now });
      setUpdatedAt(now); setMsg("Đã lưu. Nội dung mới đã hiện trên website.");
    } catch { setMsg("Chưa lưu được. Kiểm tra kết nối rồi thử lại."); }
    finally { setSaving(false); }
  };
  const hint = "Gõ chữ bình thường. Dòng bắt đầu bằng \"# \" là tiêu đề lớn, \"## \" là tiêu đề nhỏ, \"- \" là gạch đầu dòng.";
  return <>
    <PageHeader eyebrow="PHÁP LÝ" title="Điều khoản & Chính sách bảo mật" description="Soạn nội dung 2 trang công khai. Link nằm ở cuối trang chủ, cuối menu bên trái và trong các form đăng ký / thanh toán." />
    {loading ? <p>Đang tải...</p> : <form className="admin-editor-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <section><header><span>01</span><div><h2>Điều khoản sử dụng</h2><p>{hint} Xem trên web: tiahere.com/#dieu-khoan-su-dung</p></div></header>
        <div className="admin-form-grid"><label className="wide"><textarea rows={18} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={"# 1. Giới thiệu\nNội dung...\n\n# 2. Tài khoản\n- Ý 1\n- Ý 2"} /></label></div>
      </section>
      <section><header><span>02</span><div><h2>Chính sách bảo mật</h2><p>{hint} Xem trên web: tiahere.com/#chinh-sach-bao-mat</p></div></header>
        <div className="admin-form-grid"><label className="wide"><textarea rows={18} value={privacy} onChange={(e) => setPrivacy(e.target.value)} placeholder={"# 1. Thông tin chúng tôi thu thập\n- Họ tên, email, số điện thoại...\n\n# 2. Mục đích sử dụng\n..."} /></label></div>
      </section>
      {msg && <p style={{ margin: "0 0 12px" }}>{msg}</p>}
      <footer><small style={{ opacity: 0.65 }}>{updatedAt ? `Lưu lần cuối: ${new Date(updatedAt).toLocaleString("vi-VN")}` : "Chưa lưu lần nào"}</small> <button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></footer>
    </form>}
  </>;
}

function SettingsPage() {
  return <>
    <PageHeader eyebrow="HỆ THỐNG" title="Cài đặt" description="Thông tin thanh toán, hỗ trợ và nhận diện của tiahere." />
    <section className="settings-grid">
      <article><h2>Thanh toán chuyển khoản</h2><p>Mã QR được tạo động theo từng đơn hàng.</p><label><span>Ngân hàng</span><input defaultValue="MB Bank" /></label><label><span>Chủ tài khoản</span><input defaultValue="Hộ kinh doanh Trang Nguyen" /></label><label><span>Số tài khoản</span><input defaultValue="355308888" /></label><label><span>Cấu trúc nội dung</span><input defaultValue="{Tên sản phẩm} {User} {Ngày thanh toán}" /></label><button>Lưu cài đặt</button></article>
      <article><h2>Hỗ trợ & thương hiệu</h2><p>Thông tin hiển thị trên website thành viên.</p><label><span>Zalo hỗ trợ</span><input defaultValue="03 6286 4028" /></label><label><span>Thời gian xác nhận</span><input defaultValue="4–6 tiếng" /></label><label><span>Phiên bản</span><input defaultValue="Bản beta thử nghiệm 2026" /></label><label><span>Email gửi thông báo</span><input defaultValue="hello@tiahere.vn" /></label><button>Lưu cài đặt</button></article>
    </section>
  </>;
}

type AdminSubpage = "add-product" | "add-article" | "grant-access" | "block-slot" | "edit-product" | "edit-content" | "edit-article" | "meeting-note";

function FormPageShell({ eyebrow, title, description, onBack, children }: { eyebrow: string; title: string; description: string; onBack: () => void; children: React.ReactNode }) {
  return <div className="admin-form-page">
    <button className="admin-form-back" onClick={onBack}><AdminIcon name="arrow" size={16} /> Quay lại</button>
    <PageHeader eyebrow={eyebrow} title={title} description={description} />
    {children}
  </div>;
}

function AddProductPage({ initialProduct, allProducts = [], onBack, onSave, onDeleted }: { initialProduct?: (typeof initialProducts)[number]; allProducts?: (typeof initialProducts)[number][]; onBack: () => void; onSave: (product: (typeof initialProducts)[number]) => void; onDeleted?: (id: string) => void }) {
  // Mã sản phẩm vừa tạo ở lần lưu đầu: các lần lưu sau sẽ cập nhật đúng sản phẩm này
  const [createdId, setCreatedId] = useState("");
  const [type, setType] = useState(initialProduct?.type || "Tài liệu");
  const [courseMode, setCourseMode] = useState(initialProduct?.courseMode || "external");
  const [name, setName] = useState(initialProduct?.name || "");
  const [price, setPrice] = useState(initialProduct?.price.replace(/\D/g, "") || "");
  const [description, setDescription] = useState(initialProduct?.description || "");
  const [category, setCategory] = useState(initialProduct?.category || "Sự nghiệp");
  const [badge, setBadge] = useState(initialProduct?.badge || "Không có");
  const [status, setStatus] = useState(initialProduct?.status || "Bản nháp");
  const [imageUrl, setImageUrl] = useState(initialProduct?.image || "");
  const [imageCardUrl, setImageCardUrl] = useState(initialProduct?.imageCard || "");
  const [externalUrl, setExternalUrl] = useState(initialProduct?.externalUrl || "");
  const [tabs, setTabs] = useState<string[]>(initialProduct?.tabs || ["Mới nhất"]);
  const [outcomesText, setOutcomesText] = useState((initialProduct?.outcomes || []).join("\n"));
  const [audienceText, setAudienceText] = useState((initialProduct?.audience || []).join("\n"));
  const toLines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);
  const outcomesHeading = type === "Sự kiện" ? "Sau khi tham gia bạn sẽ nhận được gì?" : type === "Khoá học" && courseMode !== "external" ? "Sau khoá học bạn sẽ nhận được gì?" : type === "Khoá học" ? "Bạn sẽ học được gì?" : type === "Công cụ" ? "Bạn sẽ sử dụng được gì?" : type === "Đồng hành" ? "Bạn sẽ nhận được gì?" : "Bạn sẽ đọc và nhận được gì?";
  const [saved, setSaved] = useState(false);
  const [ebookUrl, setEbookUrl] = useState(initialProduct?.ebookUrl || "");
  const [toolKey, setToolKey] = useState(initialProduct?.toolKey || "");
  const [bonusBuyers, setBonusBuyers] = useState(initialProduct?.bonusBuyers ? String(initialProduct.bonusBuyers) : "");
  const [originalPrice, setOriginalPrice] = useState((initialProduct?.originalPrice || "").replace(/\D/g, ""));
  const [showBuyers, setShowBuyers] = useState(initialProduct?.showBuyers !== false);
  const [bonusInterest, setBonusInterest] = useState(initialProduct?.bonusInterest ? String(initialProduct.bonusInterest) : "");
  const [showInterest, setShowInterest] = useState(initialProduct?.showInterest !== false);
  // Sự kiện & khoá học tự tổ chức
  const [contentText, setContentText] = useState(initialProduct?.contentText || "");
  const [eventDate, setEventDate] = useState(initialProduct?.eventDate || "");
  const [eventTime, setEventTime] = useState(initialProduct?.eventTime || "");
  const [eventEndTime, setEventEndTime] = useState(initialProduct?.eventEndTime || "");
  const [eventFormat, setEventFormat] = useState(initialProduct?.eventFormat || "online");
  const [location, setLocation] = useState(initialProduct?.location || "");
  const [startDate, setStartDate] = useState(initialProduct?.startDate || "");
  const [schedule, setSchedule] = useState(initialProduct?.schedule || "");
  const [privateNote, setPrivateNote] = useState(initialProduct?.note || ""); // lưu ý cho người tham gia (công khai)
  const isEventType = type === "Sự kiện";
  // Combo: chọn sản phẩm Tài liệu / Công cụ bên trong
  const isCombo = type === "Combo";
  const [comboItems, setComboItems] = useState<string[]>(initialProduct?.comboItems || []);
  const [saleEnd, setSaleEnd] = useState(initialProduct?.saleEnd || "");
  const comboChoices = allProducts.filter((p) => (p.type === "Tài liệu" || p.type === "Công cụ") && p.id !== initialProduct?.id);
  const priceOf = (p?: { price?: string }) => Number((p?.price || "").replace(/\D/g, "")) || 0;
  const comboTotal = comboItems.reduce((sum, id) => sum + priceOf(allProducts.find((p) => p.id === id)), 0);
  const isSelfCourse = type === "Khoá học" && courseMode !== "external";
  const hasSchedule = isEventType || isSelfCourse;
  const [ebookHtml, setEbookHtml] = useState("");
  const [ebookFileName, setEbookFileName] = useState(initialProduct?.ebookFileName || "");
  const [ebookError, setEbookError] = useState("");
  const EBOOK_MAX_BYTES = 900 * 1024; // Firestore giới hạn 1MB / document

  const pickEbookFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setEbookError("");
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setEbookError("Chỉ nhận file .html hoặc .htm.");
      return;
    }
    if (file.size > EBOOK_MAX_BYTES) {
      setEbookError(`File nặng ${(file.size / 1024).toFixed(0)}KB, vượt giới hạn 900KB. Hãy bỏ ảnh nhúng trong file và dùng link ảnh thay thế.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEbookHtml(String(reader.result || ""));
      setEbookFileName(file.name);
      setSaved(false);
    };
    reader.onerror = () => setEbookError("Không đọc được file. Thử lại nhé.");
    reader.readAsText(file, "utf-8");
  };
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCombo && comboItems.length < 2) { setSaveError("Combo cần ít nhất 2 sản phẩm."); return; }
    if (isCombo && !(Number(price) > 0)) { setSaveError("Combo cần có giá bán lớn hơn 0."); return; }
    setSaving(true);
    setSaveError("");
    // Map AdminApp fields → App.tsx Product type
    const kindMap: Record<string, string> = {
      "Tài liệu": "document",
      "Công cụ": "tool",
      "Khoá học": "course",
      "Đồng hành": "mentoring",
      "Sự kiện": "event",
      "Combo": "combo",
    };
    const productData = {
      id: initialProduct?.id || createdId || `P${String(Date.now()).slice(-4)}`,
      // Admin fields
      name,
      type,
      price: price ? `${Number(price).toLocaleString("vi-VN")}đ` : "0đ",
      sold: initialProduct?.sold || 0,
      status,
      ebookUrl: ebookUrl.trim(),
      // App.tsx Product fields
      title: name,
      kind: kindMap[type] || "document",
      category,
      description,
      image: imageUrl.trim(),
      imageCard: imageCardUrl.trim(),
      tabs,
      badge: badge === "Không có" ? "" : badge,
      externalUrl: externalUrl.trim(),
      ebookFileName,
      toolKey: type === "Công cụ" ? toolKey : "",
      bonusBuyers: Math.max(0, Number(bonusBuyers) || 0),
      // Giá gốc chỉ lưu khi lớn hơn giá bán. Combo: giá gốc = tổng giá mua lẻ
      originalPrice: isCombo ? (comboTotal > (Number(price) || 0) ? `${comboTotal.toLocaleString("vi-VN")}đ` : "") : Number(originalPrice) > (Number(price) || 0) ? `${Number(originalPrice).toLocaleString("vi-VN")}đ` : "",
      comboItems: isCombo ? comboItems : [],
      saleEnd: isCombo ? saleEnd : "",
      showBuyers,
      bonusInterest: Math.max(0, Number(bonusInterest) || 0),
      showInterest,
      courseMode: type === "Khoá học" ? courseMode : "",
      contentText: hasSchedule ? contentText.trim() : "",
      eventDate: isEventType ? eventDate : "",
      eventTime: isEventType ? eventTime : "",
      eventEndTime: isEventType ? eventEndTime : "",
      eventFormat: hasSchedule ? eventFormat : "",
      location: hasSchedule ? location.trim() : "",
      startDate: isSelfCourse ? startDate : "",
      schedule: isSelfCourse ? schedule.trim() : "",
      note: hasSchedule ? privateNote.trim() : "",
      outcomes: toLines(outcomesText),
      audience: toLines(audienceText),
    };
    try {
      const existingId = initialProduct?.id || createdId;
      if (existingId) {
        await updateDoc(doc(db, "products", existingId), productData);
      } else {
        const docRef = await addDoc(collection(db, "products"), productData);
        productData.id = docRef.id;
        setCreatedId(docRef.id);
      }
      // Lưu nội dung ebook vào collection riêng (không tải kèm khi mở trang chủ)
      if (ebookHtml) {
        await setDoc(doc(db, "ebooks", productData.id), {
          html: ebookHtml,
          fileName: ebookFileName,
          updatedAt: new Date().toISOString(),
        });
        setEbookHtml("");
      }
      onSave({ ...productData, buyers: initialProduct?.buyers || 0, interested: initialProduct?.interested || 0 });
      setSaved(true);
    } catch (err) {
      setSaveError(`Không thể lưu (mã lỗi: ${(err as { code?: string }).code || "unknown"}). Kiểm tra kết nối và thử lại.`);
    } finally {
      setSaving(false);
    }
  };

  return <FormPageShell eyebrow="CATALOG" title={initialProduct ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"} description={initialProduct ? "Cập nhật thông tin, hình ảnh và trạng thái sản phẩm." : "Tạo sản phẩm mới và chuẩn bị nội dung trước khi xuất bản."} onBack={onBack}>
    <form className="admin-editor-form" onSubmit={submit} onChange={() => setSaved(false)}>
      {saved && <div className="admin-form-success"><AdminIcon name="check" />{initialProduct || createdId ? "Đã lưu thay đổi sản phẩm." : "Sản phẩm đã được lưu."}</div>}
      {saveError && <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: "10px", padding: "12px 16px", color: "#c00", marginBottom: "16px" }}>{saveError}</div>}
      <section><header><span>01</span><div><h2>Thông tin cơ bản</h2><p>Tên, loại và nội dung hiển thị trên website. Ô có dấu * là bắt buộc.</p></div></header>
        <div className="admin-form-grid">
          <label className="wide"><span>Tên sản phẩm *</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Workbook thiết kế sự nghiệp" /></label>
          <label><span>Loại sản phẩm</span><select value={type} onChange={(event) => setType(event.target.value)}><option>Tài liệu</option><option>Công cụ</option><option>Khoá học</option><option>Sự kiện</option><option>Combo</option><option>Đồng hành</option></select></label>
          {type === "Khoá học" && <label><span>Hình thức khoá học</span><select value={courseMode} onChange={(e) => { setCourseMode(e.target.value); setSaved(false); }}><option value="external">Bán trên Udemy / link ngoài</option><option value="paid">Tự tổ chức - trả phí</option><option value="refund">Tự tổ chức - trả phí, hoàn lại học phí</option></select>{courseMode === "refund" && <small style={{ opacity: 0.65 }}>Khách chuyển khoản vào TK Techcombank 1903 0287 6850 14 và điền TK nhận hoàn khi đăng ký.</small>}</label>}
          {type === "Công cụ" && <label><span>Công cụ trên web</span><select value={toolKey} onChange={(e) => { setToolKey(e.target.value); setSaved(false); }}><option value="">Không có (dùng file HTML bên dưới)</option><option value="hieu-minh">Worksheet Hiểu mình (30 câu + AI)</option><option value="tktksn">Worksheet Tài khoản tiết kiệm sự nghiệp (8 bước + AI)</option></select></label>}
          <label><span>Danh mục</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>Sự nghiệp</option><option>Làm việc từ xa</option><option>Phát triển bản thân</option><option>Tài chính</option><option>Freelance</option></select></label>
          <label className="wide"><span>Mô tả ngắn *</span><textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả giá trị chính của sản phẩm..." /></label>
        </div>
      </section>
      <section><header><span>02</span><div><h2>Nội dung trang chi tiết</h2><p>Hai khối hiển thị bên dưới giá sản phẩm. Mỗi dòng là một ý. Để trống sẽ dùng nội dung mặc định.</p></div></header>
        <div className="admin-form-grid">
          <label className="wide"><span>{outcomesHeading} (mỗi dòng 1 ý)</span><textarea rows={4} value={outcomesText} onChange={(e) => setOutcomesText(e.target.value)} placeholder={"Nội dung được hệ thống hóa, dễ đọc và áp dụng\nBài tập thực hành giúp biến kiến thức thành hành động\nTài liệu tải về để sử dụng lâu dài"} /></label>
          <label className="wide"><span>{hasSchedule ? "Ai nên tham gia?" : "Ai nên sử dụng sản phẩm này?"} (mỗi dòng 1 ý)</span><textarea rows={4} value={audienceText} onChange={(e) => setAudienceText(e.target.value)} placeholder={"Người muốn tự học theo lộ trình rõ ràng\nNgười đang cần một góc nhìn thực tế, dễ áp dụng\nNgười muốn chủ động phát triển sự nghiệp"} /></label>
        </div>
      </section>
      {hasSchedule && <section><header><span>02b</span><div><h2>{isEventType ? "Thông tin sự kiện" : "Thông tin lớp học"}</h2><p>Hiển thị trên trang chi tiết sự kiện / khoá học. Link tham gia và tài liệu bạn gửi cho người đăng ký qua email.</p></div></header>
        <div className="admin-form-grid">
          <label className="wide"><span>{isEventType ? "Nội dung sự kiện" : "Nội dung khoá học"}</span><textarea rows={6} value={contentText} onChange={(e) => { setContentText(e.target.value); setSaved(false); }} placeholder={isEventType ? "Sự kiện gồm những phần nào, chia sẻ về chủ đề gì..." : "Khoá học gồm những module/buổi nào, học những gì..."} /></label>
          {isEventType ? <>
            <label><span>Ngày diễn ra *</span><input required type="date" value={eventDate} onChange={(e) => { setEventDate(e.target.value); setSaved(false); }} /></label>
            <label><span>Giờ bắt đầu * - kết thúc</span><span style={{ display: "flex", gap: 8 }}><input required type="time" value={eventTime} onChange={(e) => { setEventTime(e.target.value); setSaved(false); }} /><input type="time" value={eventEndTime} onChange={(e) => { setEventEndTime(e.target.value); setSaved(false); }} /></span></label>
          </> : <>
            <label><span>Ngày khai giảng</span><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSaved(false); }} /></label>
            <label><span>Lịch học</span><input value={schedule} onChange={(e) => { setSchedule(e.target.value); setSaved(false); }} placeholder="Ví dụ: 20:00 - 21:30 tối thứ 3, 5 hàng tuần · 6 buổi" /></label>
          </>}
          <label><span>Hình thức</span><select value={eventFormat} onChange={(e) => { setEventFormat(e.target.value); setSaved(false); }}><option value="online">Online</option><option value="offline">Offline</option></select></label>
          <label><span>{eventFormat === "offline" ? "Địa chỉ" : "Nền tảng"} (công khai)</span><input value={location} onChange={(e) => { setLocation(e.target.value); setSaved(false); }} placeholder={eventFormat === "offline" ? "Số nhà, đường, quận, thành phố" : "Google Meet / Zoom"} /></label>
                    <label className="wide"><span>Lưu ý cho người tham gia</span><textarea rows={3} value={privateNote} onChange={(e) => { setPrivateNote(e.target.value); setSaved(false); }} placeholder={isEventType ? "Ví dụ: vào sớm 5 phút, chuẩn bị sổ bút..." : "Ví dụ: link nhóm Zalo lớp, link Google Form điểm danh, nộp bài..."} /></label>

        </div>
      </section>}
      {isCombo && <section><header><span>02c</span><div><h2>Sản phẩm trong combo</h2><p>Chọn ít nhất 2 Tài liệu / Công cụ. Khách đã có sẵn bất kỳ sản phẩm nào trong combo sẽ không mua được combo này.</p></div></header>
        <div className="admin-form-grid">
          <fieldset className="admin-check-group wide"><legend>Chọn sản phẩm</legend>
            {comboChoices.length === 0 ? <span>Chưa có Tài liệu / Công cụ nào.</span> : comboChoices.map((p) => (
              <label key={p.id}><input type="checkbox" checked={comboItems.includes(p.id)} onChange={(e) => { setComboItems((list) => e.target.checked ? [...list, p.id] : list.filter((x) => x !== p.id)); setSaved(false); }} /> {p.name} · {p.price}{p.status !== "Đang bán" ? ` (${p.status})` : ""}</label>
            ))}
          </fieldset>
          <p className="wide" style={{ margin: 0 }}>Tổng giá mua lẻ: <b>{comboTotal.toLocaleString("vi-VN")}đ</b>{Number(price) > 0 && comboTotal > Number(price) ? ` · Giá combo ${Number(price).toLocaleString("vi-VN")}đ · tiết kiệm ${Math.round(((comboTotal - Number(price)) / comboTotal) * 100)}%` : ""}</p>
          <label><span>Hạn bán (không bắt buộc)</span><input type="date" value={saleEnd} onChange={(e) => { setSaleEnd(e.target.value); setSaved(false); }} /><small style={{ opacity: 0.65 }}>Sau ngày này combo tự ẩn khỏi website.</small></label>
        </div>
      </section>}
      <section><header><span>03</span><div><h2>Giá & trạng thái</h2><p>Thiết lập bán hàng và vị trí khám phá.</p></div></header>
        <div className="admin-form-grid">
          <label><span>Giá bán (VNĐ) *</span><input required type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="149000" /><small style={{ opacity: 0.65 }}>Nhập 0 = sản phẩm miễn phí: khách đăng nhập là nhận được ngay, không cần thanh toán.</small></label>
          {!isCombo && <label><span>Giá gốc (tuỳ chọn)</span><input type="number" min="0" value={originalPrice} onChange={(e) => { setOriginalPrice(e.target.value); setSaved(false); }} placeholder="199000" /><small style={{ opacity: 0.65 }}>{Number(originalPrice) > (Number(price) || 0) ? `Web hiện: giá gốc gạch ngang + nhãn -${Math.round(((Number(originalPrice) - (Number(price) || 0)) / Number(originalPrice)) * 100)}%` : "Để trống hoặc nhỏ hơn giá bán thì không hiện."}</small></label>}
          <label><span>{type === "Khoá học" && courseMode === "external" ? "Số lượt xem hiển thị (X)" : hasSchedule ? "Số người đăng ký cộng thêm (X)" : "Số người mua cộng thêm (X)"}</span><input type="number" min="0" value={bonusBuyers} onChange={(e) => { setBonusBuyers(e.target.value); setSaved(false); }} placeholder="0" /><small style={{ opacity: 0.65 }}>{type === "Khoá học" && courseMode === "external" ? "Khoá học bán trên Udemy: web hiện đúng số này." : `Web hiện: ${(initialProduct?.buyers || 0).toLocaleString("vi-VN")} ${hasSchedule ? "người đăng ký" : "người mua"} thật + ${(Number(bonusBuyers) || 0).toLocaleString("vi-VN")} = ${((initialProduct?.buyers || 0) + (Number(bonusBuyers) || 0)).toLocaleString("vi-VN")}`}</small></label>
          <label><span>Số người quan tâm cộng thêm (X)</span><input type="number" min="0" value={bonusInterest} onChange={(e) => { setBonusInterest(e.target.value); setSaved(false); }} placeholder="0" /><small style={{ opacity: 0.65 }}>{`Web hiện: ${(initialProduct?.interested || 0).toLocaleString("vi-VN")} người quan tâm thật + ${(Number(bonusInterest) || 0).toLocaleString("vi-VN")} = ${((initialProduct?.interested || 0) + (Number(bonusInterest) || 0)).toLocaleString("vi-VN")}`}</small></label>
          <fieldset className="admin-check-group wide"><legend>Hiển thị số liệu trên web</legend>
            <label><input type="checkbox" checked={showBuyers} onChange={(e) => { setShowBuyers(e.target.checked); setSaved(false); }} /> {type === "Khoá học" && courseMode === "external" ? "Số lượt xem khoá học" : hasSchedule ? "Số người đăng ký" : "Số người mua"}</label>
            <label><input type="checkbox" checked={showInterest} onChange={(e) => { setShowInterest(e.target.checked); setSaved(false); }} /> Số người quan tâm</label>
          </fieldset>
          <label><span>Badge</span><select value={badge} onChange={(e) => setBadge(e.target.value)}><option>Không có</option><option>Mới nhất</option><option>Phổ biến</option><option>Bán chạy</option><option>Ưu đãi</option></select></label>
          <label><span>Trạng thái</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option>Bản nháp</option><option>Đang bán</option><option>Sắp mở</option><option>Tạm ẩn</option></select></label>
          <fieldset className="admin-check-group wide"><legend>Hiển thị trong tab</legend>{["Khám phá", "Mới nhất", "Phổ biến", "Ưu đãi"].map((tab) => (<label key={tab}><input type="checkbox" checked={tabs.includes(tab)} onChange={(e) => setTabs((prev) => e.target.checked ? [...prev, tab] : prev.filter((t) => t !== tab))} /> {tab === "Khám phá" ? "Khám phá (trang chủ)" : tab}</label>))}<small style={{ display: "block", width: "100%", opacity: 0.65 }}>Khám phá trang chủ hiện tối đa 6 sản phẩm được tick, theo thứ tự: 1 ô nổi bật lớn, 4 ô giữa, 1 ô "Dành cho bạn". Sự kiện đã diễn ra tự ẩn khỏi trang chủ.</small></fieldset>
        </div>
      </section>
      <section><header><span>04</span><div><h2>Ảnh cover</h2><p>Tải hai phiên bản để hình ảnh hiển thị tốt ở mọi vị trí.</p></div></header>
        <div className="cover-upload-grid">
          <CoverUploadBox variant="landscape" title="Cover ngang" hint="Card nổi bật và card rộng" size="Khuyến nghị 1600 × 900px · 16:9" value={imageUrl} onChange={(url) => { setImageUrl(url); setSaved(false); }} />
          <CoverUploadBox variant="portrait" title="Cover card" hint="Ô sản phẩm và ảnh trang chi tiết (để trống sẽ dùng cover ngang)" size="Khuyến nghị 900 × 1100px · 4:5" value={imageCardUrl} onChange={(url) => { setImageCardUrl(url); setSaved(false); }} />
        </div>
        <div className="admin-form-grid cover-url-fields">
          <label><span>Hoặc URL cover ngang</span><input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></label>
          <label><span>Hoặc URL cover card</span><input type="url" value={imageCardUrl} onChange={(e) => setImageCardUrl(e.target.value)} placeholder="https://..." /></label>
          {type === "Khoá học" && courseMode === "external" && <label className="wide"><span>URL Udemy</span><input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://www.udemy.com/course/..." /></label>}
          {(type === "Tài liệu" || (type === "Công cụ" && !toolKey)) && <label className="wide">
            <span>Tải file ebook (.html, tối đa 900KB)</span>
            <input type="file" accept=".html,.htm,text/html" onChange={pickEbookFile} />
            {ebookHtml && <small style={{ color: "#2e7d32" }}>Đã chọn: {ebookFileName} · bấm Lưu để tải lên</small>}
            {!ebookHtml && ebookFileName && <small>File đang dùng: {ebookFileName}. Chọn file mới nếu muốn thay.</small>}
            {ebookError && <small style={{ color: "#c00" }}>{ebookError}</small>}
          </label>}
          {(type === "Tài liệu" || (type === "Công cụ" && !toolKey)) && <label className="wide"><span>Hoặc URL Ebook (dự phòng, dùng khi chưa tải file)</span><input type="url" value={ebookUrl} onChange={(e) => setEbookUrl(e.target.value)} placeholder="https://tiahere.com/ebooks/ten-ebook.html" /></label>}
        </div>
      </section>
      <footer>
        {(initialProduct?.id || createdId) && <button type="button" className="secondary" style={{ color: "#b3412f", marginRight: "auto" }} onClick={async () => { const id = initialProduct?.id || createdId; if (await deleteProductFlow({ id, name: name || initialProduct?.name || "", buyers: initialProduct?.buyers })) onDeleted?.(id); }}>Xoá sản phẩm</button>}
        <button type="button" className="secondary" onClick={onBack}>{saved ? "Quay lại" : "Huỷ"}</button>
        <button type="submit" disabled={saving}>{saving ? "Đang lưu..." : initialProduct || createdId ? "Lưu thay đổi" : "Lưu sản phẩm"}</button>
      </footer>
    </form>
  </FormPageShell>;
}

export type AdminArticle = {
  id: string;
  title: string;
  category: string;
  readTime: number;
  excerpt: string;
  content: string;
  image: string;
  status: string;
  publishedAt: string;
  tags: string[];
  metaDescription: string;
  updatedAt?: string;
  views?: number;
  bonusViews?: number;
  showViews?: boolean;
};

function ArticlesAdminPage({ onAdd, onEdit }: { onAdd: () => void; onEdit: (article: AdminArticle) => void }) {
  const [items, setItems] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getDocs(collection(db, "articles"))
      .then((snapshot) => {
        const list = snapshot.docs.map((d) => ({ ...(d.data() as AdminArticle), id: d.id }));
        list.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
        setItems(list);
      })
      .catch(() => setError("Không tải được bài viết. Kiểm tra Firestore Rules cho collection articles."))
      .finally(() => setLoading(false));
  }, []);
  return <>
    <PageHeader eyebrow="CMS" title="Bài viết" description="Viết, lên lịch và quản lý nội dung tại Góc viết tiahere." action="Viết bài mới" onAction={onAdd} />
    {error && <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: "10px", padding: "12px 16px", color: "#c00", marginBottom: "16px" }}>{error}</div>}
    <section className="admin-table-card"><table><thead><tr><th>Bài viết</th><th>Chủ đề</th><th>Ngày xuất bản</th><th>Lượt đọc thật</th><th>Trạng thái</th><th /></tr></thead><tbody>
      {loading ? <tr><td colSpan={6}>Đang tải...</td></tr>
        : items.length === 0 ? <tr><td colSpan={6}>Chưa có bài viết nào. Bấm "Viết bài mới" để bắt đầu.</td></tr>
        : items.map((item) => <tr key={item.id}><td><div className="table-product"><span>{(item.title || "?").slice(0, 1)}</span><div><strong>{item.title}</strong><small>{item.readTime ? `${item.readTime} phút đọc` : ""}</small></div></div></td><td>{item.category}</td><td>{item.publishedAt ? new Date(`${item.publishedAt}T12:00:00`).toLocaleDateString("vi-VN") : "—"}</td><td>{(item.views || 0).toLocaleString("vi-VN")}</td><td><Status>{item.status}</Status></td><td><button className="table-action" onClick={() => onEdit(item)}>Chỉnh sửa</button></td></tr>)}
    </tbody></table></section>
  </>;
}

function AddArticlePage({ initialArticle, onBack }: { initialArticle?: AdminArticle; onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [articleId, setArticleId] = useState(initialArticle?.id || "");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState(initialArticle?.title || "");
  const [excerpt, setExcerpt] = useState(initialArticle?.excerpt || "");
  const [content, setContent] = useState(initialArticle?.content || "## Tiêu đề phần đầu\n\nBắt đầu viết nội dung bài tại đây...");
  const [category, setCategory] = useState(initialArticle?.category || "Sự nghiệp");
  const [readTime, setReadTime] = useState(initialArticle?.readTime ? String(initialArticle.readTime) : "");
  const [status, setStatus] = useState(initialArticle?.status || "Bản nháp");
  const [publishedAt, setPublishedAt] = useState(initialArticle?.publishedAt || new Date().toISOString().slice(0, 10));
  const [tags, setTags] = useState((initialArticle?.tags || []).join(", "));
  const [metaDescription, setMetaDescription] = useState(initialArticle?.metaDescription || "");
  const [bonusViews, setBonusViews] = useState(initialArticle?.bonusViews ? String(initialArticle.bonusViews) : "");
  const [showViews, setShowViews] = useState(initialArticle?.showViews !== false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [articleCover, setArticleCover] = useState(initialArticle?.image || "");

  // Ước tính thời gian đọc (~200 từ/phút) nếu chưa nhập
  const estimatedReadTime = Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const data = {
      title: title.trim(),
      category,
      readTime: Number(readTime) || estimatedReadTime,
      excerpt: excerpt.trim(),
      content,
      image: articleCover.trim(),
      status,
      publishedAt,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      metaDescription: metaDescription.trim(),
      bonusViews: Math.max(0, Number(bonusViews) || 0),
      showViews,
      author: "Tia Nguyễn",
      updatedAt: new Date().toISOString(),
    };
    try {
      if (articleId) {
        await updateDoc(doc(db, "articles", articleId), data);
      } else {
        const ref = await addDoc(collection(db, "articles"), { ...data, views: 0, createdAt: new Date().toISOString() });
        setArticleId(ref.id);
      }
      setSaved(true);
    } catch {
      setSaveError("Không thể lưu bài viết lên Firestore. Kiểm tra kết nối và Firestore Rules.");
    } finally {
      setSaving(false);
    }
  };
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");

  const uploadArticleImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImageError("");
    setImageUploading(true);
    try {
      const url = await uploadImageToCloudinary(file);
      const alt = file.name.replace(/\.[^.]+$/, "");
      insertFormat("\n\n![", `](${url})\n\n`, alt);
    } catch (err) {
      setImageError((err as Error).message);
    } finally {
      setImageUploading(false);
    }
  };

  const insertFormat = (before: string, after: string, placeholder: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    setContent(next);
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const renderPreviewBlock = (block: string, index: number) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed === "---") return <hr key={index} />;
    if (trimmed.startsWith("## ")) return <h2 key={index}>{trimmed.slice(3)}</h2>;
    if (trimmed.startsWith("# ")) return <h1 key={index}>{trimmed.slice(2)}</h1>;
    if (trimmed.startsWith("> [!NOTE]")) return <aside key={index}>{trimmed.replace("> [!NOTE]", "").trim()}</aside>;
    if (trimmed.startsWith("> ")) return <blockquote key={index}>{trimmed.slice(2)}</blockquote>;
    if (trimmed.startsWith("![")) {
      const match = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
      return match ? <figure key={index}><img src={match[2]} alt={match[1]} /><figcaption>{match[1]}</figcaption></figure> : null;
    }
    if (trimmed.split("\n").every((line) => line.startsWith("- "))) return <ul key={index}>{trimmed.split("\n").map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
    if (trimmed.split("\n").every((line) => /^\d+\. /.test(line))) return <ol key={index}>{trimmed.split("\n").map((line) => <li key={line}>{line.replace(/^\d+\. /, "")}</li>)}</ol>;
    return <p key={index}>{trimmed.replace(/\*\*/g, "").replace(/\*/g, "")}</p>;
  };

  return <FormPageShell eyebrow="CMS BÀI VIẾT" title={articleId ? "Chỉnh sửa bài viết" : "Viết bài mới"} description={articleId ? "Cập nhật nội dung, ảnh cover và thông tin xuất bản." : "Tạo nội dung dài, tối ưu chia sẻ và xuất bản lên Góc viết."} onBack={onBack}>
    <form className="admin-editor-form" onSubmit={submit}>
      {saved && <div className="admin-form-success"><AdminIcon name="check" />{status === "Đã xuất bản" ? "Đã lưu. Bài viết đang hiển thị trên Góc viết." : `Đã lưu bài viết (${status}).`}</div>}
      {saveError && <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: "10px", padding: "12px 16px", color: "#c00", marginBottom: "16px" }}>{saveError}</div>}
      <section><header><span>01</span><div><h2>Nội dung bài viết</h2><p>Thông tin chính người đọc sẽ nhìn thấy.</p></div></header>
        <div className="admin-form-grid">
          <label className="wide"><span>Tiêu đề</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tiêu đề bài viết" /></label>
          <label><span>Chủ đề</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>Sự nghiệp</option><option>Remote work</option><option>Hiểu mình</option><option>Tài chính</option></select></label>
          <label><span>Thời gian đọc (phút)</span><input type="number" min="1" value={readTime} onChange={(e) => setReadTime(e.target.value)} placeholder={`Tự tính: ${estimatedReadTime} phút`} /></label>
          <label><span>Lượt đọc cộng thêm (X)</span><input type="number" min="0" value={bonusViews} onChange={(e) => setBonusViews(e.target.value)} placeholder="0" /><small style={{ opacity: 0.65 }}>Web hiện: {(initialArticle?.views || 0).toLocaleString("vi-VN")} lượt đọc thật + {(Number(bonusViews) || 0).toLocaleString("vi-VN")} = {((initialArticle?.views || 0) + (Number(bonusViews) || 0)).toLocaleString("vi-VN")}</small></label>
          <label><span>Hiển thị lượt đọc</span><select value={showViews ? "yes" : "no"} onChange={(e) => setShowViews(e.target.value === "yes")}><option value="yes">Hiện lượt đọc trên web</option><option value="no">Ẩn lượt đọc</option></select></label>
          <label className="wide"><span>Mô tả mở đầu</span><textarea required rows={3} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="Đoạn giới thiệu ngắn..." /></label>
          <div className="rich-article-editor wide">
            <header>
              <div><button type="button" className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>Soạn thảo</button><button type="button" className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>Xem trước</button></div>
              <span>Nhớ bấm Lưu để không mất bài</span>
            </header>
            {mode === "edit" ? <>
              <div className="article-format-toolbar">
                <button type="button" title="Tiêu đề lớn" onClick={() => insertFormat("# ", "", "Tiêu đề lớn")}>H1</button>
                <button type="button" title="Tiêu đề phần" onClick={() => insertFormat("## ", "", "Tiêu đề phần")}>H2</button>
                <i />
                <button type="button" title="In đậm" onClick={() => insertFormat("**", "**", "Nội dung in đậm")}><strong>B</strong></button>
                <button type="button" title="In nghiêng" onClick={() => insertFormat("*", "*", "Nội dung in nghiêng")}><em>I</em></button>
                <button type="button" title="Trích dẫn" onClick={() => insertFormat("> ", "", "Trích dẫn nổi bật")}>" "</button>
                <i />
                <button type="button" title="Danh sách" onClick={() => insertFormat("- ", "\n- Mục tiếp theo", "Mục đầu tiên")}>• List</button>
                <button type="button" title="Danh sách số" onClick={() => insertFormat("1. ", "\n2. Mục tiếp theo", "Mục đầu tiên")}>1. List</button>
                <button type="button" title="Liên kết" onClick={() => insertFormat("[", "](https://)", "Tên liên kết")}>Link</button>
                <button type="button" title="Tải ảnh từ máy lên và chèn vào bài" disabled={imageUploading} onClick={() => imageInputRef.current?.click()}>{imageUploading ? "Đang tải..." : "Ảnh"}</button>
                <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadArticleImage} style={{ display: "none" }} />
                <button type="button" title="Khối ghi chú" onClick={() => insertFormat("> [!NOTE]\n", "", "Nội dung cần lưu ý")}>Callout</button>
                <button type="button" title="Đường phân cách" onClick={() => insertFormat("\n\n---\n\n", "", "")}>—</button>
              </div>
              {imageError && <small style={{ display: "block", margin: "6px 0", color: "#c00" }}>{imageError}</small>}
              <textarea ref={editorRef} className="article-editor rich-content-area" required rows={18} value={content} onChange={(event) => setContent(event.target.value)} />
            </> : <article className="admin-article-preview">
              <span className="preview-category">GÓC VIẾT TIAHERE</span>
              <h1>{title || "Tiêu đề bài viết"}</h1>
              <p className="preview-excerpt">{excerpt || "Mô tả mở đầu của bài viết sẽ xuất hiện tại đây."}</p>
              <div className="preview-author"><span>TN</span><div><strong>Tia Nguyễn</strong><small>Người viết tại tiahere</small></div></div>
              <div className="preview-body">{content.split(/\n{2,}/).map(renderPreviewBlock)}</div>
            </article>}
          </div>
        </div>
      </section>
      <section><header><span>02</span><div><h2>Xuất bản & SEO</h2><p>Ảnh cover, trạng thái và thông tin chia sẻ.</p></div></header>
        <div className="admin-form-grid"><div className="wide"><span style={{ display: "block", marginBottom: 8 }}>Ảnh cover bài viết</span><CoverUploadBox variant="landscape" title="Tải ảnh cover" hint="Hiển thị đầu bài và khi chia sẻ" size="Khuyến nghị 1600 × 900px · 16:9" value={articleCover} onChange={setArticleCover} /></div><label className="wide"><span>Hoặc URL ảnh cover</span><input type="url" value={articleCover} onChange={(e) => setArticleCover(e.target.value)} placeholder="https://..." /></label><label><span>Tác giả</span><select><option>Tia Nguyễn</option></select></label><label><span>Kiểu trình bày</span><select><option>Editorial</option><option>Tối giản</option><option>Ảnh lớn</option></select></label><label><span>Trạng thái</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option>Bản nháp</option><option>Đã xuất bản</option><option>Tạm ẩn</option></select></label><label><span>Ngày xuất bản</span><input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} /></label><label className="wide"><span>Tags (cách nhau bằng dấu phẩy)</span><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Sự nghiệp, hiểu mình, remote work..." /></label><label className="wide"><span>Meta description</span><textarea rows={2} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Mô tả hiển thị trên Google và mạng xã hội..." /></label></div>
      </section>
      <footer><button type="button" className="secondary" onClick={onBack}>Quay lại</button><button type="submit" disabled={saving}>{saving ? "Đang lưu..." : articleId ? "Lưu thay đổi" : "Lưu bài viết"}</button></footer>
    </form>
  </FormPageShell>;
}

function EditDocumentContentPage({ documentTitle, onBack }: { documentTitle: string; onBack: () => void }) {
  const [chapters, setChapters] = useState(["Bắt đầu hành trình", "Nhìn lại điểm xuất phát", "Khung thực hành", "Kế hoạch tiếp theo"]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [saved, setSaved] = useState(false);

  const addChapter = () => {
    setChapters((items) => [...items, `Chương mới ${items.length + 1}`]);
    setActiveChapter(chapters.length);
    setSaved(false);
  };

  return <FormPageShell eyebrow="NỘI DUNG TÀI LIỆU" title={`Chỉnh sửa: ${documentTitle}`} description="Soạn nội dung và sắp xếp các chương hiển thị trong trình đọc tiahere." onBack={onBack}>
    {saved && <div className="admin-form-success content-save-notice"><AdminIcon name="check" />Nội dung tài liệu đã được lưu.</div>}
    <div className="document-editor-layout">
      <aside className="chapter-manager">
        <header><div><span>MỤC LỤC</span><strong>{chapters.length} chương</strong></div><button onClick={addChapter}><AdminIcon name="plus" size={15} /></button></header>
        <nav>{chapters.map((chapter, index) => <button className={activeChapter === index ? "active" : ""} key={`${chapter}-${index}`} onClick={() => setActiveChapter(index)}><i>{String(index + 1).padStart(2, "0")}</i><span>{chapter}</span></button>)}</nav>
        <button className="preview-document">Xem trước tài liệu</button>
      </aside>
      <form className="chapter-editor" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
        <header><div><span>CHƯƠNG {String(activeChapter + 1).padStart(2, "0")}</span><h2>{chapters[activeChapter]}</h2></div><Status>Đã xuất bản</Status></header>
        <label><span>Tên chương</span><input value={chapters[activeChapter]} onChange={(event) => setChapters((items) => items.map((item, index) => index === activeChapter ? event.target.value : item))} /></label>
        <label><span>Nội dung mở đầu</span><textarea rows={4} defaultValue="Đây là phần giới thiệu giúp người đọc hiểu mục tiêu và cách sử dụng nội dung trong chương này." /></label>
        <label><span>Nội dung chương</span><textarea className="chapter-content-area" rows={16} defaultValue={"Nội dung được thiết kế để bạn có thể đọc theo tốc độ riêng. Hãy dừng lại ở những câu hỏi khiến bạn suy nghĩ.\\n\\n## Bắt đầu từ điều đang diễn ra\\n\\nQuan sát công việc và cuộc sống hiện tại qua những điều đang cho bạn năng lượng, điều đang lấy đi năng lượng và điều bạn muốn có nhiều hơn."} /></label>
        <fieldset className="admin-check-group"><legend>Tuỳ chọn bảo vệ</legend><label><input type="checkbox" defaultChecked /> Watermark email</label><label><input type="checkbox" defaultChecked /> Hạn chế copy</label></fieldset>
        <footer><button type="button" className="danger-text" onClick={() => setChapters((items) => items.filter((_, index) => index !== activeChapter))}>Xoá chương</button><button type="submit">Lưu nội dung</button></footer>
      </form>
    </div>
  </FormPageShell>;
}

function GrantAccessPage({ products, onBack }: { products: (typeof initialProducts); onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [productId, setProductId] = useState("");
  const [source, setSource] = useState("Admin cấp");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setResult("");
    try {
      const found = await getDocs(query(collection(db, "users"), where("email", "==", email.trim().toLowerCase())));
      const fallback = found.empty ? await getDocs(query(collection(db, "users"), where("email", "==", email.trim()))) : found;
      if (fallback.empty) {
        setError("Không tìm thấy tài khoản với email này. Thành viên cần đăng ký tài khoản tiahere trước.");
        return;
      }
      const userDoc = fallback.docs[0];
      const product = products.find((item) => item.id === productId);
      const code = adminCode("ADM");
      // Ghi cùng lúc: thêm quyền + lưu một đơn "Đã xác nhận" để có lịch sử
      const batch = writeBatch(db);
      batch.set(doc(db, "users", userDoc.id), { ownedProducts: arrayUnion(productId) }, { merge: true });
      batch.set(doc(db, "orders", code), {
        code, uid: userDoc.id, email: String(userDoc.data().email || email), name: String(userDoc.data().name || ""),
        productId, productTitle: product?.name || "", productKind: "", priceLabel: source, amount: 0,
        status: "Đã xác nhận", source, note: note.trim(), createdAt: new Date().toISOString(), confirmedAt: new Date().toISOString(),
      });
      await batch.commit();
      setResult(`Đã mở quyền "${product?.name}" cho ${email.trim()}. Thành viên tải lại trang là thấy sản phẩm.`);
      setEmail("");
      setNote("");
    } catch {
      setError("Chưa cấp được quyền. Kiểm tra kết nối và Firestore Rules.");
    } finally {
      setSaving(false);
    }
  };

  return <FormPageShell eyebrow="ENTITLEMENTS" title="Cấp quyền truy cập" description="Cấp sản phẩm thủ công cho một thành viên (quà tặng, khách mua qua Zalo...). Quyền được dùng vĩnh viễn." onBack={onBack}>
    <form className="admin-editor-form compact-form" onSubmit={submit}>
      {result && <div className="admin-form-success"><AdminIcon name="check" />{result}</div>}
      {error && <div style={errorBoxStyle}>{error}</div>}
      <section><header><span>01</span><div><h2>Chọn thành viên</h2><p>Nhập đúng email thành viên đã dùng để đăng ký tiahere.</p></div></header>
        <div className="admin-form-grid"><label className="wide"><span>Email thành viên</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@gmail.com" /></label></div>
      </section>
      <section><header><span>02</span><div><h2>Quyền được cấp</h2><p>Chọn sản phẩm và lý do cấp quyền.</p></div></header>
        <div className="admin-form-grid">
          <label className="wide"><span>Sản phẩm</span><select required value={productId} onChange={(e) => setProductId(e.target.value)}><option value="" disabled>Chọn sản phẩm</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status !== "Đang bán" ? ` (${item.status})` : ""}</option>)}</select></label>
          <label><span>Nguồn cấp quyền</span><select value={source} onChange={(e) => setSource(e.target.value)}><option>Admin cấp</option><option>Quà tặng</option><option>Thanh toán qua Zalo</option><option>Mã ưu đãi</option></select></label>
          <label className="wide"><span>Ghi chú nội bộ</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lý do hoặc thông tin cần lưu..." /></label>
        </div>
      </section>
      <footer><button type="button" className="secondary" onClick={onBack}>Quay lại</button><button type="submit" disabled={saving}>{saving ? "Đang cấp quyền..." : "Xác nhận cấp quyền"}</button></footer>
    </form>
  </FormPageShell>;
}

function BlockSlotsPage({ onBack }: { onBack: () => void }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<string, { type: string; reason?: string }>>({});
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const today = adminToday();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const monthLabel = month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  useEffect(() => {
    getDocs(collection(db, "slots"))
      .then((snapshot) => {
        const map: Record<string, { type: string; reason?: string }> = {};
        snapshot.docs.forEach((d) => { map[d.id] = { type: String(d.data().type || "booked"), reason: d.data().reason }; });
        setSlots(map);
      })
      .catch(() => setError("Không tải được lịch. Kiểm tra Firestore Rules."));
  }, []);

  const blockedDates = Object.keys(slots).filter((date) => slots[date].type === "blocked" && date >= today).sort();

  const toggleDate = (value: string) => {
    setSelectedDates((dates) => dates.includes(value) ? dates.filter((date) => date !== value) : [...dates, value]);
    setSaved(false);
  };

  const saveBlocks = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const batch = writeBatch(db);
      selectedDates.forEach((date) => batch.set(doc(db, "slots", date), { type: "blocked", reason: reason.trim(), createdAt: new Date().toISOString() }));
      await batch.commit();
      setSlots((current) => { const next = { ...current }; selectedDates.forEach((date) => { next[date] = { type: "blocked", reason: reason.trim() }; }); return next; });
      setSelectedDates([]);
      setReason("");
      setSaved(true);
    } catch {
      setError("Chưa lưu được. Có thể một ngày vừa có người đặt, tải lại trang và thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const unblock = async (date: string) => {
    try {
      await deleteDoc(doc(db, "slots", date));
      setSlots((current) => { const next = { ...current }; delete next[date]; return next; });
    } catch {
      setError("Chưa mở lại được ngày này.");
    }
  };

  return <FormPageShell eyebrow="LỊCH ĐỒNG HÀNH 1:1" title="Chặn khung giờ" description="Chọn một hoặc nhiều ngày Tia không thể nhận lịch call 20:30–21:00." onBack={onBack}>
    <form className="block-slot-layout" onSubmit={saveBlocks}>
      <section className="admin-block-calendar">
        <header><button type="button" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><AdminIcon name="arrow" /></button><h2>{monthLabel}</h2><button type="button" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><AdminIcon name="arrow" /></button></header>
        <div className="admin-calendar-weekdays">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="admin-calendar-days">
          {Array.from({ length: startOffset }).map((_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const date = new Date(year, monthIndex, day);
            const value = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const availableDay = [2, 4, 5].includes(date.getDay()) && value > today;
            const blocked = slots[value]?.type === "blocked";
            const booked = slots[value]?.type === "booked";
            const selected = selectedDates.includes(value);
            return <button type="button" key={value} disabled={!availableDay || booked || blocked} className={`${!availableDay ? "unavailable" : ""} ${booked ? "booked" : ""} ${blocked ? "blocked" : ""} ${selected ? "selected" : ""}`} onClick={() => toggleDate(value)}>{day}</button>;
          })}
        </div>
        <div className="admin-calendar-legend"><span><i className="open" />Có thể chặn</span><span><i className="booked" />Đã có lịch</span><span><i className="blocked" />Đã chặn</span><span><i className="selected" />Đang chọn</span></div>
      </section>
      <aside className="block-slot-form">
        {saved && <div className="admin-form-success"><AdminIcon name="check" />Đã cập nhật lịch nhận call.</div>}
        {error && <div style={errorBoxStyle}>{error}</div>}
        <div className="block-time"><AdminIcon name="meetings" /><div><span>KHUNG GIỜ ÁP DỤNG</span><strong>20:30–21:00</strong><small>Thứ 3, thứ 5 và thứ 6</small></div></div>
        <label><span>Ngày đang chọn</span><strong>{selectedDates.length ? `${selectedDates.length} ngày` : "Chưa chọn ngày"}</strong></label>
        <label><span>Lý do chặn lịch (chỉ admin thấy)</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Ví dụ: Lịch cá nhân, nghỉ lễ..." /></label>
        <button type="submit" disabled={!selectedDates.length || !reason.trim() || saving}>{saving ? "Đang lưu..." : "Xác nhận chặn khung giờ"}</button>
        <p>Những ngày đã chặn sẽ hiện là kín lịch trên calendar của thành viên.</p>
        <section className="blocked-list"><h3>Khung giờ đã chặn</h3>{blockedDates.length === 0 ? <p style={{ opacity: 0.7 }}>Chưa chặn ngày nào.</p> : blockedDates.map((date) => <div key={date}><span>{adminDateLabel(date)}</span><small>{slots[date].reason || "20:30–21:00"}</small><button type="button" onClick={() => unblock(date)}>Mở lại</button></div>)}</section>
      </aside>
    </form>
  </FormPageShell>;
}

function MeetingNotePage({ meeting, onBack, onSend }: { meeting: (typeof initialMeetings)[number]; onBack: () => void; onSend: (event: AdminEvent) => void }) {
  const [privateNote, setPrivateNote] = useState("");
  const [userNote, setUserNote] = useState("");
  const [privateSaved, setPrivateSaved] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Tải lại note đã lưu: note riêng của admin (collection adminNotes) và note đã gửi user (trong lịch)
  useEffect(() => {
    getDoc(doc(db, "adminNotes", meeting.id)).then((snap) => { if (snap.exists()) setPrivateNote(String(snap.data().note || "")); }).catch(() => {});
    getDoc(doc(db, "bookings", meeting.id)).then((snap) => { if (snap.exists() && snap.data().userNote) setUserNote(String(snap.data().userNote)); }).catch(() => {});
  }, [meeting.id]);

  const savePrivate = async () => {
    setError("");
    try {
      await setDoc(doc(db, "adminNotes", meeting.id), { note: privateNote, email: meeting.email, date: meeting.date, updatedAt: new Date().toISOString() });
      setPrivateSaved(true);
    } catch {
      setError("Chưa lưu được note cá nhân. Kiểm tra Firestore Rules (collection adminNotes).");
    }
  };

  const sendToUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateDoc(doc(db, "bookings", meeting.id), { userNote: userNote.trim(), userNoteSentAt: new Date().toISOString() });
      notifyUser(meeting.uid, "Ghi chú sau buổi call từ Tia", `Tia đã gửi ghi chú cho buổi call ${adminDateLabel(meeting.date)}. Bấm để đọc.`, "#trang-ca-nhan/lich-call");
      sendAdminEmail({ type: "meeting_note", email: meeting.email, name: meeting.name, date: adminDateLabel(meeting.date, true), note: userNote.trim() });
      onSend({
        email: meeting.email,
        title: "Tia đã gửi note của buổi call meeting",
        message: "Tia đã gửi note của buổi call meeting, bạn kiểm tra email để xem chi tiết nhé.",
      });
      setSent(true);
    } catch {
      setError("Chưa gửi được note. Thử lại nhé.");
    } finally {
      setBusy(false);
    }
  };

  return <FormPageShell eyebrow="ĐỒNG HÀNH 1:1" title="Note sau buổi call" description="Lưu ghi chú nội bộ và gửi bản tổng kết riêng cho thành viên." onBack={onBack}>
    <section className="meeting-note-summary">
      <time><strong>{meeting.date.slice(8, 10)}</strong><span>THÁNG {Number(meeting.date.slice(5, 7))}</span></time>
      <div><span>{meeting.plan.toUpperCase()}</span><h2>{meeting.name}</h2><p>{meeting.email} · {adminDateLabel(meeting.date, true)} · 20:30–21:00</p><small>{meeting.issue}{meeting.topic ? ` · ${meeting.topic}` : ""}</small></div>
      <Status>{meeting.status}</Status>
    </section>
    {error && <div style={errorBoxStyle}>{error}</div>}
    <div className="meeting-note-grid">
      <section className="note-editor private-note">
        <header><span><AdminIcon name="settings" /></span><div><h2>Note cá nhân của Admin</h2><p>Chỉ Super Admin có thể xem nội dung này.</p></div></header>
        {privateSaved && <div className="admin-form-success"><AdminIcon name="check" />Đã lưu note cá nhân.</div>}
        <label><span>Ghi chú sau buổi call</span><textarea value={privateNote} onChange={(event) => { setPrivateNote(event.target.value); setPrivateSaved(false); }} rows={12} placeholder="Ghi lại quan sát, bối cảnh, điều cần theo dõi ở buổi tiếp theo..." /></label>
        <button disabled={!privateNote.trim()} onClick={savePrivate}>Lưu note cá nhân</button>
      </section>
      <form className="note-editor user-note" onSubmit={sendToUser}>
        <header><span><AdminIcon name="members" /></span><div><h2>Gửi note cho thành viên</h2><p>Nội dung sẽ được gửi tới email đăng ký.</p></div></header>
        {sent && <div className="admin-form-success"><AdminIcon name="check" />Đã gửi email và thông báo cho thành viên.</div>}
        <label><span>Nội dung gửi cho user</span><textarea required value={userNote} onChange={(event) => { setUserNote(event.target.value); setSent(false); }} rows={9} placeholder="Tóm tắt điều đã trao đổi, những điểm thành viên cần lưu ý và bước tiếp theo..." /></label>
        <div className="note-email-preview"><span>EMAIL NGƯỜI NHẬN</span><strong>{meeting.email}</strong><p>Note cũng được lưu trong mục Lịch call ở trang cá nhân của thành viên.</p></div>
        <button type="submit" disabled={!userNote.trim() || busy}>{busy ? "Đang gửi..." : "Gửi note qua email"}</button>
      </form>
    </div>
  </FormPageShell>;
}

// ─── MAIN ADMIN APP ───────────────────────────────────────────────────────────

export default function AdminApp({ onExit, onAdminEvent }: { onExit: () => void; onAdminEvent: (event: AdminEvent) => void }) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [subpage, setSubpage] = useState<AdminSubpage | null>(null);
  const [productItems, setProductItems] = useState(initialProducts);

  // Tải danh sách sản phẩm từ Firestore khi mở Admin
  useEffect(() => {
    getDocs(collection(db, "products"))
      .then((snapshot) => {
        setProductItems(snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            name: data.name || data.title || "",
            type: data.type || "Tài liệu",
            price: data.price || "0đ",
            sold: data.sold || 0,
            status: data.status || "Bản nháp",
          } as (typeof initialProducts)[number];
        }));
      })
      .catch(() => { /* lỗi kết nối — giữ danh sách rỗng */ });
  }, []);
  const [search, setSearch] = useState("");
  const [adminNotices, setAdminNotices] = useState<(AdminEvent & { id: number; time: string; incoming?: boolean })[]>([]);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);

  // Theo dõi trực tiếp đơn hàng & lịch call đang chờ: cập nhật số trên sidebar
  // và báo ở chuông khi có đơn/lịch mới trong lúc Admin đang mở
  useEffect(() => {
    const pushNotice = (title: string, message: string, email: string) => setAdminNotices((items) => [{
      email, title, message, incoming: true, id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    }, ...items]);
    let firstOrders = true;
    let firstBookings = true;
    const stopOrders = onSnapshot(query(collection(db, "orders"), where("status", "==", "Chờ xác nhận")), (snapshot) => {
      setPendingOrderCount(snapshot.size);
      if (!firstOrders) {
        snapshot.docChanges().filter((change) => change.type === "added").forEach((change) => {
          const order = change.doc.data();
          pushNotice("Đơn hàng mới", `${order.name || order.email} đặt mua ${order.productTitle} · ${order.priceLabel} · mã ${change.doc.id}`, String(order.email || ""));
        });
      }
      firstOrders = false;
    }, () => { /* lỗi quyền hoặc mạng — bỏ qua, trang Đơn hàng vẫn tải riêng */ });
    const stopBookings = onSnapshot(query(collection(db, "bookings"), where("status", "==", "Chờ xác nhận")), (snapshot) => {
      setPendingBookingCount(snapshot.size);
      if (!firstBookings) {
        snapshot.docChanges().filter((change) => change.type === "added").forEach((change) => {
          const booking = change.doc.data();
          pushNotice("Lịch call mới", `${booking.name || booking.email} đặt lịch ngày ${adminDateLabel(String(booking.date || ""))}`, String(booking.email || ""));
        });
      }
      firstBookings = false;
    }, () => {});
    return () => { stopOrders(); stopBookings(); };
  }, []);

  // Hiện số việc đang chờ trên tab trình duyệt, ví dụ "(2) tiahere Admin"
  useEffect(() => {
    const total = pendingOrderCount + pendingBookingCount;
    const base = "tiahere Admin";
    document.title = total ? `(${total}) ${base}` : base;
  }, [pendingOrderCount, pendingBookingCount]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<(typeof initialProducts)[number] | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingArticle, setEditingArticle] = useState<AdminArticle | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<(typeof initialMeetings)[number] | null>(null);
  const products = useMemo(() => productItems.filter((product) => product.name.toLowerCase().includes(search.toLowerCase())), [productItems, search]);
  const handleConfirmed = (event: AdminEvent) => {
    setAdminNotices((items) => [{ ...event, id: Date.now(), time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) }, ...items]);
    onAdminEvent(event);
  };

  const page = subpage === "add-product" ? <AddProductPage allProducts={productItems} onBack={() => setSubpage(null)} onSave={(product) => setProductItems((items) => items.some((item) => item.id === product.id) ? items.map((item) => item.id === product.id ? product : item) : [...items, product])} onDeleted={(id) => { setProductItems((items) => items.filter((item) => item.id !== id)); setSubpage(null); }} />
    : subpage === "edit-product" && editingProduct ? <AddProductPage allProducts={productItems} initialProduct={editingProduct} onDeleted={(id) => { setProductItems((items) => items.filter((item) => item.id !== id)); setSubpage(null); }} onBack={() => setSubpage(null)} onSave={(product) => setProductItems((items) => items.map((item) => item.id === product.id ? product : item))} />
    : subpage === "add-article" ? <AddArticlePage onBack={() => setSubpage(null)} />
      : subpage === "edit-article" && editingArticle ? <AddArticlePage key={editingArticle.id} initialArticle={editingArticle} onBack={() => setSubpage(null)} />
        : subpage === "edit-content" ? <EditDocumentContentPage documentTitle={editingTitle} onBack={() => setSubpage(null)} />
      : subpage === "grant-access" ? <GrantAccessPage products={productItems} onBack={() => setSubpage(null)} />
        : subpage === "block-slot" ? <BlockSlotsPage onBack={() => setSubpage(null)} />
          : subpage === "meeting-note" && selectedMeeting ? <MeetingNotePage meeting={selectedMeeting} onBack={() => setSubpage(null)} onSend={handleConfirmed} />
        : section === "overview" ? <Overview setSection={setSection} />
    : section === "products" ? <ProductsPage products={products} onAdd={() => setSubpage("add-product")} onEdit={(product) => { setEditingProduct(product); setSubpage("edit-product"); }} onDeleted={(id) => setProductItems((items) => items.filter((item) => item.id !== id))} />
      : section === "orders" ? <OrdersPage onConfirmed={handleConfirmed} />
      : section === "registrations" ? <RegistrationsPage products={productItems} />
        : section === "members" ? <MembersPage products={productItems} />
        : section === "access" ? <AccessPage products={productItems} onGrant={() => setSubpage("grant-access")} />
          : section === "meetings" ? <MeetingsPage onBlock={() => setSubpage("block-slot")} onConfirmed={handleConfirmed} onNote={(meeting) => { setSelectedMeeting(meeting); setSubpage("meeting-note"); }} />
            : section === "articles" ? <ArticlesAdminPage onAdd={() => setSubpage("add-article")} onEdit={(article) => { setEditingArticle(article); setSubpage("edit-article"); }} />
            : section === "mentoring" ? <MentoringSettingsPage onBack={() => setSection("overview")} />
              : section === "analytics" ? <AnalyticsPage />
                : section === "legal" ? <LegalAdminPage />
                : section === "announcements" ? <AnnouncementsPage products={productItems} />
                : section === "settings" ? <SettingsPage />
                  : <SimpleContentPage
                      section={section}
                      onAction={() => setSubpage(section === "articles" ? "add-article" : section === "access" ? "grant-access" : section === "products" ? "add-product" : null)}
                      onEdit={(name) => {
                        setEditingTitle(name);
                        if (section === "content") setSubpage("edit-content");
                        if (section === "articles") setSubpage("edit-article");
                      }}
                    />;

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><span>t</span><div><strong>tiahere</strong><small>Admin workspace</small></div></div>
      <nav>{navItems.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => { setSection(item.id); setSubpage(null); }}><AdminIcon name={item.id} /><span>{item.label}</span>{(() => {
        const count = item.id === "orders" ? pendingOrderCount : item.id === "meetings" ? pendingBookingCount : item.id === "overview" ? pendingOrderCount + pendingBookingCount : 0;
        return count > 0 ? <b title={`${count} việc đang chờ xử lý`} style={{ marginLeft: "auto", minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: "#c0392b", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{count}</b> : null;
      })()}</button>)}</nav>
      <button className="admin-exit" onClick={onExit}><AdminIcon name="logout" /><span>Về trang thành viên</span></button>
      <div className="admin-profile"><span>TN</span><div><strong>Tia Nguyễn</strong><small>Super Admin</small></div></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar">
        <label><AdminIcon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm, đơn hàng, thành viên..." /></label>
        <div className="admin-top-actions">
          <div className="admin-notice-wrap">
            <button className="admin-notification" onClick={() => setNoticeOpen((open) => !open)}><AdminIcon name="bell" />{adminNotices.length > 0 && <i />}</button>
            {noticeOpen && <div className="admin-notice-panel"><header><strong>Thông báo &amp; hoạt động</strong><span>{adminNotices.length}</span></header>{adminNotices.length ? adminNotices.map((notice) => <article key={notice.id}><span><AdminIcon name="check" size={14} /></span><div><strong>{notice.title}</strong><p>{notice.incoming ? notice.message : `Email đã gửi tới ${notice.email}`}</p><small>{notice.time}</small></div></article>) : <p>Chưa có hoạt động mới.</p>}</div>}
          </div>
          <span className="admin-role">SUPER ADMIN</span><span className="admin-avatar">TN</span>
        </div>
      </header>
      <div className="admin-content">{page}</div>
    </section>
  </main>;
}
