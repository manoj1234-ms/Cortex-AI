import express from "express"
import { deductCredits, getUserProfile, login, logout, updateUserPayment } from "../controller/auth.contoller.js"

const router = express.Router()

router.post("/login",login)

router.get("/me", getUserProfile)

router.get("/logout",logout)

router.post("/update-plan", updateUserPayment)

router.post("/deduct-credit", deductCredits)
export default router