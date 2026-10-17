// Công cụ "Xây dựng tài khoản tiết kiệm sự nghiệp" (TKTKSN) - 8 bước, 11 bảng
// Bài làm tự lưu vào Firestore: users/{uid}/worksheets/{productId}
// AI gọi qua Cloudflare Worker (xác thực bằng Firebase ID token + quyền sở hữu sản phẩm)
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, appCheckToken } from "./firebase";
import { HM_CSS, Area } from "./HieuMinhTool";

const AI_PROXY_URL = "https://tiahere-ai-proxy.thutrang-vhh.workers.dev";
const AI_MAX_PER_BUTTON = 3; // mỗi nút AI dùng tối đa 3 lần

type B4Row = { ten: string; bang1: string; bang2: string; lien_he: string; danh_gia: string };
type B5Row = { ten: string; loai: string; tan_suat: string; minh_co: string };
type B8Row = { ten: string; tan_suat: string; loai: string; bang2: string };
type AiKey = "b4" | "b5" | "b6" | "b8" | "trait" | "roadmap";

type TkData = {
  f: Record<string, string>; // các ô nhập chữ
  b4: B4Row[];
  b5: B5Row[];
  b8: B8Row[];
  jd: string[];
  rg: Record<string, string>; // các lựa chọn nút (Bảng 9a, 9d)
  wt: boolean[]; // Bảng 11
  rm: Record<string, string[]>; // lộ trình theo tuần: { "rm12_0": [4 ô] }
  ai: Partial<Record<AiKey, number>>; // số lần đã dùng mỗi nút AI
  step: number;
};

type ToolUser = { name: string; email: string };
type ToolProduct = { id: string; title: string };

const emptyB4 = (): B4Row => ({ ten: "", bang1: "Có", bang2: "Có", lien_he: "", danh_gia: "strong" });
const emptyB5 = (): B5Row => ({ ten: "", loai: "Đơn lẻ", tan_suat: "", minh_co: "Có" });
const emptyB8 = (): B8Row => ({ ten: "", tan_suat: "", loai: "Đơn lẻ", bang2: "Có" });

function emptyData(): TkData {
  return {
    f: {},
    b4: Array.from({ length: 5 }, emptyB4),
    b5: Array.from({ length: 5 }, emptyB5),
    b8: Array.from({ length: 4 }, emptyB8),
    jd: ["", "", "", "", "", ""],
    rg: {},
    wt: Array(8).fill(false),
    rm: {},
    ai: {},
    step: 1,
  };
}

function normalize(raw: Record<string, unknown>): TkData {
  const base = emptyData();
  const r = raw as Partial<TkData>;
  return {
    f: r.f && typeof r.f === "object" ? r.f : {},
    b4: Array.isArray(r.b4) && r.b4.length ? r.b4 : base.b4,
    b5: Array.isArray(r.b5) && r.b5.length ? r.b5 : base.b5,
    b8: Array.isArray(r.b8) && r.b8.length ? r.b8 : base.b8,
    jd: Array.isArray(r.jd) && r.jd.length >= 6 ? r.jd : [...(r.jd || []), ...base.jd].slice(0, Math.max(6, r.jd?.length || 0)),
    rg: r.rg && typeof r.rg === "object" ? r.rg : {},
    wt: Array.isArray(r.wt) ? [...r.wt, ...Array(8).fill(false)].slice(0, 8) : base.wt,
    rm: r.rm && typeof r.rm === "object" ? r.rm : {},
    ai: r.ai && typeof r.ai === "object" ? r.ai : {},
    step: Math.min(8, Math.max(1, Number(r.step || 1))),
  };
}

const STEPS = [
  { n: 1, name: "Thu thập dữ liệu thô" },
  { n: 2, name: "Lọc dữ liệu" },
  { n: 3, name: "Nghiên cứu thị trường" },
  { n: 4, name: "Điểm giao thoa" },
  { n: 5, name: "Đo khoảng cách" },
  { n: 6, name: "Kiểm kê tài khoản" },
  { n: 7, name: "Hình thức làm việc" },
  { n: 8, name: "Lộ trình 6 tháng" },
];

// Popup hướng dẫn (bản nháp - Tia chỉnh lại sau)
const TK_GUIDE = [
  "Dành khoảng 60' tập trung để làm worksheet này nhé. Nếu bạn chia ra để làm từ 2-3 lần thì cũng không sao cả.",
  "Bạn nên làm lần lượt từ bước 1 đến bước 8. Vì phần sau lấy kết quả của phần trước, có \"nhảy cóc\" hay bỏ qua thì bạn vẫn phải quay lại đó mà thôi.",
  "Bước 1 là nền tảng, bạn càng trả lời chi tiết càng tốt nhé.",
  "Bước 3 cần ít nhất 6 mô tả công việc (JD) thật, bạn nên lưu lại nội dung JD đã sử dụng để xem lại khi cần nhé!",
  "Các nút ✦ AI giúp bạn tổng hợp nhanh, để làm được việc này, bạn cần nhập đủ dữ liệu mà worksheet yêu cầu.",
];

const SKILL_Q = [
  { id: "sk1", q: "1. Những sản phẩm bạn tạo ra mà người khác dùng được?", s: "Bài viết, báo cáo, thiết kế, kế hoạch, đoạn code, video... Mô tả sản phẩm + bằng chứng cụ thể (ai dùng, kết quả gì)...", p: "Mô tả + bằng chứng cụ thể..." },
  { id: "sk2", q: "2. Công việc người khác hay hỏi bạn \"cái này làm thế nào\"?", s: "Kỹ năng, công cụ, quy trình... Ghi cụ thể + bằng chứng (ai hỏi, trong bối cảnh nào)...", p: "Ghi cụ thể + bằng chứng..." },
  { id: "sk3", q: "3. Vấn đề bạn giải quyết được trong khi người khác bế tắc?", s: "Tình huống khó, deadline gấp, mâu thuẫn... Ghi cụ thể + bằng chứng (kết quả ra sao, ai chứng kiến)...", p: "Ghi cụ thể + bằng chứng..." },
];
const MOTIV_Q = [
  { id: "mo1", q: "1. Chủ đề bạn hay tự tìm hiểu thêm khi rảnh rỗi?", s: "Không tính lướt mạng xã hội. Ghi chủ đề + bằng chứng (tìm hiểu qua đâu, gần nhất khi nào)...", p: "Chủ đề + bằng chứng..." },
  { id: "mo2", q: "2. Chủ đề nào bạn đọc bài rất dài mà vẫn không chán?", s: "Bài phân tích, newsletter, thread dài... Ghi chủ đề + bằng chứng (lần gần nhất đọc gì)...", p: "Chủ đề + bằng chứng..." },
  { id: "mo3", q: "3. Lĩnh vực nào khiến bạn bị cuốn vào đến mức quên cả thời gian?", s: "Hoạt động, dự án, thể loại công việc... Ghi lĩnh vực + bằng chứng (làm gì lúc đó, cảm giác thế nào)...", p: "Lĩnh vực + bằng chứng..." },
];
const TRAIT_Q = [
  { id: "tr1", q: "1. Khi có sự cố xảy ra đột ngột, bạn phản ứng thế nào?", s: "", p: "Mô tả phản ứng + tình huống cụ thể..." },
  { id: "tr2", q: "2. Bạn được người khác nhớ đến với thái độ như thế nào?", s: "", p: "Thái độ + bằng chứng..." },
  { id: "tr3", q: "3. Nếu ai đó giới thiệu bạn, họ sẽ nói bạn là người như thế nào?", s: "", p: "Mô tả con người bạn..." },
];

const RADIO_GROUPS: Record<string, { label: string; opts: [string, string][] }> = {
  "r-count": { label: "Số người quen trong lĩnh vực", opts: [["0-3", "0-3 (ít)"], ["4-10", "4-10"], [">10", ">10"]] },
  "r-bold": { label: "Số người dám nhờ giới thiệu việc ngay tuần này", opts: [["0", "0 người"], ["1-2", "1-2 người"], ["3+", ">3 người"]] },
  "r-mentor": { label: "Có ai đi trước bạn 3-5 năm trong lĩnh vực không?", opts: [["yes", "Có"], ["no", "Chưa"]] },
  "h-freq": { label: "Trong 4 tuần qua, tự tìm hiểu về lĩnh vực bao nhiêu lần?", opts: [["0-1", "0-1 lần"], ["2-4", "2-4 lần"], ["5+", "5+ lần"]] },
  "h-feel": { label: "Khi nói về lĩnh vực này, bạn cảm thấy thế nào?", opts: [["excited", "Hứng khởi"], ["normal", "Bình thường"], ["tired", "Mệt mỏi"]] },
  "h-commit": { label: "Nếu không lương 3 tháng đầu, bạn có làm không?", opts: [["yes", "Có"], ["maybe", "Không chắc"], ["no", "Không"]] },
};
const rgLabel = (id: string, val?: string) => RADIO_GROUPS[id].opts.find((o) => o[0] === val)?.[1] || "?";

