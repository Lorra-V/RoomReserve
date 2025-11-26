import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
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

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // User login route - redirects to user dashboard after login
  app.get("/api/login", (req: any, res, next) => {
    // Store the intent in session for redirect after callback
    req.session.loginIntent = "user";
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // Admin login route - redirects to admin dashboard after login
  app.get("/api/admin/login", (req: any, res, next) => {
    // Store the intent in session for redirect after callback
    req.session.loginIntent = "admin";
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // Single callback route - redirects based on login intent and actual admin status
  app.get("/api/callback", (req: any, res, next) => {
    ensureStrategy(req.hostname);
    
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any) => {
      if (err || !user) {
        console.log("[Auth Callback] Authentication failed:", err?.message || "No user");
        return res.redirect("/api/login");
      }
      
      req.logIn(user, async (loginErr: any) => {
        if (loginErr) {
          console.log("[Auth Callback] Login error:", loginErr?.message);
          return res.redirect("/api/login");
        }
        
        const loginIntent = req.session.loginIntent || "user";
        delete req.session.loginIntent;
        
        const userId = user.claims?.sub;
        console.log("[Auth Callback] User authenticated:", {
          userId,
          email: user.claims?.email,
          loginIntent,
        });
        
        if (loginIntent === "admin") {
          if (userId) {
            const dbUser = await storage.getUser(userId);
            console.log("[Auth Callback] Admin check:", {
              userId,
              dbUserFound: !!dbUser,
              isAdmin: dbUser?.isAdmin,
            });
            if (dbUser?.isAdmin) {
              // Save session before redirect to ensure isAdmin is available
              req.session.save((saveErr: any) => {
                if (saveErr) {
                  console.log("[Auth Callback] Session save error:", saveErr?.message);
                }
                console.log("[Auth Callback] Redirecting to /admin");
                return res.redirect("/admin");
              });
              return;
            }
          }
          console.log("[Auth Callback] Admin login failed - redirecting to /my-bookings");
          return res.redirect("/my-bookings");
        }
        
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
