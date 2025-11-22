import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import Header from "@/components/Header";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import BrowseRooms from "@/pages/BrowseRooms";
import RoomCalendarPage from "@/pages/RoomCalendarPage";
import UserDashboard from "@/pages/UserDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminRooms from "@/pages/AdminRooms";

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
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const isLoggedIn = true;
  const isAdmin = false;

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      {isLoggedIn ? (
        isAdmin ? (
          <Route path="/admin*" component={AdminRouter} />
        ) : (
          <Route path="*" component={UserRouter} />
        )
      ) : (
        <Route component={LoginPage} />
      )}
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