const WT_ITEMS = [
  "Có ít nhất 2 năm kinh nghiệm trong lĩnh vực của mình",
  "Có thể tự quản lý thời gian và deadline mà không cần ai nhắc",
  "Đã dành dụm được khoản dự phòng tài chính ít nhất 3 tháng",
  "Đã có hồ sơ năng lực hoặc sản phẩm cụ thể để chứng minh kỹ năng",
  "Thoải mái làm việc một mình, không cần không khí văn phòng",
  "Có thể trao đổi và xử lý công việc hoàn toàn qua tin nhắn/email",
  "Vẫn đang chủ động nâng cao kỹ năng chuyên môn của mình",
  "Hiểu AI đang ảnh hưởng như thế nào đến công việc mình muốn làm",
];
function wtResult(score: number) {
  if (score <= 3) return { short: "Văn phòng", text: "🏢 Làm việc tại văn phòng - môi trường giúp nạp tài khoản nhanh nhất lúc này." };
  if (score <= 5) return { short: "Kết hợp", text: "🔀 Kết hợp hoặc thử làm từ xa bán thời gian - xây hồ sơ và dự phòng song song." };
  if (score <= 7) return { short: "Làm từ xa", text: "💻 Làm từ xa hoặc tự do - cả hai đều khả thi, tìm cơ hội phù hợp." };
  return { short: "Tự do toàn thời gian", text: "🌍 Làm từ xa hoặc tự do toàn thời gian - bạn đã sẵn sàng!" };
}

const PHASES = [
  { id: "rm12", title: "Tháng 1-2 - Xây nền", goalId: "rm1-goal", goalLabel: "Kỹ năng cần lấp", goalPh: "Chép khoảng cách #1 từ Bảng 8...", weeks: ["Tuần 1-2", "Tuần 3-4", "Tuần 5-6", "Tuần 7-8"], productId: "rm1-product" },
  { id: "rm34", title: "Tháng 3-4 - Thực hành", goalId: "rm2-goal", goalLabel: "Sản phẩm cần tạo ra", goalPh: "Sản phẩm có thể show cho người khác...", weeks: ["Tuần 9-10", "Tuần 11-12", "Tuần 13-14", "Tuần 15-16"] },
  { id: "rm56", title: "Tháng 5-6 - Tiếp cận cơ hội", goalId: "rm3-goal", goalLabel: "Cơ hội muốn tiếp cận", goalPh: "Ứng tuyển vị trí nào, kết nối với ai...", weeks: ["Tuần 17-18", "Tuần 19-20", "Tuần 21-22", "Tuần 23-24"] },
];
const RM_COLS = ["Mối quan hệ", "Kỹ năng", "Phẩm chất", "Nhiệt huyết"];

// Tần suất "5/6" hoặc "0.8" → tỉ lệ
function freqRatio(raw: string): number {
  const t = (raw || "").trim();
  if (!t) return NaN;
  if (t.includes("/")) { const [a, b] = t.split("/"); return parseFloat(a) / parseFloat(b); }
  const v = parseFloat(t.replace(",", "."));
  return v > 1 ? NaN : v;
}

