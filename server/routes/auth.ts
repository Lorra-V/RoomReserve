import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
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

    // Link existing user by email if they have no clerkUserId (e.g. admin-assigned users
    // who were created before signing in). This preserves isAdmin, organizationId, etc.
    if (email) {
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), isNull(users.clerkUserId)))
        .limit(1);

      if (existingByEmail) {
        const [updated] = await db
          .update(users)
          .set({
            clerkUserId,
            email: email ?? null,
            firstName: firstName ?? null,
            lastName: lastName ?? null,
            name,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id))
          .returning();

        console.log("[Clerk Sync] Linked existing user by email", {
          id: updated?.id,
          clerkUserId: updated?.clerkUserId,
          email: updated?.email,
          isAdmin: updated?.isAdmin,
        });
        return res.json(updated);
      }
    }

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
