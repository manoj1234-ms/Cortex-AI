import express from "express"
import { deductCredits, getUserProfile, login, logout, updateUserPayment } from "../controller/auth.contoller.js"
import { internalOnly } from "../middleware/internalOnly.js";

const router = express.Router()

router.post("/login", login)

router.get("/me", getUserProfile)

router.get("/logout", logout)

router.post("/update-plan", internalOnly, updateUserPayment)

router.post("/deduct-credit", deductCredits)
export default router