export const getCurrentUser = async (req,res) => {
    try {
        const userId = req.user?.userId
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const response = await fetch(`${process.env.AUTH_SERVICE}/me`, {
            headers: { "x-user-id": userId },
            signal: AbortSignal.timeout(5000),
        })
        const data = await response.json()

        if (!response.ok) {
            return res.status(response.status).json(data)
        }

        return res.status(200).json(data)
    } catch (error) {
        console.error("Get current user error:", error)
        return res.status(500).json({
            message: "Unable to load your profile. Please try again.",
        })
    }
}