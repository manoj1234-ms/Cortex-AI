
import { getAuth } from "firebase-admin/auth";
import crypto from "node:crypto";
import { app } from "../config/firebase.js";
import User from "../model/user_model.js";
import redis from "../../../shared/redis/redis.js";

const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
};

export const login = async (req, res) => {
  try {
    const { token } = req.body;

    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        message: "Firebase ID token is required",
      });
    }

    // Verify Firebase ID token
    const decoded = await getAuth(app).verifyIdToken(token);

    // Find existing user
    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    // Create user if they don't exist
    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        name: decoded.name,
        email: decoded.email,
        avatar: decoded.picture,
      });
    }

    // Create Redis session
    const sessionId = crypto.randomUUID();
    const sessionUser = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan || "free",
      credits: user.credits ?? 100,
      totalCredits: user.totalCredits ?? 100,
      planExpiresAt: user.planExpiresAt ?? user.PlanExpiresAt,
    };

    await redis.set(
      `session:${sessionId}`,
      JSON.stringify(sessionUser),
      "EX",
      3 * 24 * 60 * 60
    );

    // Set session cookie
    res.cookie("session", sessionId, {
      ...sessionCookieOptions,
      maxAge: 3 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: sessionUser,
      sessionId,
    });
  } catch (error) {
    console.error("Login error:", error);

    if (typeof error.code === "string" && error.code.startsWith("auth/")) {
      return res.status(401).json({ message: "Invalid Firebase ID token" });
    }

    return res.status(500).json({
      message: "Unable to log in",
    });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const sessionId = req.cookies?.session || bearerToken;

    if (sessionId) {
      await redis.del(`session:${sessionId}`);
    }

    res.clearCookie("session", sessionCookieOptions);

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    // console.error("Logout error:", error);

    return res.status(500).json({
      message: "Unable to log out",
    });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.get("x-user-id");
    if (!userId) {
      return res.status(401).json({ message: "User identity is required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan || "free",
      credits: user.credits ?? 100,
      totalCredits: user.totalCredits ?? 100,
      planExpiresAt: user.planExpiresAt ?? user.PlanExpiresAt,
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    return res.status(500).json({ message: "Unable to load user profile." });
  }
};


export const updateUserPayment = async (req,res) => {
  try {
    const { plan, credits, userId } = req.body

    const user = await User.findById(userId)

    if(!user){
      return res.status(404).json({message: 'user not found'})
    }

    if (
      typeof plan !== "string" ||
      !Number.isFinite(credits) ||
      credits <= 0
    ) {
      return res.status(400).json({ message: "A valid plan and credit amount are required." });
    }

    user.plan= plan
    user.credits = (user.credits ?? 100) + credits
    user.totalCredits = (user.totalCredits ?? 100) + credits
    user.planExpiresAt = new Date(Date.now() + 30 * 24 *60 *60*1000)
    await user.save()

    const sessionId = req.cookies?.session;

    const sessionUser = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan,
      credits: user.credits,
      totalCredits: user.totalCredits,
      planExpiresAt: user.planExpiresAt ?? user.PlanExpiresAt
    };


    if (sessionId) {
      await redis.set(
      `session:${sessionId}`,
      JSON.stringify(sessionUser),
      "EX",
      3 * 24 * 60 * 60
    );
    }

    return res.status(200).json({
      success:true
    })

  } catch (error) {
    return res.status(500).json({
      message:` Update user payment ${error}`,
    });
  }
}


export const deductCredits = async (req, res) => {
  try {
    const {userId, agent} = req.body
    const COST = {
      chat : 1,
      search : 5,
      coding : 10,
      debug:10,
      pdf : 10,
      ppt : 10,
      vision : 10
    };

    const user = await User.findById(userId)

    if(!user) {
      return res.status(400).json({
        message: "user not found"
      })
    }

    const requireCredit = COST[agent] || 1

    if(user.credits < requireCredit ) {
       return res.status(400).json({
        message: "Not enougth Credits."
      })
    }

    user.credits -= requireCredit
    await user.save()

    const sessionId = req.cookies?.session;

    const sessionUser = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan,
      credits: user.credits,
      totalCredits: user.totalCredits,
      planExpiresAt: user.planExpiresAt ?? user.PlanExpiresAt
    };


    if (sessionId) {
      await redis.set(
      `session:${sessionId}`,
      JSON.stringify(sessionUser),
      "EX",
      3 * 24 * 60 * 60
    );
    }

    return res.status(200).json({success:true, credits:user.credits})

  } catch (error) {
    return res.status(500).json({
      message: `credit deduction error from backend ${error}`
    })
  }
}