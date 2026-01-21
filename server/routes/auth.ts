import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { attachUser, logAuthContext, requireAuth } from "../middleware/auth";

const router = Router();

router.post("/sync-user", logAuthContext, requireAuth, async (req, res) => {
  try {
    const { clerkUserId, email, firstName, lastName } = req.body ?? {};
    const authUserId = req.auth?.userId;

    console.log("[Clerk Sync] Incoming request", {
      authUserId,
      clerkUserId,
      email,
      firstName,
      lastName,
    });

    if (!clerkUserId) {
      console.warn("[Clerk Sync] Missing clerkUserId", {
        authUserId,
        body: req.body,
      });
      return res.status(400).json({ message: "clerkUserId is required" });
    }

    if (authUserId && authUserId !== clerkUserId) {
      console.warn("[Clerk Sync] User mismatch", {
        authUserId,
        clerkUserId,
      });
      return res.status(403).json({ message: "User mismatch" });
    }

    const name = [firstName, lastName].filter(Boolean).join(" ").trim() || email || null;

    const [user] = await db
      .insert(users)
      .values({
        clerkUserId,
        email: email ?? null,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        name,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          email: email ?? null,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          name,
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("[Clerk Sync] User synced", {
      id: user?.id,
      clerkUserId: user?.clerkUserId,
      email: user?.email,
    });
    return res.json(user);
  } catch (error) {
    console.error("[Clerk Sync] Failed to sync user", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      authUserId: req.auth?.userId,
      body: req.body,
    });
    return res.status(500).json({ message: "Failed to sync user" });
  }
});

router.get("/me", requireAuth, attachUser, (req, res) => {
  res.json(req.user);
});

export default router;
