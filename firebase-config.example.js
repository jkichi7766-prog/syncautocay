// Example config. Duplicate to firebase-config.js and replace with your live project credentials.
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const databasePath = "products";

// Firebase Auth UID that can approve submissions in admin.html.
export const adminUid = "";

// Optional: ImgBB API key for image uploads (keep out of public builds if possible).
export const imgbbKey = "";
