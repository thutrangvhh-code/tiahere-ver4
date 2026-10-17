// Công cụ "Hiểu Mình" - 30 câu hỏi để hiểu rõ bản thân và định vị sự nghiệp
// Câu trả lời tự lưu vào Firestore: users/{uid}/worksheets/{productId}
// Phân tích AI gọi qua Cloudflare Worker (xác thực bằng Firebase ID token + quyền sở hữu sản phẩm)
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, appCheckToken } from "./firebase";
import { HM_HOW_TO, HM_PARTS, HM_QUESTIONS } from "./hieuMinhData";
import type { HmQuestion } from "./hieuMinhData";

const AI_PROXY_URL = "https://tiahere-ai-proxy.thutrang-vhh.workers.dev";
const AI_MAX_RUNS = 3; // số lần tạo phân tích AI tối đa cho mỗi tài khoản

type Choice = "A" | "B";
type Answer = { choice?: Choice; verify: string[]; note: string; unsure?: boolean; short?: string };
type Screen = "intro" | "q" | "summary" | "ai" | "action";
type HmData = {
  name: string;
  startDate: string;
  doneDate: string;
  expectations: string[];
  expectationOther: string;
  answers: Record<string, Answer>;
  clearest: string[];
  envFit: string;
  unsureText: string;
  selfSentence: string;
  account: { skills: string; relations: string; projects: string; understand: string };
  review: { met: string; clearer: string; unsure: string };
  ai: { text: string; createdAt: string; usage?: { input_tokens?: number; output_tokens?: number } | null } | null;
  aiCount: number;
  screen: Screen;
  current: number;
};

type ToolUser = { name: string; email: string };
type ToolProduct = { id: string; title: string };

const today = () => new Date().toISOString().slice(0, 10);
const viDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("vi-VN") : "");

function emptyData(name: string): HmData {
  return {
    name,
    startDate: today(),
    doneDate: "",
    expectations: [],
    expectationOther: "",
    answers: {},
    clearest: ["", "", ""],
    envFit: "",
    unsureText: "",
    selfSentence: "",
    account: { skills: "", relations: "", projects: "", understand: "" },
    review: { met: "", clearer: "", unsure: "" },
    ai: null,
    aiCount: 0,
    screen: "q",
    current: 1,
  };
}

// Gộp dữ liệu đã lưu với cấu trúc mặc định (phòng trường hợp bản cũ thiếu trường)
function normalize(raw: Record<string, unknown>, name: string): HmData {
  const base = emptyData(name);
  const r = raw as Partial<HmData>;
  return {
    ...base,
    ...r,
    clearest: Array.isArray(r.clearest) ? [0, 1, 2].map((i) => String(r.clearest?.[i] || "")) : base.clearest,
    expectations: Array.isArray(r.expectations) ? r.expectations : [],
    answers: r.answers && typeof r.answers === "object" ? r.answers : {},
    account: { ...base.account, ...(r.account || {}) },
    review: { ...base.review, ...(r.review || {}) },
    ai: r.ai && r.ai.text ? r.ai : null,
    aiCount: Number(r.aiCount || 0),
    // Phần "Mở đầu" đã bỏ - bài làm cũ đang ở màn này sẽ chuyển sang 30 câu hỏi
    screen: r.screen === "summary" || r.screen === "ai" ? r.screen : r.screen === "action" ? "ai" : "q",
    current: Math.min(30, Math.max(1, Number(r.current || 1))),
  };
}

const answerOf = (data: HmData, n: number): Answer => data.answers[`q${n}`] || { verify: ["", "", ""], note: "" };
// Một câu được tính là xong khi đã chọn A hoặc B (câu hỏi xác minh không bắt buộc)
const isDone = (a: Answer) => !!a.choice;
const optionOf = (q: HmQuestion, c?: Choice) => (c === "A" ? q.a : c === "B" ? q.b : null);

// ── Hiển thị văn bản AI (markdown đơn giản: **đậm**, tiêu đề, gạch đầu dòng) ──
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  );
}

function AiText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={`l${blocks.length}`}>{list.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>);
      list = [];
    }
  };
  text.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line === "---") { flush(); return; }
    const heading = line.match(/^#{1,4}\s*(.+)$/) || line.match(/^\*\*(\d+\.\s*.+?)\*\*:?$/);
    if (heading) {
      flush();
      blocks.push(<h3 key={`h${blocks.length}`}>{heading[1].replace(/\*\*/g, "")}</h3>);
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) { list.push(bullet[1]); return; }
    flush();
    blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
  });
  flush();
  return <div className="hm-ai-text">{blocks}</div>;
}

