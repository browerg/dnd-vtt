import { Router } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { uploadsDir } from "./db.js";
import { requireAuth } from "./auth.js";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, `img-${randomBytes(10).toString("hex")}${IMAGE_TYPES[file.mimetype] ?? ".png"}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in IMAGE_TYPES),
});

// Generic authenticated image upload — returns a /uploads URL. Used for the
// personal table backdrop; kept simple (no cleanup — a private tool).
export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

uploadsRouter.post("/image", imageUpload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Attach a PNG, JPEG, or WebP image." });
  res.json({ url: `/uploads/${path.basename(req.file.path)}` });
});
