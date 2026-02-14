import { SignedIn, SignedOut, UserButton, useClerk } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "./ThemeToggle";

interface SiteSettings {
  centreName: string;
  logoUrl?: string | null;
}

export default function Header() {
  const { redirectToSignIn } = useClerk();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [location] = useLocation();
  const { data: settings } = useQuery<SiteSettings>({
    queryKey: ["/api/settings"],
    staleTime: 60000, // Cache for 1 minute
  });
  
  const centreName = settings?.centreName || "Community Centre";
  const isAdminUser = isAdmin || isSuperAdmin;
  const dashboardHref = isAdminUser ? "/admin" : "/";
  const bookingsHref = isAdminUser ? "/admin/bookings" : "/bookings";
  const roomsHref = isAdminUser ? "/admin/rooms" : "/rooms";
  const settingsHref = isAdminUser ? "/admin/settings" : "/settings";
  const isPricingPage = location === "/pricing";

  const logoUrl = isPricingPage ? "/logo.png" : settings?.logoUrl;
  const brandName = isPricingPage ? "RoomReservePro" : centreName;

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center gap-2 hover-elevate active-elevate-2 px-3 py-2 rounded-md cursor-pointer">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={brandName} 
                  className={isPricingPage ? "h-8 w-auto object-contain" : "w-8 h-8 rounded-md object-cover"}
                />
              ) : (
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
              <span className="font-semibold text-lg">{brandName}</span>
            </div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-2">
          <Link href={dashboardHref}>
            <Button variant="ghost" data-testid="link-dashboard">
              Dashboard
            </Button>
          </Link>
          <Link href={bookingsHref}>
            <Button variant="ghost" data-testid="link-bookings">
              Bookings
            </Button>
          </Link>
          <Link href={roomsHref}>
            <Button variant="ghost" data-testid="link-rooms">
              Rooms
            </Button>
          </Link>
          <Link href={settingsHref}>
            <Button variant="ghost" data-testid="link-settings">
              Settings
            </Button>
          </Link>
          <SignedIn>
            <Link href="/pricing">
              <Button
                className="bg-[#F59E0B] text-white border-[#F59E0B] hover:bg-[#D97706] hover:border-[#D97706]"
                data-testid="button-upgrade"
              >
                Upgrade
              </Button>
            </Link>
          </SignedIn>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignedOut>
            <Button
              variant="outline"
              onClick={() => redirectToSignIn({ redirectUrl: window.location.href })}
              data-testid="button-sign-in"
            >
              Sign In
            </Button>
          </SignedOut>
          <SignedIn>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9",
                },
              }}
            />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
