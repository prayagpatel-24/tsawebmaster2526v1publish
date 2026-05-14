import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBguT9BsQHwsAwAd3mbEmj3S5E7GtR_IBU",
  authDomain: "webmaster-v4-0.firebaseapp.com",
  projectId: "webmaster-v4-0",
  storageBucket: "webmaster-v4-0.firebasestorage.app",
  messagingSenderId: "413556961992",
  appId: "1:413556961992:web:899600895ecb68eb9debfd"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let lastIsAdmin = false;

function isAdminRole(role) {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'admin' || normalized === 'founder';
}

function setNotificationVisibility(isAdmin) {
  lastIsAdmin = !!isAdmin;
  document.body.classList.toggle('ripple-admin-user', lastIsAdmin);
  document.querySelectorAll('.notif-icon').forEach(link => {
    link.hidden = !lastIsAdmin;
    link.setAttribute('aria-hidden', lastIsAdmin ? 'false' : 'true');
  });
}

window.rippleSetAdminNav = setNotificationVisibility;
setNotificationVisibility(false);

new MutationObserver(() => setNotificationVisibility(lastIsAdmin))
  .observe(document.body, { childList: true, subtree: true });

onAuthStateChanged(auth, async user => {
  if (!user) {
    setNotificationVisibility(false);
    return;
  }
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    setNotificationVisibility(userSnap.exists() && isAdminRole(userSnap.data().role));
  } catch (error) {
    console.warn('Admin nav role check failed:', error);
    setNotificationVisibility(false);
  }
});
