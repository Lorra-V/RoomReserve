import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX } from "lucide-react";
import Header from "@/components/Header";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import BrowseRooms from "@/pages/BrowseRooms";
import RoomCalendarPage from "@/pages/RoomCalendarPage";
import UserDashboard from "@/pages/UserDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminRooms from "@/pages/AdminRooms";
import AdminSettings from "@/pages/AdminSettings";

function AccessDenied() {
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
            <Button onClick={() => window.location.href = "/api/logout"} data-testid="button-logout">
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
      <Header />
      <main className="flex-1">
        <Switch>
          <Route path="/rooms" component={BrowseRooms} />
          <Route path="/room/:id" component={RoomCalendarPage} />
          <Route path="/my-bookings" component={UserDashboard} />
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
      <Route>
        {() => (
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              <Switch>
                <Route path="/rooms" component={BrowseRooms} />
                <Route path="/room/:id" component={RoomCalendarPage} />
                <Route path="/" component={BrowseRooms} />
                <Route path="/login" component={LoginPage} />
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PublicRouter />;
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/admin/login">
        {() => {
          if (user?.isAdmin) {
            window.location.href = "/admin";
            return null;
          }
          return <AdminLoginPage />;
        }}
      </Route>
      <Route path="/admin/:rest*">
        {() => user?.isAdmin ? <AdminRouter /> : <AccessDenied />}
      </Route>
      <Route path="/admin">
        {() => user?.isAdmin ? <AdminRouter /> : <AccessDenied />}
      </Route>
      <Route path="*" component={UserRouter} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
