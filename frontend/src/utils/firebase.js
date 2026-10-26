// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
// import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "cotex-ai-b782f.firebaseapp.com",
  projectId: "cotex-ai-b782f",
  storageBucket: "cotex-ai-b782f.firebasestorage.app",
  messagingSenderId: "668176538269",
  appId: "1:668176538269:web:9b238251941803bd26d274",
  measurementId: "G-049XSV6GVF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const auth = getAuth(app)
export const googleProvider= new GoogleAuthProvider()

