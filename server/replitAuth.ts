import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import cookieParser from "cookie-parser";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain and callback type
  const ensureStrategy = (domain: string, callbackPath: string = "/api/callback") => {
    const strategyName = `replitauth:${domain}:${callbackPath}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}${callbackPath}`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
    return strategyName;
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // User login route - redirects to user dashboard after login
  app.get("/api/login", (req: any, res, next) => {
    const strategyName = ensureStrategy(req.hostname, "/api/callback");
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // Admin login route - uses separate callback URL for admin
  app.get("/api/admin/login", (req: any, res, next) => {
    console.log("[Admin Login] Redirecting to admin callback");
    const strategyName = ensureStrategy(req.hostname, "/api/admin/callback");
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // User callback route - always redirects to my-bookings
  app.get("/api/callback", (req: any, res, next) => {
    console.log("[User Callback] Processing user login callback");
    const strategyName = ensureStrategy(req.hostname, "/api/callback");
    
    passport.authenticate(strategyName, async (err: any, user: any) => {
      if (err || !user) {
        console.log("[User Callback] Authentication failed:", err?.message || "No user");
        return res.redirect("/api/login");
      }
      
      req.logIn(user, async (loginErr: any) => {
        if (loginErr) {
          console.log("[User Callback] Login error:", loginErr?.message);
          return res.redirect("/api/login");
        }
        
        console.log("[User Callback] User authenticated, redirecting to /my-bookings");
        return res.redirect("/my-bookings");
      });
    })(req, res, next);
  });

  // Admin callback route - checks admin status and redirects accordingly
  app.get("/api/admin/callback", (req: any, res, next) => {
    console.log("[Admin Callback] Processing admin login callback");
    const strategyName = ensureStrategy(req.hostname, "/api/admin/callback");
    
    passport.authenticate(strategyName, async (err: any, user: any) => {
      if (err || !user) {
        console.log("[Admin Callback] Authentication failed:", err?.message || "No user");
        return res.redirect("/api/admin/login");
      }
      
      req.logIn(user, async (loginErr: any) => {
        if (loginErr) {
          console.log("[Admin Callback] Login error:", loginErr?.message);
          return res.redirect("/api/admin/login");
        }
        
        const userId = user.claims?.sub;
        console.log("[Admin Callback] User authenticated:", {
          userId,
          email: user.claims?.email,
        });
        
        if (userId) {
          const dbUser = await storage.getUser(userId);
          console.log("[Admin Callback] Admin check:", {
            userId,
            dbUserFound: !!dbUser,
            isAdmin: dbUser?.isAdmin,
          });
          if (dbUser?.isAdmin) {
            console.log("[Admin Callback] Redirecting to /admin");
            return res.redirect("/admin");
          }
        }
        
        console.log("[Admin Callback] User is not admin, redirecting to /my-bookings");
        return res.redirect("/my-bookings");
      });
    })(req, res, next);
  });

  app.get("/api/logout", async (req, res) => {
    req.logout(async () => {
      try {
        const oidcConfig = await getOidcConfig();
        res.redirect(
          client.buildEndSessionUrl(oidcConfig, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      } catch (error) {
        // Fallback: just redirect to home if OIDC end session fails
        res.redirect("/");
      }
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
