import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "BPA-";
  for (let i = 0; i < 28; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

router.post("/keys/request", async (req, res) => {
  try {
    const { label, email, intendedUse } = req.body as {
      label?: string;
      email?: string;
      intendedUse?: string;
    };

    if (!label?.trim() || !email?.trim() || !intendedUse?.trim()) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "All fields are required." });
      return;
    }

    const key = generateKey();

    await db.insert(apiKeysTable).values({
      key,
      label: label.trim(),
      email: email.trim(),
      intendedUse: intendedUse.trim(),
      isActive: true,
      requestCount: 0,
      dailyCount: 0,
    });

    logger.info({ email, label }, "New API key issued");

    res.json({ success: true, key });
  } catch (err) {
    logger.error({ err }, "POST /api/keys/request failed");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Key generation failed." });
  }
});

export default router;
