import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Calendar, LogOut, User } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface SiteSettings {
  centreName: string;
  logoUrl?: string | null;
}

export default function Header() {
  const { user, isAuthenticated } = useAuth();
  
  const { data: settings } = useQuery<SiteSettings>({
    queryKey: ["/api/settings"],
    staleTime: 60000, // Cache for 1 minute
  });
  
  const centreName = settings?.centreName || "Community Centre";

  const getInitials = () => {
    if (!user?.firstName && !user?.lastName) return "U";
    return `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleLogin = () => {
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center gap-2 hover-elevate active-elevate-2 px-3 py-2 rounded-md cursor-pointer">
              {settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt={centreName} 
                  className="w-8 h-8 rounded-md object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
              <span className="font-semibold text-lg">{centreName}</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-2">
            <Link href="/rooms">
              <Button variant="ghost" data-testid="link-browse-rooms">
                Browse Rooms
              </Button>
            </Link>
            {isAuthenticated && (
              <Link href="/my-bookings">
                <Button variant="ghost" data-testid="link-my-bookings">
                  My Bookings
                </Button>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                  <Avatar className="w-8 h-8">
                    {user?.profileImageUrl && <AvatarImage src={user.profileImageUrl} />}
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">
                      {user?.firstName || user?.lastName
                        ? `${user?.firstName || ""} ${user?.lastName || ""}`.trim()
                        : "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/my-bookings">
                  <DropdownMenuItem data-testid="menu-my-bookings">
                    <Calendar className="w-4 h-4 mr-2" />
                    My Bookings
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem data-testid="menu-profile">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleLogin} data-testid="button-login">
              Log In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