function buildPrompt(data: HmData): string {
  const lines = HM_QUESTIONS.map((q) => {
    const a = answerOf(data, q.n);
    const opt = optionOf(q, a.choice);
    const part = HM_PARTS[q.part - 1].name;
    const verify = q.verify
      .map((vq, i) => (a.verify[i] && a.verify[i].trim() ? `  - ${vq}\n    → ${a.verify[i].trim()}` : ""))
      .filter(Boolean)
      .join("\n");
    return [
      `Câu ${q.n} (${part}) - ${q.title}`,
      `Chọn: ${a.choice ? `${a.choice} - ${opt?.label} (${opt?.desc})` : "Chưa chọn"}`,
      verify ? `Xác minh:\n${verify}` : "",
      a.note && a.note.trim() ? `Ghi chú: ${a.note.trim()}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  // Prompt phân tích 7 phần
  return `Bạn là chuyên gia tư vấn career người Việt của Career Planning by Tia Nguyễn. Dựa trên 30 câu trả lời và ví dụ xác minh thực tế của người dùng, hãy tổng hợp thành bản phân tích profile sự nghiệp ngắn gọn, thực tế và cá nhân hóa.

Lưu ý quan trọng:
- Mỗi câu có phần "Xác minh" là ví dụ thực tế từ trải nghiệm của người dùng. Hãy ưu tiên dùng những thông tin này để cá nhân hóa phân tích - phản chiếu lại những gì họ viết để họ thấy bạn thực sự đọc và hiểu họ.
- Viết hoàn toàn bằng tiếng Việt. Nếu bắt buộc dùng thuật ngữ tiếng Anh chuyên ngành, hãy giải thích nghĩa tiếng Việt ngay phía sau trong ngoặc đơn.
- Chỉ viết đúng 7 phần theo cấu trúc bên dưới, không thêm bất kỳ phần nào khác ngoài 7 phần này.

Bản phân tích gồm 7 phần, viết tiếng Việt, thân thiện, ngắn gọn, cụ thể:

**1. Cách bạn vận hành**
Tổng hợp cách người này làm việc tốt nhất: nhịp độ, phong cách, điều kiện để phát huy tốt nhất. Dùng ví dụ xác minh của họ để minh họa. (3-5 câu)

**2. Giá trị và động lực**
Điều gì thực sự quan trọng với họ, họ được thúc đẩy bởi điều gì, muốn tạo ra loại tác động nào. Dùng ví dụ xác minh của họ để minh họa. (3-5 câu)

**3. Điểm mạnh nổi bật cần khai thác**
Dựa trên xu hướng câu trả lời, chỉ ra 2-3 điểm mạnh cụ thể của người này trong thị trường lao động - không phải "bạn giỏi gì" mà là "thị trường đang cần gì từ người như bạn". (3-5 câu)

**4. Môi trường phù hợp và cần tránh**
Gợi ý cụ thể loại tổ chức, văn hóa, vai trò và 3-5 hướng đi phù hợp nhất. Đồng thời chỉ ra 1-2 loại môi trường người này nên tránh và lý do tại sao. (4-6 câu)

**5. Ngành và lĩnh vực phù hợp**
Dựa trên toàn bộ profile, gợi ý 3-5 ngành hoặc lĩnh vực cụ thể phù hợp với người này. Với mỗi ngành, giải thích ngắn gọn tại sao phù hợp dựa trên đặc điểm của họ. Không liệt kê chung chung - cần cụ thể và có lý do rõ ràng. (5-8 câu)

**6. Rủi ro cần lưu ý**
Dựa trên tổng hợp câu trả lời, chỉ ra 1-2 điểm người này dễ bị đặt sai vị trí hoặc dễ kiệt sức nếu không chú ý. Cụ thể và thực tế, không chung chung. (2-3 câu)

**7. Câu mô tả bản thân**
Gợi ý 1-2 câu ngắn người dùng có thể dùng để giới thiệu bản thân trong phỏng vấn hoặc với người cố vấn - dựa trên đúng profile của họ, không phải mẫu câu chung.

---
DỮ LIỆU 30 CÂU TRẢ LỜI:

${lines}`;
}

// ── Ô nhập liệu tự giãn chiều cao ──
export function Area({ value, onChange, placeholder, rows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea className="hm-input" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

function Accordion({ title, icon, children, defaultOpen = false }: { title: string; icon?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`hm-acc ${open ? "open" : ""}`}>
      <button type="button" className="hm-acc-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{icon ? `${icon} ` : ""}{title}</span><i>{open ? "−" : "+"}</i>
      </button>
      {open && <div className="hm-acc-body">{children}</div>}
    </section>
  );
}

export default function HieuMinhTool({ product, user, onBack }: { product: ToolProduct; user: ToolUser; onBack: () => void }) {
  const [data, setData] = useState<HmData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [aiState, setAiState] = useState<"idle" | "loading" | "error">("idle");
  const [aiError, setAiError] = useState("");
  const [showGuide, setShowGuide] = useState(true); // popup "Trước khi bắt đầu" mỗi lần mở công cụ
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const topRef = useRef<HTMLDivElement>(null);
  const uid = auth.currentUser?.uid || "";
  // Cỡ chữ gốc lấy đúng theo cỡ chữ của website để worksheet không to hơn phần còn lại
  const [baseFont] = useState(() => {
    if (typeof window === "undefined") return "16px";
    const host = document.querySelector("main") || document.body;
    return window.getComputedStyle(host).fontSize || "16px";
  });
  const ref = useMemo(() => (uid ? doc(db, "users", uid, "worksheets", product.id) : null), [uid, product.id]);

  // Tải bài đang làm
  useEffect(() => {
    if (!ref) { setLoadError("Bạn cần đăng nhập để dùng công cụ này."); return; }
    getDoc(ref)
      .then((snap) => setData(snap.exists() ? normalize(snap.data(), user.name) : emptyData(user.name)))
      .catch(() => setLoadError("Không tải được bài làm. Kiểm tra kết nối mạng rồi thử lại nhé."));
  }, [ref, user.name]);

  // Tự lưu sau 1,2 giây kể từ lần sửa cuối
  const save = async (snapshot: HmData) => {
    if (!ref) return;
    setSaveState("saving");
    try {
      // JSON hoá để bỏ các giá trị undefined (Firestore không nhận undefined)
      const clean = JSON.parse(JSON.stringify(snapshot)) as HmData;
      await setDoc(ref, { ...clean, uid, productId: product.id, updatedAt: serverTimestamp() });
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
  // Lưu ngay khi rời trang công cụ
  const leave = () => {
    window.clearTimeout(timer.current);
    if (data && dirty.current) save(data);
    onBack();
  };

  const update = (fn: (d: HmData) => HmData) => {
    dirty.current = true;
    setData((d) => (d ? fn(d) : d));
  };
  const setAnswer = (n: number, patch: Partial<Answer>) =>
    update((d) => {
      const cur = answerOf(d, n);
      return { ...d, answers: { ...d.answers, [`q${n}`]: { ...cur, verify: [...(cur.verify || ["", "", ""])], ...patch } } };
    });
  const go = (screen: Screen, current?: number) => {
    update((d) => ({ ...d, screen, current: current ?? d.current }));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loadError) {
    return <div style={{ ["--hm-fs" as string]: baseFont } as CSSProperties} className="hm-root"><style>{HM_CSS}</style><div className="hm-loading">{loadError}<br /><button className="hm-btn" onClick={onBack}>Quay lại</button></div></div>;
  }
  if (!data) {
    return <div style={{ ["--hm-fs" as string]: baseFont } as CSSProperties} className="hm-root"><style>{HM_CSS}</style><div className="hm-loading">Đang mở công cụ...</div></div>;
  }

  const doneCount = HM_QUESTIONS.filter((q) => isDone(answerOf(data, q.n))).length;
  const missing = HM_QUESTIONS.filter((q) => !isDone(answerOf(data, q.n))).map((q) => q.n);
  const q = HM_QUESTIONS[data.current - 1];
  const ans = answerOf(data, q.n);
  const part = HM_PARTS[q.part - 1];

  const tabs: { key: Screen; label: string }[] = [
    { key: "q", label: `30 câu hỏi · ${doneCount}/30` },
    { key: "summary", label: "Tổng hợp" },
    { key: "ai", label: "Phân tích AI" },
  ];

  const runAi = async () => {
    if (!auth.currentUser) return;
    setAiState("loading");
    setAiError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, appCheckToken: await appCheckToken(), productId: product.id, tool: "hieu-minh", aiKey: "analysis", messages: [{ role: "user", content: buildPrompt(data) }] }),
      });
      const result = await resp.json().catch(() => ({}));
      const text = Array.isArray(result.content)
        ? result.content.map((c: { text?: string }) => c.text || "").join("")
        : typeof result.content === "string" ? result.content : "";
      if (resp.status === 429) {
        // Máy chủ báo đã hết lượt phân tích
        dirty.current = true;
        setData((d) => (d ? { ...d, aiCount: Math.max(d.aiCount, AI_MAX_RUNS) } : d));
      }
      if (!resp.ok || !result.success || !text) throw new Error(result.error || `Lỗi ${resp.status}`);
      // Ghi kết quả vào bản dữ liệu mới nhất (người dùng có thể đã chuyển tab trong lúc chờ)
      const ai = { text, createdAt: new Date().toISOString(), usage: result.usage || null };
      dirty.current = true;
      setData((d) => (d ? { ...d, ai, aiCount: d.aiCount + 1, doneDate: d.doneDate || today() } : d));
      setAiState("idle");
    } catch (error) {
      setAiState("error");
      setAiError(error instanceof Error ? error.message : "Không kết nối được");
    }
  };

  const resetAll = () => {
    if (!window.confirm("Xoá toàn bộ câu trả lời và làm lại từ đầu? Kết quả phân tích AI hiện tại cũng sẽ bị xoá.")) return;
    update((d) => ({ ...emptyData(d.name), aiCount: d.aiCount }));
  };


  return (
    <div style={{ ["--hm-fs" as string]: baseFont } as CSSProperties} className="hm-root" ref={topRef}>
      <style>{HM_CSS}</style>

      {/* Popup hướng dẫn - hiện mỗi lần mở công cụ */}
      {showGuide && (
        <div className="hm-modal-bg" role="dialog" aria-modal="true">
          <div className="hm-modal">
            <span className="hm-eyebrow">TRƯỚC KHI BẮT ĐẦU</span>
            <h2>Hướng dẫn sử dụng worksheet</h2>
            <ol className="hm-guide-list">{HM_HOW_TO.map((t, i) => <li key={t}><b>{i + 1}</b><span>{t}</span></li>)}</ol>
            <p className="hm-device-note">Nên làm worksheet trên desktop/laptop để có trải nghiệm tốt hơn.</p>
            <div className="hm-modal-actions">
              <button className="hm-btn primary" onClick={() => {
                setShowGuide(false);
                // Đã làm đủ và có kết quả AI → mở thẳng bản phân tích; còn lại → vào câu hỏi đang làm dở
                if (missing.length === 0 && data.ai) go("ai");
                else if (data.screen !== "q") go("q", data.current);
              }}>Đã hiểu, bắt đầu làm →</button>
              <button className="hm-btn" onClick={leave}>Thoát</button>
            </div>
          </div>
        </div>
      )}

      {/* Thanh công cụ */}
      <header className="hm-toolbar">
        <button className="hm-back" onClick={leave}>← Thoát</button>
        <div className="hm-toolbar-title"><span>CÔNG CỤ</span><strong>{product.title}</strong></div>
        <button className="hm-back hm-help" onClick={() => setShowGuide(true)} title="Xem hướng dẫn">?</button>
        <div className={`hm-save ${saveState}`}>
          {saveState === "saving" ? "Đang lưu..." : saveState === "saved" ? "✓ Đã lưu" : saveState === "error" ? "⚠ Lưu thất bại" : "Tự động lưu"}
        </div>
      </header>

      <nav className="hm-tabs" aria-label="Các phần của worksheet">
        {tabs.map((t) => (
          <button key={t.key} className={data.screen === t.key ? "active" : ""} onClick={() => go(t.key)}>{t.label}</button>
        ))}
      </nav>
      <div className="hm-progress"><i style={{ width: `${(doneCount / 30) * 100}%` }} /></div>

      {/* ───────── 30 CÂU HỎI ───────── */}
      {data.screen === "q" && (
        <div className="hm-page hm-q-layout">
          <aside className="hm-map" aria-label="Danh sách câu hỏi">
            {HM_PARTS.map((p) => (
              <div key={p.part} className="hm-map-part">
                <span>{p.part}. {p.name}</span>
                <div>
                  {HM_QUESTIONS.filter((x) => x.part === p.part).map((x) => {
                    const a = answerOf(data, x.n);
                    return (
                      <button key={x.n} title={x.title} onClick={() => go("q", x.n)}
                        className={[x.n === q.n ? "current" : "", isDone(a) ? "done" : ""].join(" ")}>
                        {x.n}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="hm-legend"><i className="done" /> Đã chọn</p>
          </aside>

          <div className="hm-q">
            {(q.n === 1 || q.n === 11 || q.n === 21) && (
              <section className="hm-part-intro">
                <span>PHẦN {part.part} · {part.range}</span>
                <h2>{part.name} - {part.tagline}</h2>
                <p>{part.intro}</p>
              </section>
            )}

            <div className="hm-q-head">
              <span className="hm-chip">Phần {part.part} · {part.name}</span>
              <span className="hm-qnum">Câu {String(q.n).padStart(2, "0")} / 30</span>
            </div>
            <h1 className="hm-q-title">{q.title}</h1>

            <Accordion title="Ý nghĩa câu hỏi này" key={`m${q.n}`}>
              {q.meaning.map((m, i) => <p key={i}>{m}</p>)}
            </Accordion>

            <div className="hm-options">
              {(["A", "B"] as Choice[]).map((c) => {
                const opt = c === "A" ? q.a : q.b;
                return (
                  <button key={c} type="button" className={`hm-option ${ans.choice === c ? "on" : ""}`} onClick={() => setAnswer(q.n, { choice: c })}>
                    <b>{c}</b>
                    <span><strong>{opt.label}</strong><em>{opt.desc}</em></span>
                  </button>
                );
              })}
            </div>

            <section className="hm-card">
              <h2>✍️ Câu hỏi xác minh</h2>
              <p className="hm-muted">Để kiểm tra xem lựa chọn của bạn có đúng không. Viết thật - không cần câu trả lời đẹp, chỉ cần đúng với bạn là được. Phần này không bắt buộc, nhưng càng viết thật và chi tiết thì bản phân tích cuối cùng càng sát với bạn.</p>
              {q.verify.map((v, i) => (
                <label key={i} className="hm-field">
                  <span>{v}</span>
                  <Area rows={2} value={ans.verify[i] || ""} onChange={(val) => { const verify = [...(ans.verify || ["", "", ""])]; verify[i] = val; setAnswer(q.n, { verify }); }} />
                </label>
              ))}
            </section>

            <section className="hm-card">
              <h2>📝 Ghi chú</h2>
              <Area value={ans.note || ""} onChange={(v) => setAnswer(q.n, { note: v })} placeholder="Thắc mắc, điều chưa chắc, hoặc muốn tìm hiểu thêm..." />
            </section>

            <div className="hm-nav">
              <button className="hm-btn" disabled={q.n === 1} onClick={() => go("q", q.n - 1)}>← Câu trước</button>
              {q.n < 30
                ? <button className="hm-btn primary" onClick={() => go("q", q.n + 1)}>Câu tiếp theo →</button>
                : <button className="hm-btn primary" onClick={() => go("summary")}>Xem tổng hợp →</button>}
            </div>
          </div>
        </div>
      )}

      {/* ───────── TỔNG HỢP ───────── */}
      {data.screen === "summary" && (
        <div className="hm-page">
          <section className="hm-hero small">
            <span className="hm-eyebrow">TỔNG HỢP</span>
            <h1>Đọc lại bức tranh của bạn</h1>
            <p>Bảng dưới đây đã điền sẵn lựa chọn của bạn cho từng câu. Bạn có thể ghi thêm một ghi chú ngắn cho mỗi câu.</p>
          </section>

          {missing.length > 0 && (
            <div className="hm-alert">
              <strong>Bạn đã hoàn thành {doneCount}/30 câu.</strong> Còn {missing.length} câu chưa chọn đáp án:
              <div className="hm-jump">{missing.map((n) => <button key={n} onClick={() => go("q", n)}>Câu {n}</button>)}</div>
            </div>
          )}

          <section className="hm-card hm-table-card">
            <h2>Bảng tóm tắt 30 câu hỏi</h2>
            {HM_PARTS.map((p) => (
              <div key={p.part} className="hm-sum-part">
                <h3>Phần {p.part} · {p.name}</h3>
                {HM_QUESTIONS.filter((x) => x.part === p.part).map((x) => {
                  const a = answerOf(data, x.n);
                  const opt = optionOf(x, a.choice);
                  return (
                    <div key={x.n} className="hm-sum-row">
                      <button className="hm-sum-q" onClick={() => go("q", x.n)}><b>Câu {x.n}</b><span>{x.title}</span></button>
                      <div className={`hm-sum-choice ${opt ? "" : "empty"}`}>{opt ? <><b>{a.choice}</b> {opt.label}</> : "Chưa chọn"}</div>
                      <input className="hm-input" value={a.short || ""} placeholder="Ghi chú ngắn..." onChange={(e) => setAnswer(x.n, { short: e.target.value })} />
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          <div className="hm-nav">
            <button className="hm-btn" onClick={() => go("q", 30)}>← Câu 30</button>
            {data.ai
              ? <button className="hm-btn primary" onClick={() => go("ai")}>Xem bản phân tích →</button>
              : <button className="hm-btn primary" disabled={missing.length > 0 || data.aiCount >= AI_MAX_RUNS} title={missing.length ? "Chọn đáp án đủ 30 câu trước nhé" : ""} onClick={() => { go("ai"); runAi(); }}>✦ Tạo bản phân tích AI</button>}
          </div>
        </div>
      )}

      {/* ───────── PHÂN TÍCH AI ───────── */}
      {data.screen === "ai" && (
        <div className="hm-page">
          <section className="hm-hero small">
            <span className="hm-eyebrow">PHÂN TÍCH AI</span>
            <h1>Bản phân tích profile sự nghiệp</h1>
            <p>Bản phân tích profile sự nghiệp của bạn gồm 7 phần: cách bạn vận hành, giá trị và động lực, điểm mạnh, môi trường phù hợp, ngành phù hợp, rủi ro cần lưu ý và câu mô tả bản thân. Bạn càng trả lời chi tiết câu hỏi xác minh thì bản phân tích càng đúng với bạn.</p>
          </section>

          {missing.length > 0 ? (
            <div className="hm-alert">
              <strong>Hoàn thành đủ 30 câu để mở phần phân tích.</strong> Bạn còn {missing.length} câu chưa chọn đáp án:
              <div className="hm-jump">{missing.map((n) => <button key={n} onClick={() => go("q", n)}>Câu {n}</button>)}</div>
            </div>
          ) : (
            <>
              {aiState === "loading" && (
                <section className="hm-card hm-ai-loading"><div className="hm-spin" /> AI đang đọc 30 câu trả lời của bạn... Việc này mất khoảng 20-40 giây.</section>
              )}
              {aiState === "error" && (
                <div className="hm-alert error">Chưa tạo được phân tích ({aiError}). Bạn thử lại sau ít phút nhé. Nếu vẫn lỗi, nhắn Tia qua Zalo 0362 864 028.{!data.ai && data.aiCount < AI_MAX_RUNS && <div style={{ marginTop: 10 }}><button className="hm-btn small" onClick={runAi}>Thử lại</button></div>}</div>
              )}
              {data.ai && aiState !== "loading" && (
                <section className="hm-card hm-ai">
                  <AiText text={data.ai.text} />
                  <p className="hm-muted small">Tạo lúc {new Date(data.ai.createdAt).toLocaleString("vi-VN")}</p>
                </section>
              )}
              {aiState !== "loading" && (
                <div className="hm-ai-actions">
                  {!data.ai ? (
                    aiState === "idle" && <p className="hm-muted">Chưa có bản phân tích. <button className="hm-link" onClick={() => go("summary")}>Về phần Tổng hợp</button> và bấm "Tạo bản phân tích AI" ở cuối trang nhé.</p>
                  ) : null}
                  {data.ai && <button className="hm-btn" onClick={() => window.print()}>⤓ Lưu PDF / In</button>}
                </div>
              )}
            </>
          )}

          <div className="hm-nav">
            <button className="hm-btn" onClick={() => go("summary")}>← Tổng hợp</button>
          </div>
          <p className="hm-reset"><button className="hm-link" onClick={resetAll}>Xoá bài làm và làm lại từ đầu</button></p>
        </div>
      )}

      {/* ───────── BẢN IN / PDF (chỉ hiện khi in) ───────── */}
      <div className="hm-print" aria-hidden="true">
        <h1>Hiểu Mình - {data.name}</h1>
        <p>Bắt đầu: {viDate(data.startDate)}{data.doneDate ? ` · Hoàn thành: ${viDate(data.doneDate)}` : ""} · tiahere.com</p>
        <h2>Bảng tóm tắt 30 câu hỏi</h2>
        <table>
          <thead><tr><th>Câu</th><th>Câu hỏi</th><th>Lựa chọn</th><th>Ghi chú ngắn</th></tr></thead>
          <tbody>
            {HM_QUESTIONS.map((x) => {
              const a = answerOf(data, x.n);
              const opt = optionOf(x, a.choice);
              return <tr key={x.n}><td>{x.n}</td><td>{x.title}</td><td>{opt ? `${a.choice} - ${opt.label}` : ""}</td><td>{a.short || ""}</td></tr>;
            })}
          </tbody>
        </table>
        {data.ai && <><h2>Bản phân tích AI</h2><AiText text={data.ai.text} /></>}
        <p className="hm-print-foot">© Career Planning by Tia Nguyễn · tiahere.com</p>
      </div>
    </div>
  );
}

// ── Giao diện (đặt trong .hm-root để không ảnh hưởng phần còn lại của web) ──
export const HM_CSS = `
.hm-root{--hm-fs:16px;--hm-bg:#F4EFE6;--hm-card:#fff;--hm-main:#C38380;--hm-main-d:#a96966;--hm-text:#4B342C;--hm-sub:#9C7164;--hm-accent:#D8B69F;--hm-pale:#F7EAE6;--hm-line:rgba(75,52,44,.12);
  background:var(--hm-bg);color:var(--hm-text);font-family:'DM Sans',system-ui,sans-serif;min-height:100vh;font-size:calc(var(--hm-fs) * 1.0);line-height:1.65;}
.hm-root *{box-sizing:border-box;}
.hm-root h1,.hm-root h2{font-family:'Playfair Display',Georgia,serif;font-weight:600;color:var(--hm-text);margin:0;}
.hm-root p{margin:0 0 .75em;}
.hm-loading{padding:80px 20px;text-align:center;color:var(--hm-sub);}
.hm-toolbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;padding:10px 20px;background:#fff;border-bottom:1px solid var(--hm-line);}
.hm-back{border:1px solid var(--hm-line);background:#fff;color:var(--hm-text);border-radius:999px;padding:7px 14px;font:inherit;font-size:calc(var(--hm-fs) * 0.875);cursor:pointer;white-space:nowrap;}
.hm-back:hover{background:var(--hm-pale);}
.hm-toolbar-title{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25;}
.hm-toolbar-title span{font-size:calc(var(--hm-fs) * 0.6875);letter-spacing:.12em;color:var(--hm-sub);}
.hm-toolbar-title strong{font-size:calc(var(--hm-fs) * 0.9375);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hm-save{font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-sub);white-space:nowrap;}
.hm-save.saved{color:#3f7d58;}.hm-save.error{color:#b3412f;}
.hm-tabs{position:sticky;top:57px;z-index:19;display:flex;gap:6px;overflow-x:auto;padding:10px 20px;background:var(--hm-bg);scrollbar-width:none;}
.hm-tabs::-webkit-scrollbar{display:none;}
.hm-tabs button{flex:0 0 auto;border:1px solid var(--hm-line);background:#fff;color:var(--hm-sub);border-radius:999px;padding:7px 14px;font:inherit;font-size:calc(var(--hm-fs) * 0.875);cursor:pointer;}
.hm-tabs button.active{background:var(--hm-main);border-color:var(--hm-main);color:#fff;}
.hm-progress{height:3px;background:var(--hm-line);margin:0 20px;border-radius:3px;overflow:hidden;}
.hm-progress i{display:block;height:100%;background:var(--hm-main);transition:width .4s;}
.hm-page{max-width:880px;margin:0 auto;padding:24px 20px 64px;}
.hm-hero{background:#fff;border-radius:20px;padding:32px;margin-bottom:16px;border:1px solid var(--hm-line);}
.hm-hero.small{padding:24px 28px;}
.hm-hero h1{font-size:calc(var(--hm-fs) * 2.5);line-height:1.15;margin:6px 0 4px;}
.hm-hero.small h1{font-size:calc(var(--hm-fs) * 1.75);}
.hm-eyebrow{font-size:calc(var(--hm-fs) * 0.6875);letter-spacing:.14em;color:var(--hm-main);font-weight:600;}
.hm-sub{font-style:italic;color:var(--hm-sub);font-size:calc(var(--hm-fs) * 1.125);}
.hm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0;}
.hm-stats div{background:var(--hm-pale);border-radius:14px;padding:14px;text-align:center;}
.hm-stats b{display:block;font-family:'Playfair Display',serif;font-size:calc(var(--hm-fs) * 1.875);color:var(--hm-main);line-height:1.1;}
.hm-stats span{font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-sub);}
.hm-card{background:var(--hm-card);border:1px solid var(--hm-line);border-radius:18px;padding:22px;margin-bottom:14px;}
.hm-card h2{font-size:calc(var(--hm-fs) * 1.25);margin-bottom:8px;}
.hm-card h3{font-size:calc(var(--hm-fs) * 0.9375);margin:16px 0 8px;}
.hm-muted{color:var(--hm-sub);font-size:calc(var(--hm-fs) * 0.875);}
.hm-muted.small,.small{font-size:calc(var(--hm-fs) * 0.8125);}
.hm-input{width:100%;font:inherit;font-size:calc(var(--hm-fs) * 0.9375);color:var(--hm-text);background:#FBF8F3;border:1px solid var(--hm-line);border-radius:12px;padding:10px 12px;outline:none;resize:vertical;transition:border-color .15s;}
.hm-input:focus{border-color:var(--hm-main);background:#fff;}
textarea.hm-input{min-height:64px;}
.hm-field{display:block;margin-top:14px;}
.hm-field>span{display:block;font-size:calc(var(--hm-fs) * 0.875);font-weight:500;margin-bottom:6px;}
.hm-field.row{display:flex;align-items:center;gap:10px;margin-top:10px;}
.hm-field.row>span{margin:0;font-family:'Playfair Display',serif;font-size:calc(var(--hm-fs) * 1.125);color:var(--hm-main);}
.hm-grid3{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:12px;}
.hm-grid3 label>span{display:block;font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-sub);margin-bottom:4px;}
.hm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;}
.hm-check-group{margin-top:8px;}
.hm-check{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;border:1px solid var(--hm-line);background:#FBF8F3;border-radius:12px;padding:10px 12px;margin-bottom:6px;font:inherit;font-size:calc(var(--hm-fs) * 0.9375);color:var(--hm-text);cursor:pointer;}
.hm-check i{flex:0 0 20px;height:20px;border-radius:6px;border:1.5px solid var(--hm-accent);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:calc(var(--hm-fs) * 0.8125);color:#fff;margin-top:2px;}
.hm-check.on{background:var(--hm-pale);border-color:var(--hm-main);}
.hm-check.on i{background:var(--hm-main);border-color:var(--hm-main);}
.hm-check.inline{width:auto;margin:12px 0 0;}
.hm-acc{background:#fff;border:1px solid var(--hm-line);border-radius:16px;margin-bottom:10px;overflow:hidden;}
.hm-acc-head{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;border:0;background:none;padding:15px 20px;font:inherit;font-weight:600;font-size:calc(var(--hm-fs) * 1.0);color:var(--hm-text);cursor:pointer;text-align:left;}
.hm-acc-head i{font-style:normal;font-size:calc(var(--hm-fs) * 1.25);color:var(--hm-main);}
.hm-acc-body{padding:0 20px 16px;}
.hm-acc.open{border-color:var(--hm-accent);}
.hm-root blockquote{margin:10px 0;padding:12px 16px;border-left:3px solid var(--hm-main);background:var(--hm-pale);border-radius:0 12px 12px 0;font-style:italic;}
.hm-guide h2{margin:6px 0 14px;}
.hm-guide-list{list-style:none;margin:0;padding:0;}
.hm-guide-list li{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;}
.hm-guide-list li:last-child{margin-bottom:0;}
.hm-guide-list b{flex:0 0 28px;height:28px;border-radius:50%;background:var(--hm-main);color:#fff;display:flex;align-items:center;justify-content:center;font-size:calc(var(--hm-fs) * 0.875);margin-top:1px;}
.hm-steps{margin:0 0 10px;padding-left:22px;}
.hm-steps li{margin-bottom:6px;}
.hm-example{background:#FBF5EC;border-left:3px solid var(--hm-accent);padding:12px 16px;border-radius:0 12px 12px 0;font-style:italic;}
.hm-tip{font-size:calc(var(--hm-fs) * 0.875);color:var(--hm-main);}
.hm-hint-mine{background:var(--hm-pale);border-radius:10px;padding:8px 12px;}
.hm-chip{display:inline-block;font-size:calc(var(--hm-fs) * 0.75);font-weight:600;padding:3px 10px;border-radius:999px;background:var(--hm-pale);color:var(--hm-main-d);}
.hm-chip.small{font-size:calc(var(--hm-fs) * 0.6875);padding:2px 8px;margin-right:8px;}
.hm-chip.warn{background:#FFF1D6;color:#9a6a12;margin-left:8px;}
.hm-nav{display:flex;justify-content:space-between;gap:10px;margin-top:22px;}
.hm-nav.end{justify-content:flex-end;}
.hm-btn{border:1px solid var(--hm-line);background:#fff;color:var(--hm-text);border-radius:999px;padding:11px 20px;font:inherit;font-size:calc(var(--hm-fs) * 0.9375);font-weight:500;cursor:pointer;}
.hm-btn:hover:not(:disabled){background:var(--hm-pale);}
.hm-btn.primary{background:var(--hm-main);border-color:var(--hm-main);color:#fff;}
.hm-btn.primary:hover:not(:disabled){background:var(--hm-main-d);}
.hm-btn:disabled{opacity:.45;cursor:not-allowed;}
.hm-btn.small{padding:6px 14px;font-size:calc(var(--hm-fs) * 0.8125);}
.hm-link{border:0;background:none;color:var(--hm-main);text-decoration:underline;font:inherit;font-size:calc(var(--hm-fs) * 0.875);cursor:pointer;padding:0;}
.hm-q-layout{max-width:1120px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;align-items:start;}
.hm-map{position:sticky;top:120px;background:#fff;border:1px solid var(--hm-line);border-radius:16px;padding:14px;}
.hm-map-part{margin-bottom:12px;}
.hm-map-part>span{display:block;font-size:calc(var(--hm-fs) * 0.75);font-weight:600;color:var(--hm-sub);margin-bottom:6px;}
.hm-map-part>div{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;}
.hm-map button{aspect-ratio:1;border:1px solid var(--hm-line);background:#FBF8F3;border-radius:9px;font:inherit;font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-sub);cursor:pointer;position:relative;padding:0;}
.hm-map button.half{background:#FBEFE3;border-color:var(--hm-accent);color:var(--hm-text);}
.hm-map button.done{background:var(--hm-main);border-color:var(--hm-main);color:#fff;}
.hm-map button.current{outline:2px solid var(--hm-text);outline-offset:1px;}
.hm-map button.unsure::after{content:"";position:absolute;top:-3px;right:-3px;width:8px;height:8px;border-radius:50%;background:#E0A030;border:1.5px solid #fff;}
.hm-legend{font-size:calc(var(--hm-fs) * 0.6875);color:var(--hm-sub);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin:4px 0 0;}
.hm-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:3px;vertical-align:-1px;}
.hm-legend i.done{background:var(--hm-main);}.hm-legend i.half{background:#FBEFE3;border:1px solid var(--hm-accent);}.hm-legend i.unsure{background:#E0A030;border-radius:50%;}
.hm-part-intro{background:var(--hm-text);color:#F4EFE6;border-radius:18px;padding:22px 24px;margin-bottom:16px;}
.hm-part-intro span{font-size:calc(var(--hm-fs) * 0.6875);letter-spacing:.14em;color:var(--hm-accent);}
.hm-part-intro h2{color:#fff;font-size:calc(var(--hm-fs) * 1.5);margin:4px 0 8px;}
.hm-part-intro p{font-size:calc(var(--hm-fs) * 0.9375);opacity:.9;margin:0;}
.hm-q-head{display:flex;justify-content:space-between;align-items:center;gap:8px;}
.hm-qnum{font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-sub);}
.hm-q-title{font-size:calc(var(--hm-fs) * 1.875);line-height:1.25;margin:10px 0 18px !important;}
.hm-options{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
.hm-option{display:flex;gap:14px;align-items:flex-start;text-align:left;border:2px solid var(--hm-line);background:#fff;border-radius:18px;padding:18px;font:inherit;color:var(--hm-text);cursor:pointer;transition:all .15s;}
.hm-option:hover{border-color:var(--hm-accent);}
.hm-option b{flex:0 0 36px;height:36px;border-radius:50%;background:var(--hm-pale);color:var(--hm-main);display:flex;align-items:center;justify-content:center;font-size:calc(var(--hm-fs) * 1.0);}
.hm-option strong{display:block;font-size:calc(var(--hm-fs) * 1.0625);margin-bottom:2px;}
.hm-option em{display:block;font-style:normal;font-size:calc(var(--hm-fs) * 0.875);color:var(--hm-sub);line-height:1.5;}
.hm-option.on{border-color:var(--hm-main);background:var(--hm-pale);}
.hm-option.on b{background:var(--hm-main);color:#fff;}
.hm-alert{background:#FFF6E5;border:1px solid #F0D49A;border-radius:16px;padding:16px 18px;margin-bottom:14px;font-size:calc(var(--hm-fs) * 0.9375);}
.hm-alert.error{background:#FDEDEA;border-color:#F2B8AD;}
.hm-jump{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0;align-items:center;font-size:calc(var(--hm-fs) * 0.875);color:var(--hm-sub);}
.hm-jump button{border:1px solid var(--hm-line);background:#fff;border-radius:999px;padding:4px 12px;font:inherit;font-size:calc(var(--hm-fs) * 0.8125);color:var(--hm-text);cursor:pointer;}
.hm-sum-part h3{font-family:'Playfair Display',serif;font-size:calc(var(--hm-fs) * 1.0625);color:var(--hm-main);margin:18px 0 6px;}
.hm-sum-row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--hm-line);}
.hm-sum-q{display:flex;gap:8px;text-align:left;border:0;background:none;font:inherit;font-size:calc(var(--hm-fs) * 0.875);color:var(--hm-text);cursor:pointer;padding:0;}
.hm-sum-q b{flex:0 0 52px;color:var(--hm-sub);font-weight:500;}
.hm-sum-q:hover span{text-decoration:underline;}
.hm-sum-choice{font-size:calc(var(--hm-fs) * 0.875);font-weight:500;}
.hm-sum-choice b{display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--hm-main);color:#fff;font-size:calc(var(--hm-fs) * 0.75);align-items:center;justify-content:center;margin-right:4px;}
.hm-sum-choice.empty{color:var(--hm-sub);font-weight:400;font-style:italic;}
.hm-sum-row .hm-input{padding:7px 10px;font-size:calc(var(--hm-fs) * 0.875);}
.hm-ai-loading{display:flex;align-items:center;gap:12px;color:var(--hm-main-d);}
.hm-spin{width:22px;height:22px;flex:0 0 22px;border:3px solid var(--hm-pale);border-top-color:var(--hm-main);border-radius:50%;animation:hmspin .8s linear infinite;}
@keyframes hmspin{to{transform:rotate(360deg);}}
.hm-ai-note{font-size:calc(var(--hm-fs) * 0.8125);color:#9a6a12;background:#FFF6E5;border-radius:10px;padding:8px 12px;}
.hm-ai-text h3{font-family:'Playfair Display',serif;font-size:calc(var(--hm-fs) * 1.25);color:var(--hm-main-d);margin:22px 0 8px;padding-top:14px;border-top:1px solid var(--hm-line);}
.hm-ai-text h3:first-child{border-top:0;padding-top:0;margin-top:8px;}
.hm-ai-text ul{padding-left:20px;margin:0 0 .75em;}
.hm-ai-text li{margin-bottom:4px;}
.hm-ai-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}
.hm-suggest{background:var(--hm-pale);border-radius:14px;padding:14px 16px;margin:10px 0 12px;}
.hm-suggest>span{font-size:calc(var(--hm-fs) * 0.8125);font-weight:600;color:var(--hm-main-d);}
.hm-suggest p{margin:6px 0 10px;font-style:italic;}
.hm-expect-list{background:#FBF8F3;border-radius:12px;padding:12px 16px;font-size:calc(var(--hm-fs) * 0.875);}
.hm-expect-list span{color:var(--hm-sub);}
.hm-expect-list ul{margin:6px 0 0;padding-left:20px;}
.hm-done{background:#EEF6EF;border:1px solid #BFDCC6;border-radius:18px;padding:20px 22px;margin-top:6px;}
.hm-done h2{font-size:calc(var(--hm-fs) * 1.25);margin-bottom:6px;}
.hm-reset{text-align:center;margin-top:28px;}
.hm-print{display:none;}
.hm-modal-bg{position:fixed;inset:0;z-index:1000;background:rgba(43,30,25,.55);display:flex;align-items:center;justify-content:center;padding:16px;}
.hm-modal{background:#fff;border-radius:20px;max-width:620px;width:100%;max-height:calc(100vh - 32px);overflow-y:auto;padding:28px 28px 24px;box-shadow:0 20px 60px rgba(43,30,25,.25);}
.hm-modal h2{font-size:calc(var(--hm-fs) * 1.5);margin:6px 0 18px;}
.hm-modal-actions{display:flex;gap:10px;margin-top:24px;}
.hm-modal-actions .hm-btn.primary{flex:1;}
.hm-device-note{margin:18px 0 0 !important;padding:10px 14px;background:var(--hm-pale);border-radius:12px;font-size:calc(var(--hm-fs) * 0.875);color:var(--hm-main-d);}
.hm-help{width:34px;height:34px;padding:0;font-weight:600;}
@media (max-width:860px){
  .hm-q-layout{grid-template-columns:minmax(0,1fr);gap:12px;}
  .hm-q-layout>*{min-width:0;}
  .hm-map{position:static;display:flex;gap:10px;overflow-x:auto;padding:10px;border-radius:14px;}
  .hm-map-part{margin:0;flex:0 0 auto;}
  .hm-map-part>div{display:flex;gap:5px;}
  .hm-map button{width:34px;height:34px;aspect-ratio:auto;flex:0 0 34px;}
  .hm-legend{display:none;}
}
@media (max-width:640px){
  .hm-root{font-size:calc(var(--hm-fs) * 1.0);}
  .hm-toolbar{padding:8px 12px;gap:8px;}
  .hm-toolbar-title span{display:none;}
  .hm-save{font-size:calc(var(--hm-fs) * 0.75);max-width:72px;text-align:right;line-height:1.2;}
  .hm-tabs{top:51px;padding:8px 12px;}
  .hm-progress{margin:0 12px;}
  .hm-page{padding:16px 12px 56px;}
  .hm-hero{padding:22px 18px;border-radius:16px;}
  .hm-hero h1{font-size:calc(var(--hm-fs) * 2.0);}
  .hm-hero.small h1{font-size:calc(var(--hm-fs) * 1.5);}
  .hm-stats{grid-template-columns:repeat(2,1fr);}
  .hm-card{padding:18px 16px;border-radius:16px;}
  .hm-grid3,.hm-grid2{grid-template-columns:1fr;}
  .hm-options{grid-template-columns:1fr;}
  .hm-q-title{font-size:calc(var(--hm-fs) * 1.5);}
  .hm-acc-head{padding:14px 16px;}
  .hm-acc-body{padding:0 16px 14px;}
  .hm-sum-row{grid-template-columns:1fr;gap:6px;}
  .hm-nav .hm-btn{flex:1;padding:12px 10px;}
  .hm-modal{padding:20px 18px 18px;border-radius:16px;}
  .hm-modal h2{font-size:calc(var(--hm-fs) * 1.3125);margin-bottom:14px;}
  .hm-guide-list li{font-size:calc(var(--hm-fs) * 0.9375);line-height:1.55;margin-bottom:10px;}
  .hm-modal-actions{margin-top:18px;}
}
@media print{
  body *{visibility:hidden !important;}
  .hm-print,.hm-print *{visibility:visible !important;}
  .hm-print{display:block !important;position:absolute;left:0;top:0;width:100%;padding:0 8mm;color:#222;font-size:11pt;line-height:1.55;}
  .hm-print h1{font-size:20pt;margin:0 0 4pt;}
  .hm-print h2{font-size:13pt;margin:16pt 0 6pt;color:#a96966;}
  .hm-print table{width:100%;border-collapse:collapse;font-size:9.5pt;}
  .hm-print th,.hm-print td{border:0.5pt solid #ccc;padding:3pt 5pt;text-align:left;vertical-align:top;}
  .hm-print .hm-ai-text h3{font-size:11.5pt;border:0;padding:0;margin:10pt 0 4pt;}
  .hm-print-foot{margin-top:18pt;font-size:9pt;color:#888;}
}
`;
