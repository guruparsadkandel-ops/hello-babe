import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, messaging } from './firebase';

const VAPID_KEY = 'BlagMy_3ybArTKaBOudV6Pq4YBZ5hj_VUS8OscLXiBO78gHVXkSWThCJepvWEvWSQm95NnSlqAre8nakCnQounl';

// ── Request permission + save FCM token ───────────────────────────
export async function setupNotifications(userEmail) {
  try {
    if (!('Notification' in window)) return null;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    if (!messaging) return null;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      const key = userEmail.replace(/[@.]/g, '_');
      await setDoc(doc(db, 'fcmTokens', key), {
        token, email: userEmail, updatedAt: new Date(),
      }, { merge: true });
    }
    return token;
  } catch (err) {
    console.error('Notification setup error:', err);
    return null;
  }
}

// ── Listen for foreground messages ────────────────────────────────
export function listenForMessages(callback) {
  try {
    if (!messaging) return;
    onMessage(messaging, callback);
  } catch (err) {
    console.error('Listen error:', err);
  }
}

// ── Save notification to Firestore (partner will receive it) ──────
export async function sendNotification(toEmail, senderName, messageText) {
  try {
    const key  = toEmail.replace(/[@.]/g, '_');
    const snap = await getDoc(doc(db, 'fcmTokens', key));
    if (!snap.exists()) return;
    // Save to a notifications queue in Firestore
    // A Firebase Cloud Function would normally send this — for now we save it
    // and the partner's app picks it up via onMessage when open
    await setDoc(doc(db, 'notificationQueue', `${key}_${Date.now()}`), {
      to: toEmail, token: snap.data().token,
      title: `${senderName} 💗`,
      body:  messageText,
      sentAt: new Date(), delivered: false,
    });
  } catch (err) {
    console.error('Send notification error:', err);
  }
}

// ── In-app floating notification banner ──────────────────────────
export function showInAppNotification(title, body, onClick) {
  const existing = document.getElementById('hb-notif-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'hb-notif-banner';
  banner.style.cssText = `
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%) translateY(-80px);
    background: white; border-radius: 18px; padding: 12px 16px;
    box-shadow: 0 8px 32px rgba(232,121,160,0.35);
    border: 1px solid rgba(232,121,160,0.25);
    display: flex; align-items: center; gap: 12px;
    z-index: 99999; cursor: pointer; max-width: 320px; width: 90%;
    transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
    font-family: 'Lato', sans-serif;
  `;
  banner.innerHTML = `
    <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#E879A0,#A855D4);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;">💗</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;color:#2D0A0A;margin-bottom:1px;">${title}</div>
      <div style="font-size:12px;color:rgba(180,60,100,0.65);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${body}</div>
    </div>
    <button id="hb-notif-close" style="background:none;border:none;cursor:pointer;color:rgba(180,60,100,0.35);font-size:18px;flex-shrink:0;line-height:1;">✕</button>
  `;

  document.body.appendChild(banner);
  // Slide in
  requestAnimationFrame(() => {
    banner.style.transform = 'translateX(-50%) translateY(0)';
  });

  const dismiss = () => {
    banner.style.transform = 'translateX(-50%) translateY(-80px)';
    setTimeout(() => banner.remove(), 350);
  };

  document.getElementById('hb-notif-close').onclick = (e) => { e.stopPropagation(); dismiss(); };
  banner.onclick = () => { dismiss(); onClick?.(); };
  setTimeout(dismiss, 4000);
}

// ── Browser tab title badge ───────────────────────────────────────
let unreadCount = 0;
const originalTitle = document.title;

export function setBadgeCount(count) {
  unreadCount = count;
  if (count > 0) {
    document.title = `(${count}) Hello Babe 💗`;
    // Try to set app badge (supported on Android Chrome)
    if ('setAppBadge' in navigator) navigator.setAppBadge(count).catch(()=>{});
  } else {
    document.title = originalTitle;
    if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(()=>{});
  }
}