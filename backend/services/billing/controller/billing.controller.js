import crypto from "node:crypto";
import axios from "axios";
import { PLANS } from '../config/Plan.js';
import razorpay from '../config/razorpay.js';
import Payment from '../models/payment.model.js';


export const createOrder = async (req,res) => {
    try {
        const { plan } = req.body ?? {}
        const userId = req.get("x-user-id")

        if (!userId) {
            return res.status(401).json({ message: "User identity is required." })
        }

        const selectedPlan = PLANS[plan]

        if (!selectedPlan || selectedPlan.id === "free") {
            return res.status(400).json({ message: "Select a valid paid plan." })
        }

        const order = await razorpay.orders.create({
            amount: selectedPlan.amount * 100,
            currency: "INR",
            receipt: `receipt-${Date.now()}`
        })

        await Payment.create({
            userId,
            orderId:order.id,
            amount:selectedPlan.amount,
            credits:selectedPlan.credits,
            plan: selectedPlan.id,
            currency: order.currency,
            status: "created"
        })

        return res.status(200).json({order, plan: selectedPlan})
    } catch (error) {
        console.error("Create billing order error:", error)
        return res.status(500).json({
            message: "Unable to create a payment order. Check the billing service logs and Razorpay configuration."
        })
    }
}

export const verifyPayment = async(req,res) => {
    try {
        const {
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: suppliedSignature,
        } = req.body ?? {}
        const userId = req.get("x-user-id")

        if (!orderId || !paymentId || !suppliedSignature) {
            return res.status(400).json({ message: "Razorpay payment details are incomplete." })
        }
        if (!userId) {
            return res.status(401).json({ message: "User identity is required." })
        }
        if (!process.env.RAZORPAY_KEY_SECRET) {
            throw new Error("RAZORPAY_KEY_SECRET is not configured.")
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest()
        const receivedSignature = Buffer.from(suppliedSignature, "hex")

        if (
            receivedSignature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(expectedSignature, receivedSignature)
        ) {
            return res.status(400).json({ message: "Payment verification failed." })
        }
        
        const payment = await Payment.findOne({ orderId })

        if(!payment){
            return res.status(404).json({ message: "Payment order not found." })
        }
        if (payment.userId !== userId) {
            return res.status(403).json({ message: "This payment order does not belong to the current user." })
        }

        payment.status = "paid"
        payment.paymentId = paymentId

        await payment.save()

        if (!process.env.AUTH_SERVICE) {
            throw new Error("AUTH_SERVICE is not configured.")
        }

        await axios.post(`${process.env.AUTH_SERVICE}/update-plan`, {
            userId: payment.userId,
            plan: payment.plan,
            credits: payment.credits,
        }, {
            timeout: 10_000,
        })

        return res.status(200).json({ message: "Payment verified successfully." })

    } catch (error) {
        console.error("Verify billing payment error:", error)
        return res.status(500).json({
            message: "Unable to verify payment. Check the billing service logs.",
        })
    }
}