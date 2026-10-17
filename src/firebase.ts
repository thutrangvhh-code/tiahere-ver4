// Kết nối Firebase cho tiahere.com (project tiahere-ver4)
// - firebaseConfig: thông tin công khai của web app, để trong code là bình thường
// - App Check: chặn các script tự động gọi thẳng vào database mà không đi qua website
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, getToken, ReCaptchaV3Provider } from "firebase/app-check";
import type { AppCheck } from "firebase/app-check";

// ⬇ DÁN LẠI 6 GIÁ TRỊ TỪ FILE firebase.ts CŨ CỦA BẠN (hoặc Firebase Console → Project settings → Your apps → Config)
const firebaseConfig = {
  apiKey: "AIzaSyA3pMHO0HGOW1dEIVpUTqSK3YOnAwUD1cA",
  authDomain: "tiahere-ver4.firebaseapp.com",
  projectId: "tiahere-ver4",
  storageBucket: "tiahere-ver4.firebasestorage.app",
  messagingSenderId: "152808541172",
  appId: "1:152808541172:web:a90c9f9aae59f1f08a87a1",
};

// ⬇ DÁN "Site key" của reCAPTCHA v3 (khoá công khai, để trong code được). Để trống = tạm chưa bật App Check.
const RECAPTCHA_SITE_KEY = "";

const app = initializeApp(firebaseConfig);

// App Check phải được khởi tạo trước khi dùng Firestore
let appCheck: AppCheck | null = null;
if (RECAPTCHA_SITE_KEY && typeof window !== "undefined") {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Mã App Check gửi kèm khi gọi AI (Worker dùng mã này để đọc Firestore khi App Check đã bật bắt buộc)
export async function appCheckToken(): Promise<string> {
  if (!appCheck) return "";
  try {
    return (await getToken(appCheck)).token;
  } catch {
    return "";
  }
}
