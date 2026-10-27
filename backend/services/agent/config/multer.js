import fs from "fs"
import path from "path"
import multer from "multer"
import { readFile } from "node:fs/promises"

const uploadDir = path.resolve("./temp")

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir)
    },
    filename(req, file, cb) {
        // Sanitize original name to prevent path traversal
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")
        cb(null, `${Date.now()}-${safeName}`)
    }
})

// First-pass filter using the browser-provided MIME type.
// A second check using magic bytes is done after the file is written to disk.
const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === "application/pdf" ||
        file.mimetype.startsWith("image/")
    ) {
        cb(null, true)
    } else {
        const err = new Error("Only PDF and image files are allowed.")
        err.status = 415
        cb(err)
    }
}

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB — reduced from 50 MB
    }
})

/**
 * Verify a file's true type using its magic bytes (not the browser MIME).
 * Call this after multer has saved the file to disk.
 * Throws with status 415 if the file does not match an allowed type.
 */
export async function verifyFileMagicBytes(filePath, allowedTypes = ["pdf", "image"]) {
    const buffer = await readFile(filePath, { length: 12, position: 0 })
        .catch(() => null)

    if (!buffer) return // can't read → let downstream handle it

    const isPdf   = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 // %PDF
    const isPng   = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 // PNG
    const isJpeg  = buffer[0] === 0xFF && buffer[1] === 0xD8 // JFIF/EXIF
    const isWebp  = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50 // WEBP
    const isGif   = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 // GIF

    const allowPdf   = allowedTypes.includes("pdf")
    const allowImage = allowedTypes.includes("image")

    const valid =
        (allowPdf && isPdf) ||
        (allowImage && (isPng || isJpeg || isWebp || isGif))

    if (!valid) {
        const err = new Error("Uploaded file type does not match its content. Only PDF and image files are accepted.")
        err.status = 415
        throw err
    }
}