// Robust Firebase Admin Initialization with safe build-time fallback

let adminApp: any = null;
let adminDbInstance: any = null;
let adminAuthInstance: any = null;

function initFirebaseAdmin() {
  if (adminApp) return adminApp;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApps, initializeApp, cert } = require("firebase-admin/app");

    if (getApps().length > 0) {
      adminApp = getApps()[0];
      return adminApp;
    }

    let credential: any = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf-8");
        credential = cert(JSON.parse(decoded));
      } catch (e) {
        console.warn("Could not decode FIREBASE_SERVICE_ACCOUNT_BASE64:", e);
      }
    }

    if (!credential && (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
      if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
        credential = cert({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        });
      }
    }

    if (credential) {
      adminApp = initializeApp({
        credential,
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
      });
      return adminApp;
    }
  } catch (error) {
    console.warn("Firebase admin initialization warning:", error);
  }

  return null;
}

const adminDbProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!adminDbInstance) {
        const app = initFirebaseAdmin();
        if (app) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getFirestore } = require("firebase-admin/firestore");
            adminDbInstance = getFirestore(app);
          } catch (e) {}
        }
      }
      if (adminDbInstance && typeof adminDbInstance[prop] !== "undefined") {
        const val = adminDbInstance[prop];
        return typeof val === "function" ? val.bind(adminDbInstance) : val;
      }
      return () => undefined;
    },
  }
);

const adminAuthProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!adminAuthInstance) {
        const app = initFirebaseAdmin();
        if (app) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getAuth } = require("firebase-admin/auth");
            adminAuthInstance = getAuth(app);
          } catch (e) {}
        }
      }
      if (adminAuthInstance && typeof adminAuthInstance[prop] !== "undefined") {
        const val = adminAuthInstance[prop];
        return typeof val === "function" ? val.bind(adminAuthInstance) : val;
      }
      return () => undefined;
    },
  }
);

const adminDb: any = adminDbProxy;
const adminAuth: any = adminAuthProxy;

export { adminDb, adminAuth };
