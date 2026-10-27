// Guards routes that should only be called by trusted internal services.
// The caller must supply the same INTERNAL_SECRET_KEY set in this service's .env.

export const internalOnly = (req, res, next) => {
    const secret = process.env.INTERNAL_SECRET_KEY  // fixed: was INTERNAL_SECRE_TKEY (typo)

    if (!secret) {
        console.error("INTERNAL_SECRET_KEY is not configured in the auth service.");
        return res.status(500).json({ message: "Server misconfiguration." });
    }

    // Read directly from the dedicated header (billing service sends this)
    const sentSecret = req.headers["x-internal-secret"]  // fixed: removed broken parts[1] reference

    if (!sentSecret) {
        return res.status(401).json({ message: "Unauthorized: Missing secret" });
    }

    if (sentSecret !== secret) {
        return res.status(403).json({ message: "Forbidden: Incorrect secret" });
    }

    next()
}