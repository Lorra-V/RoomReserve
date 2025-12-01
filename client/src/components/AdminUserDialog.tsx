import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

interface AdminUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
}

const PERMISSIONS = [
  { key: "manageBookings", label: "Manage Bookings" },
  { key: "manageRooms", label: "Manage Rooms" },
  { key: "manageCustomers", label: "Manage Customers" },
  { key: "manageAdmins", label: "Manage Admins" },
  { key: "manageSettings", label: "Manage Settings" },
  { key: "viewReports", label: "View Reports" },
] as const;

export default function AdminUserDialog({
  open,
  onOpenChange,
  user,
}: AdminUserDialogProps) {
  const { toast } = useToast();
  const isEditing = !!user;

  const [email, setEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    manageBookings: false,
    manageRooms: false,
    manageCustomers: false,
    manageAdmins: false,
    manageSettings: false,
    viewReports: false,
  });

  useEffect(() => {
    if (open) {
      if (user) {
        setEmail(user.email || "");
        setIsSuperAdmin(user.isSuperAdmin || false);
        setIsAdmin(user.isAdmin || false);
        setPermissions((user.permissions as Record<string, boolean>) || {
          manageBookings: false,
          manageRooms: false,
          manageCustomers: false,
          manageAdmins: false,
          manageSettings: false,
          viewReports: false,
        });
      } else {
        setEmail("");
        setIsSuperAdmin(false);
        setIsAdmin(true);
        setPermissions({
          manageBookings: false,
          manageRooms: false,
          manageCustomers: false,
          manageAdmins: false,
          manageSettings: false,
          viewReports: false,
        });
      }
    }
  }, [open, user]);

  const handlePermissionChange = (key: string, value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const createAdminMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      isAdmin: boolean;
      isSuperAdmin: boolean;
      permissions: Record<string, boolean> | null;
    }) => {
      const response = await apiRequest("POST", "/api/admin/admins", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({
        title: "Admin created",
        description: "The admin user has been created successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create admin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAdminMutation = useMutation({
    mutationFn: async (data: {
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
      permissions?: Record<string, boolean> | null;
    }) => {
      const response = await apiRequest("PATCH", `/api/admin/admins/${user?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({
        title: "Admin updated",
        description: "The admin user has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update admin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isEditing && !email) {
      toast({
        title: "Validation error",
        description: "Email is required to add an admin.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      ...(isEditing ? {} : { email }),
      isAdmin,
      isSuperAdmin,
      permissions: isSuperAdmin ? null : permissions,
    };

    if (isEditing) {
      updateAdminMutation.mutate(data);
    } else {
      createAdminMutation.mutate(data as any);
    }
  };

  const isLoading = createAdminMutation.isPending || updateAdminMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Admin User" : "Add Admin User"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update admin user permissions and role."
              : "Add a new admin user by email. They must already have an account."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-admin-email"
                />
                <p className="text-xs text-muted-foreground">
                  The user must already have an account with this email address.
                </p>
              </div>
            )}

            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isSuperAdmin">Super Admin</Label>
                  <p className="text-xs text-muted-foreground">
                    Super admins have all permissions and can manage other admins.
                  </p>
                </div>
                <Switch
                  id="isSuperAdmin"
                  checked={isSuperAdmin}
                  onCheckedChange={(checked) => {
                    setIsSuperAdmin(checked);
                    if (checked) {
                      setIsAdmin(true);
                    }
                  }}
                  disabled={isLoading}
                  data-testid="switch-super-admin"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isAdmin">Admin</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable admin access for this user.
                  </p>
                </div>
                <Switch
                  id="isAdmin"
                  checked={isAdmin}
                  onCheckedChange={(checked) => {
                    setIsAdmin(checked);
                    if (!checked) {
                      setIsSuperAdmin(false);
                    }
                  }}
                  disabled={isLoading || isSuperAdmin}
                  data-testid="switch-admin"
                />
              </div>
            </div>

            {!isSuperAdmin && (
              <div className="space-y-3 border rounded-lg p-4">
                <Label>Permissions</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Select specific permissions for this admin user.
                </p>
                <div className="space-y-2">
                  {PERMISSIONS.map((permission) => (
                    <div key={permission.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={permission.key}
                        checked={permissions[permission.key] || false}
                        onCheckedChange={(checked) =>
                          handlePermissionChange(permission.key, checked === true)
                        }
                        disabled={isLoading}
                        data-testid={`checkbox-permission-${permission.key}`}
                      />
                      <Label
                        htmlFor={permission.key}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {permission.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || (!isEditing && !email) || (!isSuperAdmin && !isAdmin)}
              data-testid="button-submit"
            >
              {isLoading
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                ? "Update Admin"
                : "Add Admin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