function parseJson<T>(text: string): T {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.search(/[[{]/);
  return JSON.parse(start > 0 ? clean.slice(start) : clean) as T;
}

function Sel({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return <select className="hm-input tk-sel" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}

export default function TktksnTool({ product, user, onBack }: { product: ToolProduct; user: ToolUser; onBack: () => void }) {
  const [data, setData] = useState<TkData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showGuide, setShowGuide] = useState(true);
  const [aiBusy, setAiBusy] = useState<AiKey | "">("");
  const [aiMsg, setAiMsg] = useState<Partial<Record<AiKey, string>>>({});
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const topRef = useRef<HTMLDivElement>(null);
  const uid = auth.currentUser?.uid || "";
  const ref = useMemo(() => (uid ? doc(db, "users", uid, "worksheets", product.id) : null), [uid, product.id]);
  const [baseFont] = useState(() => {
    if (typeof window === "undefined") return "16px";
    const host = document.querySelector("main") || document.body;
    return window.getComputedStyle(host).fontSize || "16px";
  });

  useEffect(() => {
    if (!ref) { setLoadError("Bạn cần đăng nhập để dùng công cụ này."); return; }
    getDoc(ref)
      .then((snap) => setData(snap.exists() ? normalize(snap.data()) : emptyData()))
      .catch(() => setLoadError("Không tải được bài làm. Kiểm tra kết nối mạng rồi thử lại nhé."));
  }, [ref]);

  const save = async (snapshot: TkData) => {
    if (!ref) return;
    setSaveState("saving");
    try {
      const clean = JSON.parse(JSON.stringify(snapshot)) as TkData;
      await setDoc(ref, { ...clean, uid, productId: product.id, tool: "tktksn", updatedAt: serverTimestamp() });
      dirty.current = false;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };
  useEffect(() => {
    if (!data || !dirty.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(data), 1200);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const leave = () => {
    window.clearTimeout(timer.current);
    if (data && dirty.current) save(data);
    onBack();
  };

  const update = (fn: (d: TkData) => TkData) => { dirty.current = true; setData((d) => (d ? fn(d) : d)); };
  const setF = (id: string, v: string) => update((d) => ({ ...d, f: { ...d.f, [id]: v } }));
  const go = (step: number) => { update((d) => ({ ...d, step })); topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const rootStyle = { ["--hm-fs" as string]: baseFont } as CSSProperties;
  if (loadError) return <div style={rootStyle} className="hm-root"><style>{HM_CSS + TK_CSS}</style><div className="hm-loading">{loadError}<br /><button className="hm-btn" onClick={onBack}>Quay lại</button></div></div>;
  if (!data) return <div style={rootStyle} className="hm-root"><style>{HM_CSS + TK_CSS}</style><div className="hm-loading">Đang mở công cụ...</div></div>;

  const v = (id: string) => data.f[id] || "";
  const left = (k: AiKey) => AI_MAX_PER_BUTTON - (data.ai[k] || 0);

  // ── Gọi AI qua Worker ──
  const callAi = async (key: AiKey, prompt: string): Promise<string | null> => {
    if (!auth.currentUser) return null;
    if (left(key) <= 0) { setAiMsg((m) => ({ ...m, [key]: `Bạn đã dùng hết ${AI_MAX_PER_BUTTON} lần cho nút này.` })); return null; }
    setAiBusy(key);
    setAiMsg((m) => ({ ...m, [key]: "" }));
    try {
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, appCheckToken: await appCheckToken(), productId: product.id, tool: "tktksn", aiKey: key, messages: [{ role: "user", content: prompt }] }),
      });
      const result = await resp.json().catch(() => ({}));
      const text = Array.isArray(result.content) ? result.content.map((c: { text?: string }) => c.text || "").join("") : "";
      if (resp.status === 429) {
        // Máy chủ báo đã hết lượt: khoá nút lại cho khớp
        update((d) => ({ ...d, ai: { ...d.ai, [key]: AI_MAX_PER_BUTTON } }));
        setAiMsg((m) => ({ ...m, [key]: result.error || `Bạn đã dùng hết ${AI_MAX_PER_BUTTON} lần cho nút này.` }));
        return null;
      }
      if (!resp.ok || !result.success || !text) throw new Error(result.error || `Lỗi ${resp.status}`);
      update((d) => ({ ...d, ai: { ...d.ai, [key]: (d.ai[key] || 0) + 1 } }));
      return text;
    } catch (error) {
      setAiMsg((m) => ({ ...m, [key]: `Chưa kết nối được AI (${error instanceof Error ? error.message : "lỗi mạng"}). Bạn thử lại sau ít phút nhé.` }));
      return null;
    } finally {
      setAiBusy("");
    }
  };
  const aiFail = (key: AiKey) => setAiMsg((m) => ({ ...m, [key]: "Không đọc được kết quả AI. Bạn thử lại hoặc điền thủ công nhé." }));

  const aiB4 = async () => {
    const sk = [v("sk1"), v("sk2"), v("sk3")].join("\n");
    const mo = [v("mo1"), v("mo2"), v("mo3")].join("\n");
    if (!sk.trim() && !mo.trim()) { setAiMsg((m) => ({ ...m, b4: "Vui lòng điền Bảng 1 và Bảng 2 ở Bước 1 trước." })); return; }
    const text = await callAi("b4", `Bạn là chuyên gia định hướng nghề nghiệp. Phân tích dữ liệu dưới đây.

Bảng 1 - Kỹ năng có bằng chứng thực tế (những gì người này đã làm được, có người nhờ hoặc công nhận):
${sk}

Bảng 2 - Động lực tự nhiên (những gì người này bị cuốn vào không cần ai thúc đẩy, tự tìm hiểu):
${mo}

Nhiệm vụ:
Bước 1 - Liệt kê tất cả kỹ năng/lĩnh vực xuất hiện trong Bảng 1 và Bảng 2.
Bước 2 - Tìm mối liên hệ: kỹ năng nào trong Bảng 1 được nuôi dưỡng, nâng cao hoặc có nền tảng từ động lực trong Bảng 2?
Bước 3 - Với những kỹ năng/lĩnh vực chỉ xuất hiện ở 1 bảng và không tìm thấy liên hệ với bảng còn lại, giữ nguyên tên và đánh dấu đúng bảng xuất hiện.

Quy tắc đánh giá:
- Nếu tìm thấy liên hệ giữa Bảng 1 và Bảng 2: bang1 = "Có", bang2 = "Có", danh_gia = "strong", lien_he = 1 câu ngắn giải thích mối liên hệ đó
- Nếu chỉ xuất hiện ở Bảng 1, không có liên hệ với Bảng 2: bang1 = "Có", bang2 = "Không", danh_gia = "check", lien_he = ""
- Nếu chỉ xuất hiện ở Bảng 2, không có liên hệ với Bảng 1: bang1 = "Không", bang2 = "Có", danh_gia = "check", lien_he = ""

Yêu cầu chung:
- Tối đa 5 mục, ưu tiên những mục có liên hệ (danh_gia = "strong") trước
- Tên kỹ năng tối đa 6 từ, có thể ghi vào CV hoặc hồ sơ năng lực
- Không lấy tên người, tên công ty, bằng chứng cụ thể
- Không lấy phẩm chất cá nhân như kiên nhẫn, cẩn thận, chăm chỉ
- Không trùng lặp
- Giữ nguyên ngôn ngữ đầu vào

Chỉ trả về JSON, không giải thích, không markdown:
[{"ten":"...","bang1":"Có/Không","bang2":"Có/Không","lien_he":"...","danh_gia":"strong/check"}]`);
    if (!text) return;
    try {
      const rows = parseJson<B4Row[]>(text).map((r) => ({ ten: r.ten || "", bang1: r.bang1 === "Có" ? "Có" : "Không", bang2: r.bang2 === "Có" ? "Có" : "Không", lien_he: r.lien_he || "", danh_gia: r.danh_gia === "strong" ? "strong" : "check" }));
      if (rows.length) update((d) => ({ ...d, b4: rows }));
    } catch { aiFail("b4"); }
  };

  const jdList = data.jd.map((t, i) => (t.trim() ? `--- JD ${i + 1} ---\n${t.trim()}` : "")).filter(Boolean);
  const jdTotal = Number(v("jd-count")) || jdList.length || 6;

  const aiB5 = async () => {
    if (!jdList.length) { setAiMsg((m) => ({ ...m, b5: "Vui lòng dán ít nhất 1 JD trước." })); return; }
    const total = jdList.length;
    const b4skills = data.b4.filter((r) => r.ten.trim()).map((r) => `${r.ten} (${r.danh_gia})`).join("\n");
    const text = await callAi("b5", `Bạn là chuyên gia tuyển dụng và phân tích thị trường lao động Việt Nam. Phân tích các mô tả công việc dưới đây.
Lĩnh vực / Vị trí đang nghiên cứu: ${v("jd-field")}
Kỹ năng người dùng đang có (từ Bảng 4):
${b4skills || "Chưa có dữ liệu"}
Nội dung JD:
${jdList.join("\n\n")}
Nhiệm vụ:
Bước 1 - Đọc toàn bộ JD và liệt kê tất cả kỹ năng, công cụ, kiến thức được nhắc đến trong phần yêu cầu.
Bước 2 - Đếm số JD có nhắc đến mỗi kỹ năng. Nếu 1 kỹ năng được nhắc nhiều lần trong cùng 1 JD thì chỉ tính 1 lần.
Bước 3 - Phân loại từng kỹ năng: "Đơn lẻ" nếu là kỹ năng độc lập, "Kết hợp" nếu JD thực sự yêu cầu dùng chúng cùng nhau trong 1 nhiệm vụ.
Bước 4 - Đối chiếu từng kỹ năng với danh sách kỹ năng người dùng đang có. Đánh giá minh_co theo quy tắc:
- "Có" chỉ khi tên kỹ năng trùng hoặc là tên gọi khác của cùng 1 kỹ năng cụ thể trong cùng lĩnh vực VÀ kỹ năng đó được đánh giá "strong" (Đủ mạnh) trong Bảng 4. Ví dụ: "Content Marketing" = "Viết nội dung marketing", "SQL" = "Truy vấn SQL"
- "Cần tự điền" nếu tên khác nhau, lĩnh vực khác nhau, chỉ liên quan gián tiếp, cùng tên nhưng JD yêu cầu ngữ cảnh chuyên sâu hơn, hoặc kỹ năng chỉ được đánh giá "check" (Cần kiểm tra) trong Bảng 4
Bước 5 - Sắp xếp theo tần suất từ cao xuống thấp. Tối đa 10 kỹ năng xuất hiện nhiều nhất.
Quy tắc chung:
- Tên kỹ năng ngắn gọn, tối đa 5 từ, có thể ghi vào CV
- Giữ nguyên ngôn ngữ của JD (tiếng Anh giữ tiếng Anh, tiếng Việt giữ tiếng Việt)
- Không gộp các kỹ năng khác nhau thành 1
- Không tách 1 kỹ năng thành nhiều mục nếu chúng thường đi cùng nhau
- tan_suat ghi theo dạng "số JD có kỹ năng/${total}", ví dụ "5/${total}"
- Mặc định đánh giá "Cần tự điền" trừ khi có thể xác định chắc chắn đây là cùng 1 kỹ năng và được đánh giá "strong"
Chỉ trả về JSON, không giải thích, không markdown:
[{"ten":"...","loai":"Đơn lẻ/Kết hợp","tan_suat":"5/${total}","minh_co":"Có/Cần tự điền"}]`);
    if (!text) return;
    try {
      const rows = parseJson<B5Row[]>(text).map((r) => ({ ten: r.ten || "", loai: r.loai === "Kết hợp" ? "Kết hợp" : "Đơn lẻ", tan_suat: String(r.tan_suat ?? ""), minh_co: r.minh_co === "Có" ? "Có" : r.minh_co === "Chưa" ? "Chưa" : "Cần tự điền" }));
      if (rows.length) update((d) => ({ ...d, b5: rows, f: { ...d.f, "jd-count": d.f["jd-count"] || String(total) } }));
    } catch { aiFail("b5"); }
  };

  const aiB6 = async () => {
    const b4 = data.b4.filter((r) => r.ten.trim()).map((r) => `${r.ten} | Bảng 1: ${r.bang1} | Bảng 2: ${r.bang2} | Đánh giá: ${r.danh_gia}`).join("\n");
    const b5 = data.b5.filter((r) => r.ten.trim()).map((r) => `${r.ten} | Tần suất: ${r.tan_suat} | Mình có: ${r.minh_co}`).join("\n");
    if (!b4 && !b5) { setAiMsg((m) => ({ ...m, b6: "Vui lòng hoàn thành Bảng 4 và Bảng 5 trước." })); return; }
    const text = await callAi("b6", `Bạn là chuyên gia định hướng sự nghiệp. Phân tích dữ liệu dưới đây và điền vào Bảng 6 - Điểm giao thoa.
Bảng 4 - Kỹ năng đã xác định:
${b4 || "Chưa có dữ liệu"}
Bảng 5 - Yêu cầu từ thị trường:
${b5 || "Chưa có dữ liệu"}
Nhiệm vụ:
- vong1: Liệt kê các kỹ năng trong Bảng 4 có "Bảng 1 = Có". Khi đối chiếu, ưu tiên hiểu theo nghĩa rộng - "Viết lách" và "Copywriting" là tương đương, "Phân tích số liệu" và "Data Analysis" là tương đương.
- vong2: Liệt kê các kỹ năng trong Bảng 4 có "Bảng 2 = Có". Áp dụng cùng nguyên tắc hiểu theo nghĩa rộng.
- vong3: Liệt kê top 3 kỹ năng có tần suất cao nhất trong Bảng 5, không giới hạn ngưỡng cố định.
- giao_thoa: Tìm kỹ năng/lĩnh vực xuất hiện ở cả 3 vòng - ưu tiên hiểu theo nghĩa rộng, không yêu cầu trùng tên chính xác. Nếu không có kỹ năng nào đủ cả 3 vòng, lấy kỹ năng xuất hiện ở 2 vòng có tần suất cao nhất ở Bảng 5. Diễn đạt thành tên lĩnh vực hoặc vị trí công việc cụ thể có thể ghi vào mục tiêu nghề nghiệp, kèm 1 câu lý do ngắn gọn tại sao đây là điểm giao thoa phù hợp.
Quy tắc:
- Mỗi vòng liệt kê dạng danh sách ngắn, mỗi kỹ năng 1 dòng
- giao_thoa viết thành câu, không phải danh sách, tối đa 2 câu
- Giữ nguyên ngôn ngữ đầu vào
- Không bịa thêm kỹ năng không có trong dữ liệu
Chỉ trả về JSON, không giải thích, không markdown:
{"vong1":"...","vong2":"...","vong3":"...","giao_thoa":"..."}`);
    if (!text) return;
    try {
      const j = parseJson<{ vong1?: string; vong2?: string; vong3?: string; giao_thoa?: string }>(text);
      update((d) => ({ ...d, f: { ...d.f, cr1: j.vong1 || "", cr2: j.vong2 || "", cr3: j.vong3 || "", cr4: j.giao_thoa || "" } }));
    } catch { aiFail("b6"); }
  };

  const aiB8 = async () => {
    const b2skills = data.b4.filter((r) => r.ten.trim() && r.bang2 === "Có").map((r) => r.ten).join("\n");
    const b5 = data.b5.filter((r) => r.ten.trim()).map((r) => `${r.ten} | ${r.loai} | ${r.tan_suat} | ${r.minh_co}`).join("\n");
    if (!b5) { setAiMsg((m) => ({ ...m, b8: "Vui lòng hoàn thành Bảng 5 trước." })); return; }
    const text = await callAi("b8", `Bạn là chuyên gia định hướng sự nghiệp. Phân tích dữ liệu dưới đây để xác định khoảng cách kỹ năng cần lấp theo thứ tự ưu tiên.
Tổng số JD đã phân tích: ${jdTotal}
Danh sách kỹ năng có Bảng 2 = Có (người dùng bị cuốn vào tự nhiên):
${b2skills || "Không có"}
Bảng 5 - Yêu cầu từ thị trường (tên | loại | tần suất | mình có):
${b5}
Nhiệm vụ:
Bước 1 - Lọc từ Bảng 5 các kỹ năng có "Mình có = Chưa" hoặc "Mình có = Cần tự điền" - đây là khoảng cách cần lấp.
Bước 2 - Với mỗi kỹ năng vừa lọc, đối chiếu với danh sách kỹ năng có Bảng 2 = Có ở trên. Nếu tìm thấy kỹ năng tương đương hoặc liên quan - kể cả khi tên gọi khác nhau hoặc khác ngôn ngữ → bang2 = "Có". Nếu không tìm thấy → bang2 = "Không".
Bước 3 - Sắp xếp theo thứ tự ưu tiên: tần suất cao trước. Nếu cùng tần suất, ưu tiên kỹ năng có bang2 = "Có".
Quy tắc:
- Chỉ lấy kỹ năng người dùng chưa có hoặc cần tự điền - không lấy kỹ năng đã "Có"
- Giữ nguyên tên kỹ năng, loại (Đơn lẻ/Kết hợp) và tần suất từ Bảng 5 - không đổi tên, không gộp
- Tối đa 8 kỹ năng
Chỉ trả về JSON, không giải thích, không markdown:
[{"ten":"...","tan_suat":"...","loai":"Đơn lẻ/Kết hợp","bang2":"Có/Không"}]`);
    if (!text) return;
    try {
      const rows = parseJson<B8Row[]>(text).map((r) => ({ ten: r.ten || "", tan_suat: String(r.tan_suat ?? ""), loai: r.loai === "Kết hợp" ? "Kết hợp" : "Đơn lẻ", bang2: r.bang2 === "Có" ? "Có" : "Không" }));
      if (rows.length) update((d) => ({ ...d, b8: rows }));
    } catch { aiFail("b8"); }
  };

  const aiTrait = async () => {
    if (!v("tr1") && !v("tr2") && !v("tr3")) { setAiMsg((m) => ({ ...m, trait: "Vui lòng điền Bảng 3 ở Bước 1 trước." })); return; }
    const text = await callAi("trait", `Bạn là chuyên gia nhân sự. Đọc 3 câu trả lời dưới đây và rút ra phẩm chất làm việc của người này.
Câu 1 - Khi có sự cố xảy ra đột ngột, bạn phản ứng thế nào?: ${v("tr1")}
Câu 2 - Bạn được người khác nhớ đến với thái độ như thế nào?: ${v("tr2")}
Câu 3 - Nếu ai đó giới thiệu bạn, họ sẽ nói bạn là người như thế nào?: ${v("tr3")}
Nhiệm vụ:
- dang_co: Liệt kê 3-5 phẩm chất làm việc nổi bật nhất có bằng chứng rõ trong câu trả lời. Mỗi phẩm chất 1 dòng, ngắn gọn (1-3 từ).
- can_ren: Liệt kê 1-2 phẩm chất người này có thể cần rèn thêm dựa trên những gì còn thiếu hoặc chưa đề cập. Mỗi phẩm chất 1 dòng.
Quy tắc:
- Chỉ rút ra từ nội dung câu trả lời - không bịa thêm
- Không lấy kỹ năng chuyên môn, chỉ lấy phẩm chất cách làm việc
- Giữ nguyên ngôn ngữ đầu vào
Chỉ trả về JSON, không giải thích, không markdown:
{"dang_co":"...","can_ren":"..."}`);
    if (!text) return;
    try {
      const j = parseJson<{ dang_co?: string; can_ren?: string }>(text);
      update((d) => ({ ...d, f: { ...d.f, "ac-tr-have": j.dang_co || "", "ac-tr-need": j.can_ren || "" } }));
    } catch { aiFail("trait"); }
  };

  const wtScore = data.wt.filter(Boolean).length;
  const aiRoadmap = async () => {
    const b8 = data.b8.filter((r) => r.ten.trim()).map((r) => `${r.ten} | ${r.loai} | ${r.tan_suat} | Bảng 2: ${r.bang2}`).join("\n");
    const text = await callAi("roadmap", `Bạn là chuyên gia định hướng sự nghiệp. Tạo gợi ý lộ trình 6 tháng dựa trên dữ liệu dưới đây.
Thông tin người dùng:
- Tên: ${user.name || "bạn"}
- Điểm giao thoa / Lĩnh vực mục tiêu: ${v("cr4")}
- Kỹ năng đang có: ${v("ac-sk-have")}
- Kỹ năng cần lấp theo thứ tự ưu tiên (từ Bảng 8 - tên | loại | tần suất | bảng2):
${b8 || v("ac-sk-miss") || "Chưa có dữ liệu"}
- Phẩm chất đang có: ${v("ac-tr-have")}
- Điểm hình thức làm việc: ${wtScore} / 8
Nhiệm vụ: Điền 4 ô sau.
- ky_nang_can_lap: Kỹ năng ưu tiên #1 từ Bảng 8 - ưu tiên kỹ năng Đơn lẻ, tần suất cao nhất, có Bảng 2 = Có nếu có thể
- san_pham_12: Sản phẩm cụ thể hoàn thành sau Tháng 1-2 - liên quan trực tiếp đến kỹ năng cần lấp, có thể show cho người khác
- san_pham_34: Sản phẩm nâng cao hơn trong Tháng 3-4 - dựa trên nền từ Tháng 1-2, mức độ phức tạp hoặc quy mô lớn hơn
- co_hoi_56: Gợi ý cơ hội tiếp cận trong Tháng 5-6, dựa trên điểm hình thức làm việc theo quy tắc sau:
  - Điểm < 4: gợi ý dự án freelance nhỏ hoặc collab cá nhân trong lĩnh vực mục tiêu
  - Điểm 4-6: gợi ý part-time, remote junior hoặc internship có liên quan
  - Điểm > 6: gợi ý ứng tuyển full-time hoặc tiếp cận cộng đồng/người có tầm ảnh hưởng trong lĩnh vực
Quy tắc:
- Mỗi ô 1 câu ngắn, cụ thể, có thể thực hiện ngay - không chung chung
- Nội dung phải liên quan trực tiếp đến lĩnh vực mục tiêu và kỹ năng cần lấp
- Giữ nguyên ngôn ngữ đầu vào
Chỉ trả về JSON, không giải thích, không markdown:
{"ky_nang_can_lap":"...","san_pham_12":"...","san_pham_34":"...","co_hoi_56":"..."}`);
    if (!text) return;
    try {
      const j = parseJson<{ ky_nang_can_lap?: string; san_pham_12?: string; san_pham_34?: string; co_hoi_56?: string }>(text);
      update((d) => ({ ...d, f: { ...d.f, "rm1-goal": j.ky_nang_can_lap || "", "rm1-product": j.san_pham_12 || "", "rm2-goal": j.san_pham_34 || "", "rm3-goal": j.co_hoi_56 || "" } }));
      setAiMsg((m) => ({ ...m, roadmap: "✓ Đã điền gợi ý vào các ô bên trên. Bạn có thể chỉnh sửa lại cho phù hợp." }));
    } catch { aiFail("roadmap"); }
  };

  const AiButton = ({ k, label, onClick }: { k: AiKey; label: string; onClick: () => void }) => (
    <div className="tk-ai-row">
      <button className="hm-btn" disabled={!!aiBusy || left(k) <= 0} onClick={onClick}>
        {aiBusy === k ? <><span className="hm-spin tk-spin" /> AI đang phân tích...</> : `✦ ${label}`}
      </button>
      <small>{left(k) > 0 ? `Còn ${left(k)} lần` : "Đã dùng hết lượt"}</small>
      {aiMsg[k] && <p className="tk-ai-msg">{aiMsg[k]}</p>}
    </div>
  );

  // ── Bảng 7: tự tính từ Bảng 5 ──
  const autoCalcB7 = () => {
    let total = 0, have = 0;
    data.b5.forEach((r) => { const ratio = freqRatio(r.tan_suat); if (!isNaN(ratio) && ratio >= 0.5) { total++; if (r.minh_co === "Có") have++; } });
    update((d) => ({ ...d, f: { ...d.f, "g-total": String(total), "g-have": String(have) } }));
  };
  const gTotal = parseInt(v("g-total")) || 0;
  const gMiss = gTotal - (parseInt(v("g-have")) || 0);
  const gapMsg = gTotal > 0
    ? `Thiếu ${gMiss}/${gTotal} yêu cầu. ${gMiss <= 2 ? "✅ Gần sẵn sàng - tập trung vào phần còn thiếu và bắt đầu xây hồ sơ năng lực." : gMiss <= 5 ? "📈 Đúng hướng, chỉ cần thêm thời gian. Lộ trình 6 tháng là đủ." : "⏳ Hướng đúng nhưng cần chuẩn bị kỹ hơn. Có thể cần 9-12 tháng."}`
    : "";

  const stepFilled = (n: number) => {
    const any = (...ids: string[]) => ids.some((id) => v(id).trim());
    switch (n) {
      case 1: return any("sk1", "sk2", "sk3", "mo1", "mo2", "mo3", "tr1", "tr2", "tr3");
      case 2: return data.b4.some((r) => r.ten.trim());
      case 3: return data.b5.some((r) => r.ten.trim());
      case 4: return any("cr4");
      case 5: return data.b8.some((r) => r.ten.trim());
      case 6: return any("ac-sk-have", "ac-tr-have") || Object.keys(data.rg).length > 0;
      case 7: return wtScore > 0;
      case 8: return any("rm1-goal", "rm2-goal", "rm3-goal");
      default: return false;
    }
  };
  const filledCount = STEPS.filter((s) => stepFilled(s.n)).length;

  const resetAll = () => {
    if (!window.confirm("Xoá toàn bộ bài làm và làm lại từ đầu?")) return;
    update((d) => ({ ...emptyData(), ai: d.ai }));
  };

  const card = (title: string, children: ReactNode, hint?: string) => (
    <section className="hm-card">
      <h2>{title}</h2>
      {hint && <p className="hm-muted">{hint}</p>}
      {children}
    </section>
  );
  const qList = (qs: typeof SKILL_Q) => qs.map((q) => (
    <label key={q.id} className="hm-field"><span>{q.q}</span>{q.s && <small className="tk-sub">{q.s}</small>}<Area rows={3} value={v(q.id)} placeholder={q.p} onChange={(t) => setF(q.id, t)} /></label>
  ));
  const radio = (id: string) => (
    <div className="hm-field" key={id}>
      <span>{RADIO_GROUPS[id].label}</span>
      <div className="tk-rg">{RADIO_GROUPS[id].opts.map(([val, lbl]) => (
        <button type="button" key={val} className={data.rg[id] === val ? "on" : ""} onClick={() => update((d) => ({ ...d, rg: { ...d.rg, [id]: val } }))}>{lbl}</button>
      ))}</div>
    </div>
  );
  const stepHead = (n: number, desc: string) => (
    <section className="hm-hero small">
      <span className="hm-eyebrow">BƯỚC {n} / 8</span>
      <h1>{STEPS[n - 1].name}</h1>
      <p>{desc}</p>
    </section>
  );
  const nav = (n: number) => (
    <div className="hm-nav">
      <button className="hm-btn" disabled={n === 1} onClick={() => go(n - 1)}>← Bước trước</button>
      {n < 8 ? <button className="hm-btn primary" onClick={() => go(n + 1)}>Tiếp theo →</button> : <span />}
    </div>
  );

  const b10 = [
    { lbl: "Mối quan hệ", have: `Quen ${rgLabel("r-count", data.rg["r-count"])} - Dám nhờ: ${rgLabel("r-bold", data.rg["r-bold"])} - Mentor: ${rgLabel("r-mentor", data.rg["r-mentor"])}`, miss: data.rg["r-mentor"] !== "yes" ? "Chưa có người đi trước 3-5 năm" : "" },
    { lbl: "Kỹ năng có", have: v("ac-sk-have") || "Chưa điền", miss: "" },
    { lbl: "Kỹ năng thiếu", have: "", miss: v("ac-sk-miss") || "Chưa điền" },
    { lbl: "Phẩm chất có", have: v("ac-tr-have") || "Chưa điền", miss: "" },
    { lbl: "Cần rèn thêm", have: "", miss: v("ac-tr-need") || "Chưa điền" },
    { lbl: "Nhiệt huyết", have: `Tần suất: ${rgLabel("h-freq", data.rg["h-freq"])} - Cảm xúc: ${rgLabel("h-feel", data.rg["h-feel"])} - Cam kết: ${rgLabel("h-commit", data.rg["h-commit"])}`, miss: "" },
  ];

  return (
    <div style={rootStyle} className="hm-root" ref={topRef}>
      <style>{HM_CSS + TK_CSS}</style>

      {showGuide && (
        <div className="hm-modal-bg" role="dialog" aria-modal="true">
          <div className="hm-modal">
            <span className="hm-eyebrow">TRƯỚC KHI BẮT ĐẦU</span>
            <h2>Hướng dẫn sử dụng worksheet</h2>
            <ol className="hm-guide-list">{TK_GUIDE.map((t, i) => <li key={t}><b>{i + 1}</b><span>{t}</span></li>)}</ol>
            <p className="hm-device-note">Nên làm worksheet trên desktop/laptop để có trải nghiệm tốt hơn.</p>
            <div className="hm-modal-actions">
              <button className="hm-btn primary" onClick={() => setShowGuide(false)}>Đã hiểu, bắt đầu làm →</button>
              <button className="hm-btn" onClick={leave}>Thoát</button>
            </div>
          </div>
        </div>
      )}

      <header className="hm-toolbar">
        <button className="hm-back" onClick={leave}>← Thoát</button>
        <div className="hm-toolbar-title"><span>CÔNG CỤ</span><strong>{product.title}</strong></div>
        <button className="hm-back hm-help" onClick={() => setShowGuide(true)} title="Xem hướng dẫn">?</button>
        <div className={`hm-save ${saveState}`}>{saveState === "saving" ? "Đang lưu..." : saveState === "saved" ? "✓ Đã lưu" : saveState === "error" ? "⚠ Lưu thất bại" : "Tự động lưu"}</div>
      </header>

      <nav className="hm-tabs tk-tabs" aria-label="Các bước">
        {STEPS.map((s) => (
          <button key={s.n} className={[data.step === s.n ? "active" : "", stepFilled(s.n) ? "filled" : ""].join(" ")} onClick={() => go(s.n)} title={s.name}>
            <b>{s.n}</b><span>{s.name}</span>
          </button>
        ))}
      </nav>
      <div className="hm-progress"><i style={{ width: `${(filledCount / 8) * 100}%` }} /></div>

      <div className="hm-page">
        {/* ───── BƯỚC 1 ───── */}
        {data.step === 1 && <>
          {stepHead(1, "3 bảng - Kỹ năng, Động lực tự nhiên, Phẩm chất. Điền thành thật, bằng chứng càng cụ thể càng tốt.")}
          {card("Bảng 1 - Kỹ năng", qList(SKILL_Q), "Kỹ năng đã được kiểm chứng bằng kết quả thực tế. Bằng chứng: ai nhận ra, tình huống nào, kết quả gì.")}
          {card("Bảng 2 - Động lực tự nhiên", qList(MOTIV_Q), "Nơi Động lực gặp Kỹ năng = nơi bạn học nhanh nhất.")}
          {card("Bảng 3 - Phẩm chất", qList(TRAIT_Q), "Phẩm chất là cách bạn làm việc - không phải bạn làm được gì.")}
          {nav(1)}
        </>}

        {/* ───── BƯỚC 2 ───── */}
        {data.step === 2 && <>
          {stepHead(2, "Đối chiếu Bảng 1 và Bảng 2 để xác định kỹ năng nào đủ mạnh để đưa ra thị trường.")}
          {card("Bảng 4 - Mình làm tốt cái gì?", <>
            <div className="tk-table">
              <div className="tk-tr tk-th tk-b4"><span>Kỹ năng / Lĩnh vực</span><span>Bảng 1?</span><span>Bảng 2?</span><span>Liên hệ</span><span>Đánh giá</span><span /></div>
              {data.b4.map((r, i) => (
                <div className="tk-tr tk-b4" key={i}>
                  <input className="hm-input" value={r.ten} placeholder="Tên kỹ năng..." onChange={(e) => update((d) => ({ ...d, b4: d.b4.map((x, j) => j === i ? { ...x, ten: e.target.value } : x) }))} />
                  <Sel value={r.bang1} options={[["Có", "Có"], ["Không", "Không"]]} onChange={(t) => update((d) => ({ ...d, b4: d.b4.map((x, j) => j === i ? { ...x, bang1: t } : x) }))} />
                  <Sel value={r.bang2} options={[["Có", "Có"], ["Không", "Không"]]} onChange={(t) => update((d) => ({ ...d, b4: d.b4.map((x, j) => j === i ? { ...x, bang2: t } : x) }))} />
                  <input className="hm-input" value={r.lien_he} placeholder="Mối liên hệ..." onChange={(e) => update((d) => ({ ...d, b4: d.b4.map((x, j) => j === i ? { ...x, lien_he: e.target.value } : x) }))} />
                  <Sel value={r.danh_gia} options={[["strong", "Đủ mạnh"], ["check", "Cần kiểm tra"]]} onChange={(t) => update((d) => ({ ...d, b4: d.b4.map((x, j) => j === i ? { ...x, danh_gia: t } : x) }))} />
                  <button className="tk-del" title="Xoá dòng" onClick={() => update((d) => ({ ...d, b4: d.b4.filter((_, j) => j !== i) }))}>×</button>
                </div>
              ))}
            </div>
            <button className="tk-add" onClick={() => update((d) => ({ ...d, b4: [...d.b4, emptyB4()] }))}>+ Thêm dòng</button>
          </>, "Liệt kê tất cả từ Bảng 1 và 2, đối chiếu xem chúng xuất hiện ở đâu. Có ở cả 2 = Đủ mạnh.")}
          <AiButton k="b4" label="AI trích kỹ năng từ Bảng 1 & 2" onClick={aiB4} />
          {nav(2)}
        </>}

        {/* ───── BƯỚC 3 ───── */}
        {data.step === 3 && <>
          {stepHead(3, "Đọc ít nhất 6 mô tả công việc (JD) liên quan đến kỹ năng \"Đủ mạnh\" từ Bước 2.")}
          {card("Lĩnh vực đang nghiên cứu", <div className="hm-grid2">
            <label className="hm-field"><span>Kỹ năng / lĩnh vực</span><input className="hm-input" value={v("jd-field")} placeholder="Chọn từ mục 'Đủ mạnh' ở Bảng 4..." onChange={(e) => setF("jd-field", e.target.value)} /></label>
            <label className="hm-field"><span>Tổng số JD đã đọc</span><input className="hm-input" value={v("jd-count")} placeholder="Tối thiểu 6..." onChange={(e) => setF("jd-count", e.target.value)} /></label>
          </div>)}
          {card("Nội dung JD", <>
            {data.jd.map((t, i) => (
              <label key={i} className="hm-field"><span>JD {i + 1}</span><Area rows={4} value={t} placeholder={`Dán nội dung JD ${i + 1} vào đây...`} onChange={(val) => update((d) => ({ ...d, jd: d.jd.map((x, j) => j === i ? val : x) }))} /></label>
            ))}
            <button className="tk-add" onClick={() => update((d) => ({ ...d, jd: [...d.jd, ""] }))}>+ Thêm JD</button>
          </>, "Dán nội dung từng JD vào ô bên dưới. Lưu ý: hãy lưu lại các JD này (copy vào Google Docs, Notion, Word... tuỳ thói quen) để tránh trường hợp link JD bị đóng sau này.")}
          {card("Bảng 5 - Tổng hợp yêu cầu từ JD", <>
            <div className="tk-table">
              <div className="tk-tr tk-th tk-b5"><span>Kỹ năng / Yêu cầu</span><span>Loại</span><span>Tần suất</span><span>Mình có?</span><span /></div>
              {data.b5.map((r, i) => (
                <div className="tk-tr tk-b5" key={i}>
                  <input className="hm-input" value={r.ten} placeholder="Tên kỹ năng..." onChange={(e) => update((d) => ({ ...d, b5: d.b5.map((x, j) => j === i ? { ...x, ten: e.target.value } : x) }))} />
                  <Sel value={r.loai} options={[["Đơn lẻ", "Đơn lẻ"], ["Kết hợp", "Kết hợp"]]} onChange={(t) => update((d) => ({ ...d, b5: d.b5.map((x, j) => j === i ? { ...x, loai: t } : x) }))} />
                  <input className="hm-input" value={r.tan_suat} placeholder={`__/${jdTotal}`} onChange={(e) => update((d) => ({ ...d, b5: d.b5.map((x, j) => j === i ? { ...x, tan_suat: e.target.value } : x) }))} />
                  <Sel value={r.minh_co} options={[["Có", "Có"], ["Cần tự điền", "Cần tự điền"], ["Chưa", "Chưa"]]} onChange={(t) => update((d) => ({ ...d, b5: d.b5.map((x, j) => j === i ? { ...x, minh_co: t } : x) }))} />
                  <button className="tk-del" title="Xoá dòng" onClick={() => update((d) => ({ ...d, b5: d.b5.filter((_, j) => j !== i) }))}>×</button>
                </div>
              ))}
            </div>
            <button className="tk-add" onClick={() => update((d) => ({ ...d, b5: [...d.b5, emptyB5()] }))}>+ Thêm kỹ năng</button>
          </>, `Kỹ năng xuất hiện ở ít nhất 5/6 JD mới là tín hiệu thật từ thị trường. Tần suất ghi dạng "5/${jdTotal}".`)}
          <AiButton k="b5" label="AI tổng hợp kỹ năng từ JD" onClick={aiB5} />
          {nav(3)}
        </>}

        {/* ───── BƯỚC 4 ───── */}
        {data.step === 4 && <>
          {stepHead(4, "Lĩnh vực phù hợp nhất = Làm tốt + Học nhanh + Thị trường đang cần.")}
          {card("Bảng 6 - Điểm giao thoa", <>
            <label className="hm-field"><span>🟣 Vòng 1 - LÀM TỐT</span><small className="tk-sub">Từ Bảng 4 - các mục có "Bảng 1 = Có"</small><Area rows={3} value={v("cr1")} placeholder="Kỹ năng/lĩnh vực đã có bằng chứng thực tế..." onChange={(t) => setF("cr1", t)} /></label>
            <label className="hm-field"><span>🟢 Vòng 2 - HỌC NHANH</span><small className="tk-sub">Từ Bảng 4 - các mục có "Bảng 2 = Có"</small><Area rows={3} value={v("cr2")} placeholder="Lĩnh vực bạn bị hút vào tự nhiên..." onChange={(t) => setF("cr2", t)} /></label>
            <label className="hm-field"><span>🔵 Vòng 3 - THỊ TRƯỜNG CẦN</span><small className="tk-sub">Từ Bảng 5 - kỹ năng có tần suất cao nhất</small><Area rows={3} value={v("cr3")} placeholder="Kỹ năng thị trường đang cần..." onChange={(t) => setF("cr3", t)} /></label>
            <label className="hm-field tk-star"><span>⭐ ĐIỂM GIAO THOA</span><Area rows={2} value={v("cr4")} placeholder="Những gì xuất hiện ở cả 3 vòng trên..." onChange={(t) => setF("cr4", t)} /></label>
          </>)}
          <AiButton k="b6" label="AI gợi ý điểm giao thoa" onClick={aiB6} />
          {nav(4)}
        </>}

        {/* ───── BƯỚC 5 ───── */}
        {data.step === 5 && <>
          {stepHead(5, "Biết rõ mình đang thiếu gì - đây là bản đồ, không phải lý do để lo lắng.")}
          {card("Bảng 7 - Kết quả", <>
            <div className="hm-grid2">
              <label className="hm-field"><span>Tổng yêu cầu xuất hiện ở ≥ 50% JD</span><input className="hm-input" value={v("g-total")} placeholder="0" onChange={(e) => setF("g-total", e.target.value)} /></label>
              <label className="hm-field"><span>Mình đang có</span><input className="hm-input" value={v("g-have")} placeholder="0" onChange={(e) => setF("g-have", e.target.value)} /></label>
            </div>
            <button className="tk-add" onClick={autoCalcB7}>↻ Tính tự động từ Bảng 5</button>
            {gapMsg && <p className="tk-result">{gapMsg}</p>}
          </>)}
          {card("Bảng 8 - Khoảng cách theo thứ tự ưu tiên", <>
            <div className="tk-table">
              <div className="tk-tr tk-th tk-b8"><span>#</span><span>Khoảng cách cần lấp</span><span>Tần suất</span><span>Loại</span><span>Bảng 2?</span><span /></div>
              {data.b8.map((r, i) => (
                <div className="tk-tr tk-b8" key={i}>
                  <span className="tk-idx">{i + 1}</span>
                  <input className="hm-input" value={r.ten} placeholder="Tên khoảng cách..." onChange={(e) => update((d) => ({ ...d, b8: d.b8.map((x, j) => j === i ? { ...x, ten: e.target.value } : x) }))} />
                  <input className="hm-input" value={r.tan_suat} placeholder={`__/${jdTotal}`} onChange={(e) => update((d) => ({ ...d, b8: d.b8.map((x, j) => j === i ? { ...x, tan_suat: e.target.value } : x) }))} />
                  <Sel value={r.loai} options={[["Đơn lẻ", "Đơn lẻ"], ["Kết hợp", "Kết hợp"]]} onChange={(t) => update((d) => ({ ...d, b8: d.b8.map((x, j) => j === i ? { ...x, loai: t } : x) }))} />
                  <Sel value={r.bang2} options={[["Có", "Có"], ["Không", "Không"]]} onChange={(t) => update((d) => ({ ...d, b8: d.b8.map((x, j) => j === i ? { ...x, bang2: t } : x) }))} />
                  <button className="tk-del" title="Xoá dòng" onClick={() => update((d) => ({ ...d, b8: d.b8.filter((_, j) => j !== i) }))}>×</button>
                </div>
              ))}
            </div>
            <button className="tk-add" onClick={() => update((d) => ({ ...d, b8: [...d.b8, emptyB8()] }))}>+ Thêm khoảng cách</button>
          </>, "Ưu tiên theo tần suất JD cao nhất. Trong cùng tần suất, ưu tiên lĩnh vực có trong Bảng 2.")}
          <AiButton k="b8" label="AI tổng hợp khoảng cách từ Bảng 5" onClick={aiB8} />
          {nav(5)}
        </>}

        {/* ───── BƯỚC 6 ───── */}
        {data.step === 6 && <>
          {stepHead(6, "Ghép tất cả lại thành bức tranh hoàn chỉnh.")}
          <p className="tk-formula">(Mối quan hệ + Kỹ năng + Phẩm chất) × Nhiệt huyết</p>
          {card("Bảng 9a - Mối quan hệ", <>{radio("r-count")}{radio("r-bold")}{radio("r-mentor")}</>)}
          {card("Bảng 9b - Kỹ năng", <>
            <label className="hm-field"><span>Đang có (từ Bảng 4 - "Đủ mạnh")</span><Area rows={3} value={v("ac-sk-have")} placeholder="Mỗi kỹ năng một dòng..." onChange={(t) => setF("ac-sk-have", t)} /></label>
            <button className="tk-add" onClick={() => setF("ac-sk-have", data.b4.filter((r) => r.ten.trim() && r.danh_gia === "strong").map((r) => r.ten.trim()).join("\n"))}>↻ Tự điền từ Bảng 4</button>
            <label className="hm-field"><span>Đang thiếu (từ Bảng 8 - theo thứ tự ưu tiên)</span><Area rows={3} value={v("ac-sk-miss")} placeholder="Mỗi kỹ năng một dòng..." onChange={(t) => setF("ac-sk-miss", t)} /></label>
            <button className="tk-add" onClick={() => setF("ac-sk-miss", data.b8.filter((r) => r.ten.trim()).map((r) => r.ten.trim()).join("\n"))}>↻ Tự điền từ Bảng 8</button>
          </>)}
          {card("Bảng 9c - Phẩm chất", <>
            <label className="hm-field"><span>Đang có (từ Bảng 3)</span><Area rows={2} value={v("ac-tr-have")} placeholder="Ví dụ: kiên nhẫn, đúng giờ, bình tĩnh..." onChange={(t) => setF("ac-tr-have", t)} /></label>
            <label className="hm-field"><span>Cần rèn thêm</span><Area rows={2} value={v("ac-tr-need")} placeholder="Phẩm chất bạn thấy còn yếu..." onChange={(t) => setF("ac-tr-need", t)} /></label>
            <AiButton k="trait" label="AI tóm tắt phẩm chất từ Bảng 3" onClick={aiTrait} />
          </>)}
          {card("Bảng 9d - Nhiệt huyết", <>{radio("h-freq")}{radio("h-feel")}{radio("h-commit")}</>)}
          {card("Bảng 10 - Tổng hợp tài khoản", (
            <div className="tk-sum">
              <div className="tk-sum-row tk-sum-head"><span>Yếu tố</span><span>Đang có</span><span>Đang thiếu</span></div>
              {b10.map((r) => <div key={r.lbl} className="tk-sum-row"><b>{r.lbl}</b><span>{r.have}</span><span className="miss">{r.miss}</span></div>)}
            </div>
          ), "Bảng này tự cập nhật từ Bảng 9a-9d.")}
          {nav(6)}
        </>}

        {/* ───── BƯỚC 7 ───── */}
        {data.step === 7 && <>
          {stepHead(7, "Tick nếu đã thực sự đạt được - không phải mong muốn.")}
          {card("Bảng 11 - Kiểm tra", <>
            {WT_ITEMS.map((t, i) => (
              <button type="button" key={t} className={`hm-check ${data.wt[i] ? "on" : ""}`} onClick={() => update((d) => ({ ...d, wt: d.wt.map((x, j) => j === i ? !x : x) }))}>
                <i>{data.wt[i] ? "✓" : ""}</i><span>{t}</span>
              </button>
            ))}
            <div className="tk-score"><span>Tổng điểm:</span><b>{wtScore} / 8</b></div>
            <p className="tk-result">{wtResult(wtScore).text}</p>
          </>)}
          {nav(7)}
        </>}

        {/* ───── BƯỚC 8 ───── */}
        {data.step === 8 && <>
          {stepHead(8, "Kế hoạch lấp khoảng cách theo thứ tự ưu tiên.")}
          <section className="tk-hero">
            <span>TÓM TẮT TÀI KHOẢN SỰ NGHIỆP</span>
            <strong>{user.name || "Bạn"}</strong>
            <div><em>🎯 {v("cr4") || "Chưa xác định điểm giao thoa (Bước 4)"}</em><em>💼 {wtResult(wtScore).short}</em></div>
          </section>
          {PHASES.map((ph) => card(ph.title, <>
            <label className="hm-field"><span>{ph.goalLabel}</span><Area rows={2} value={v(ph.goalId)} placeholder={ph.goalPh} onChange={(t) => setF(ph.goalId, t)} /></label>
            <div className="tk-rm">
              <div className="tk-rm-row tk-rm-head"><span />{RM_COLS.map((c) => <span key={c}>{c}</span>)}</div>
              {ph.weeks.map((wk, wi) => {
                const key = `${ph.id}_${wi}`;
                const cells = data.rm[key] || ["", "", "", ""];
                return (
                  <div className="tk-rm-row" key={key}>
                    <b>{wk}</b>
                    {RM_COLS.map((c, ci) => (
                      <label key={c}><small>{c}</small><textarea className="hm-input" rows={2} placeholder="Việc cụ thể..." value={cells[ci] || ""} onChange={(e) => update((d) => { const cur = [...(d.rm[key] || ["", "", "", ""])]; cur[ci] = e.target.value; return { ...d, rm: { ...d.rm, [key]: cur } }; })} /></label>
                    ))}
                  </div>
                );
              })}
            </div>
            {ph.productId && <label className="hm-field"><span>Sản phẩm sẽ hoàn thành</span><Area rows={2} value={v(ph.productId)} placeholder="Sản phẩm cụ thể sau 2 tháng..." onChange={(t) => setF(ph.productId!, t)} /></label>}
          </>))}
          <section className="hm-card tk-ai-card">
            <h2>✦ Gợi ý lộ trình từ AI</h2>
            <p className="hm-muted">AI gợi ý kỹ năng cần lấp, sản phẩm cho từng giai đoạn và cơ hội nên tiếp cận dựa trên toàn bộ bài làm của bạn.</p>
            <AiButton k="roadmap" label="Tạo gợi ý lộ trình cá nhân hoá" onClick={aiRoadmap} />
          </section>
          {nav(8)}
          <p className="hm-reset"><button className="hm-link" onClick={resetAll}>Xoá bài làm và làm lại từ đầu</button></p>
        </>}
      </div>
    </div>
  );
}

const TK_CSS = `
.tk-tabs button{display:flex;align-items:center;gap:6px;}
.tk-tabs button b{display:inline-flex;width:22px;height:22px;border-radius:50%;align-items:center;justify-content:center;background:var(--hm-pale);color:var(--hm-main-d);font-size:calc(var(--hm-fs) * 0.75);}
.tk-tabs button.filled b{background:var(--hm-accent);color:#fff;}
.tk-tabs button.active b{background:#fff;color:var(--hm-main);}
.tk-sub{display:block;font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-sub);margin:-2px 0 6px;line-height:1.5;}
.tk-ai-warn{font-size:calc(var(--hm-fs) * 0.8125);color:#9a6a12;background:#FFF6E5;border-radius:10px;padding:8px 12px;margin:10px 0 0;}
.tk-ai-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:4px 0 14px;}
.tk-ai-row small{font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-sub);}
.tk-ai-msg{flex-basis:100%;font-size:calc(var(--hm-fs) * 0.875);color:var(--hm-main-d);margin:0;}
.tk-spin{display:inline-block;width:14px;height:14px;flex:0 0 14px;border-width:2px;vertical-align:-2px;margin-right:4px;}
.tk-table{display:flex;flex-direction:column;gap:6px;}
.tk-tr{display:grid;gap:6px;align-items:center;}
.tk-th{font-size:calc(var(--hm-fs) * 0.75);font-weight:600;color:var(--hm-sub);text-transform:uppercase;letter-spacing:.04em;}
.tk-b4{grid-template-columns:1.6fr .8fr .8fr 1.6fr 1fr 28px;}
.tk-b5{grid-template-columns:2fr 1fr .8fr 1.1fr 28px;}
.tk-b8{grid-template-columns:24px 2fr .8fr 1fr .8fr 28px;}
.tk-tr .hm-input{padding:8px 10px;font-size:calc(var(--hm-fs) * 0.875);}
.tk-sel{appearance:auto;}
.tk-idx{color:var(--hm-sub);font-size:calc(var(--hm-fs) * 0.8125);text-align:center;}
.tk-del{border:0;background:none;color:var(--hm-sub);font-size:calc(var(--hm-fs) * 1.25);cursor:pointer;line-height:1;}
.tk-del:hover{color:#b3412f;}
.tk-add{border:0;background:none;color:var(--hm-main-d);font:inherit;font-size:calc(var(--hm-fs) * 0.875);font-weight:500;cursor:pointer;padding:8px 0 0;}
.tk-result{background:var(--hm-pale);border-radius:12px;padding:10px 14px;margin:12px 0 0;font-size:calc(var(--hm-fs) * 0.9375);}
.tk-formula{display:inline-block;background:var(--hm-pale);color:var(--hm-main-d);border-radius:999px;padding:6px 16px;font-size:calc(var(--hm-fs) * 0.875);font-weight:500;}
.tk-rg{display:flex;flex-wrap:wrap;gap:6px;}
.tk-rg button{border:1px solid var(--hm-line);background:#fff;color:var(--hm-sub);border-radius:999px;padding:7px 14px;font:inherit;font-size:calc(var(--hm-fs) * 0.875);cursor:pointer;}
.tk-rg button.on{background:var(--hm-main);border-color:var(--hm-main);color:#fff;}
.tk-star{border-top:1px solid var(--hm-line);padding-top:14px;}
.tk-sum{border:1px solid var(--hm-line);border-radius:12px;overflow:hidden;}
.tk-sum-row{display:grid;grid-template-columns:130px 1fr 1fr;gap:10px;padding:9px 12px;font-size:calc(var(--hm-fs) * 0.875);border-top:1px solid var(--hm-line);white-space:pre-line;}
.tk-sum-row:first-child{border-top:0;}
.tk-sum-head{background:#FBF8F3;font-size:calc(var(--hm-fs) * 0.75);font-weight:600;color:var(--hm-sub);text-transform:uppercase;}
.tk-sum-row b{color:var(--hm-sub);font-weight:600;}
.tk-sum-row .miss{color:#b3412f;}
.tk-score{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--hm-line);}
.tk-score b{font-size:calc(var(--hm-fs) * 1.5);color:var(--hm-main);}
.tk-hero{background:var(--hm-pale);border:1px solid var(--hm-accent);border-radius:18px;padding:20px;text-align:center;margin-bottom:14px;}
.tk-hero>span{font-size:calc(var(--hm-fs) * 0.6875);letter-spacing:.12em;color:var(--hm-main-d);font-weight:600;}
.tk-hero strong{display:block;font-family:'Playfair Display',serif;font-size:calc(var(--hm-fs) * 1.375);margin:6px 0 10px;}
.tk-hero div{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}
.tk-hero em{font-style:normal;background:#fff;border-radius:999px;padding:4px 12px;font-size:calc(var(--hm-fs) * 0.875);}
.tk-rm{display:flex;flex-direction:column;gap:6px;margin-top:12px;}
.tk-rm-row{display:grid;grid-template-columns:90px repeat(4,1fr);gap:6px;align-items:start;}
.tk-rm-head span{font-size:calc(var(--hm-fs) * 0.75);font-weight:600;color:var(--hm-sub);text-align:center;}
.tk-rm-row b{font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-sub);font-weight:500;padding-top:8px;}
.tk-rm-row small{display:none;}
.tk-rm-row textarea{min-height:56px;padding:6px 8px;font-size:calc(var(--hm-fs) * 0.8125);}
.tk-ai-card{border-color:var(--hm-accent);}
@media (max-width:860px){
  .tk-tabs button span{display:none;}
  .tk-tabs button.active span{display:inline;}
}
@media (max-width:640px){
  .tk-th{display:none;}
  .tk-tr{grid-template-columns:1fr 1fr !important;background:#FBF8F3;border-radius:12px;padding:8px;}
  .tk-tr > .hm-input:first-of-type{grid-column:1 / -1;}
  .tk-b8 .tk-idx{display:none;}
  .tk-del{grid-column:2;justify-self:end;}
  .tk-sum-row{grid-template-columns:1fr;gap:2px;}
  .tk-sum-head{display:none;}
  .tk-rm-head{display:none;}
  .tk-rm-row{grid-template-columns:1fr 1fr;background:#FBF8F3;border-radius:12px;padding:8px;}
  .tk-rm-row b{grid-column:1 / -1;padding:0;}
  .tk-rm-row small{display:block;font-size:calc(var(--hm-fs) * 0.75);color:var(--hm-sub);margin-bottom:2px;}
}
`;
