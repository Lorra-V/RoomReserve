import { useAuth as useClerkAuth, useClerk, useUser } from "@clerk/clerk-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { ShieldX } from "lucide-react";
import { Route, Switch } from "wouter";
import { AppSidebar } from "@/components/AppSidebar";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import AdminCustomers from "@/pages/AdminCustomers";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminItems from "@/pages/AdminItems";
import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminReports from "@/pages/AdminReports";
import AdminRooms from "@/pages/AdminRooms";
import AdminSettings from "@/pages/AdminSettings";
import AdminUsers from "@/pages/AdminUsers";
import BrowseRooms from "@/pages/BrowseRooms";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/not-found";
import PricingPage from "@/pages/PricingPage";
import ProfileCompletionPage from "@/pages/ProfileCompletionPage";
import ProfilePage from "@/pages/ProfilePage";
import RoomCalendarPage from "@/pages/RoomCalendarPage";
import SignupPage from "@/pages/SignupPage";
import UserDashboard from "@/pages/UserDashboard";
import { queryClient } from "./lib/queryClient";

function AccessDenied() {
  const { signOut } = useClerk();
  const handleSignOut = () => {
    void signOut().then(() => {
      window.location.href = "/";
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="w-6 h-6 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            You don't have admin privileges to access this area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Please log in with an admin account or contact your system administrator.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => window.location.href = "/my-bookings"} data-testid="button-go-home">
              Go to My Bookings
            </Button>
            <Button onClick={handleSignOut} data-testid="button-logout">
              Log Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRouter() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <Switch>
          <Route path="/rooms" component={BrowseRooms} />
          <Route path="/room/:id" component={RoomCalendarPage} />
          <Route path="/my-bookings" component={UserDashboard} />
          <Route path="/bookings" component={UserDashboard} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/settings" component={ProfilePage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/" component={BrowseRooms} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function AdminRouter() {
  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-40 flex items-center justify-between p-4 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/bookings" component={AdminDashboard} />
              <Route path="/admin/rooms" component={AdminRooms} />
              <Route path="/admin/items" component={AdminItems} />
              <Route path="/admin/customers" component={AdminCustomers} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route path="/admin/reports" component={AdminReports} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/:rest*" component={AdminLoginPage} />
      <Route path="/admin" component={AdminLoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route>
        {() => (
          <div className="min-h-screen flex flex-col">
            <main className="flex-1">
              <Switch>
                <Route path="/rooms" component={BrowseRooms} />
                <Route path="/room/:id" component={RoomCalendarPage} />
                <Route path="/pricing" component={PricingPage} />
                <Route path="/" component={BrowseRooms} />
                <Route path="/login" component={LoginPage} />
                <Route path="/bookings" component={LoginPage} />
                <Route path="/settings" component={LoginPage} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        )}
      </Route>
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Debug logging
  console.log("[Router] Auth state:", { isAuthenticated, isLoading, user: user ? { id: user.id, email: user.email, isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin } : null });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log("[Router] Not authenticated, showing PublicRouter");
    return <PublicRouter />;
  }

  // Check if regular user needs to complete their profile
  // Admins and super admins are exempt from profile completion requirement
  const isAdminOrSuperAdmin = user?.isAdmin || user?.isSuperAdmin;
  if (!isAdminOrSuperAdmin && !user?.profileComplete) {
    console.log("[Router] User needs to complete profile");
    return <ProfileCompletionPage user={user!} />;
  }

  console.log("[Router] Rendering authenticated routes, isAdminOrSuperAdmin:", isAdminOrSuperAdmin);

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/admin/login">
        {() => {
          if (isAdminOrSuperAdmin) {
            window.location.href = "/admin";
            return null;
          }
          return <AdminLoginPage />;
        }}
      </Route>
      <Route path="/admin/:rest*">
        {() => isAdminOrSuperAdmin ? <AdminRouter /> : <AccessDenied />}
      </Route>
      <Route path="/admin">
        {() => isAdminOrSuperAdmin ? <AdminRouter /> : <AccessDenied />}
      </Route>
      <Route path="*" component={UserRouter} />
    </Switch>
  );
}

function App() {
  const { getToken } = useClerkAuth();
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      return;
    }

    const syncUser = async () => {
      try {
        const token = await getToken();

        if (!token) {
          console.warn("No Clerk token available for sync-user request.");
          return;
        }

        await fetch("/api/auth/sync-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clerkUserId: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? null,
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
          }),
        });
      } catch (error) {
        console.error("Failed to sync Clerk user.", error);
      }
    };

    void syncUser();
  }, [getToken, isSignedIn, user]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Header />
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
