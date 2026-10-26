import { cert, initializeApp } from "firebase-admin";
import { readFileSync } from "node:fs";

const loadServiceAccount = () => {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    try {
      return JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY must contain valid JSON.", {
        cause: error,
      });
    }
  }

  try {
    return JSON.parse(
      readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8")
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "Firebase Admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_KEY or provide serviceAccountKey.json for local development.",
        { cause: error }
      );
    }

    throw error;
  }
};

const serviceAccount = loadServiceAccount();

if (
  !serviceAccount ||
  typeof serviceAccount !== "object" ||
  Array.isArray(serviceAccount)
) {
  throw new Error("Firebase Admin credentials must be a JSON object.");
}

export const app =  initializeApp({
  credential: cert(serviceAccount)
});
