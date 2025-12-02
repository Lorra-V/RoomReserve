import { useState } from "react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { LayoutDashboard, Calendar, Building2, Package, Settings, LogOut, Users, BarChart3, Shield, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import AdminProfileDialog from "./AdminProfileDialog";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Bookings", url: "/admin/bookings", icon: Calendar },
  { title: "Rooms", url: "/admin/rooms", icon: Building2 },
  { title: "Items", url: "/admin/items", icon: Package },
  { title: "Customers", url: "/admin/customers", icon: Users },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

const superAdminItems = [
  { title: "Admin Users", url: "/admin/users", icon: Shield },
];

export function AppSidebar() {
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin || false;
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const getInitials = () => {
    if (!user) return "?";
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <h2 className="text-lg font-semibold">Admin Portal</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-testid={`link-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isSuperAdmin && superAdminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4 space-y-2">
        {/* Profile Section */}
        <div 
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
          onClick={() => setShowProfileDialog(true)}
          data-testid="button-profile"
        >
          <Avatar className="w-8 h-8">
            {user?.profileImageUrl && <AvatarImage src={user.profileImageUrl} />}
            <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || "Admin"}
            </p>
            <p className="text-xs text-muted-foreground">
              {user?.isSuperAdmin ? "Super Admin" : "Admin"}
            </p>
          </div>
          <UserIcon className="w-4 h-4 text-muted-foreground" />
        </div>

        <SidebarMenuButton 
          onClick={() => window.location.href = "/api/logout"}
          data-testid="button-logout"
        >
          <LogOut />
          <span>Logout</span>
        </SidebarMenuButton>
      </SidebarFooter>

      <AdminProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        user={user}
      />
    </Sidebar>
  );
}
