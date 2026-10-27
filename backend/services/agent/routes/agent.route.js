import express from "express"
import { createAgentHandler } from "../contollers/agent.contoller.js"
import multerUpload, { verifyFileMagicBytes } from '../config/multer.js'
import { rm } from "node:fs/promises"

// Wraps multer.single() and the magic-byte check into one middleware.
// On any upload error the temp file is deleted and a JSON 4xx is returned.
const uploadFile = (fieldName, allowedTypes) => [
    (req, res, next) => {
        multerUpload.single(fieldName)(req, res, (err) => {
            if (err) {
                // MulterError (e.g. file too large) or our custom fileFilter error
                const status = err.status ?? (err.code === "LIMIT_FILE_SIZE" ? 413 : 400)
                const message = err.code === "LIMIT_FILE_SIZE"
                    ? "File exceeds the 10 MB size limit."
                    : err.message || "File upload failed."
                return res.status(status).json({ success: false, message })
            }
            next()
        })
    },
    async (req, res, next) => {
        if (!req.file) return next()
        try {
            await verifyFileMagicBytes(req.file.path, allowedTypes)
            next()
        } catch (err) {
            // Delete the rejected file immediately
            await rm(req.file.path, { force: true }).catch(() => {})
            return res.status(err.status ?? 415).json({ success: false, message: err.message })
        }
    }
]

export const createAgentRouter = () => {
    const router = express.Router()

    // Routes that accept file uploads
    router.post("/chat",   ...uploadFile("file", ["pdf", "image"]), createAgentHandler)
    router.post("/pdf",    ...uploadFile("file", ["pdf"]),          createAgentHandler)
    router.post("/vision", ...uploadFile("file", ["image"]),        createAgentHandler)

    // Text-only routes — no file upload needed
    router.post("/debug",  createAgentHandler)
    router.post("/coding", createAgentHandler)
    router.post("/search", createAgentHandler)
    router.post("/ppt",    createAgentHandler)

    return router
}

export default createAgentRouter()