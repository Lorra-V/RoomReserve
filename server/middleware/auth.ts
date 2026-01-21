import type { NextFunction, Request, Response } from "express";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users, type User } from "@shared/schema";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
    auth?: {
      userId?: string | null;
    };
  }
}

export const requireAuth = ClerkExpressRequireAuth();

export const attachUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id varchar(255)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_unique ON users (clerk_user_id)`);

  console.log("[Clerk Auth] req.auth snapshot", req.auth);
  const clerkUserId = req.auth?.userId;

  if (!clerkUserId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  req.user = user;
  next();
};

export const logAuthContext = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;

  console.log("[Clerk Auth] Incoming auth headers", {
    hasAuthorization: Boolean(authHeader),
    authorizationScheme: authHeader?.split(" ")[0],
    hasCookie: Boolean(cookieHeader),
  });

  next();
};
