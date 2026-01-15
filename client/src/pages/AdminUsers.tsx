import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Search, Edit, Trash2, Plus } from "lucide-react";
import AdminUserDialog from "@/components/AdminUserDialog";
import type { User } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useFormattedDate } from "@/hooks/useFormattedDate";

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const formatDate = useFormattedDate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { data: admins = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/admins"],
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (adminId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/admins/${adminId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({
        title: "Admin removed",
        description: "The admin has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove admin",
        description: error.message || "An error occurred while removing the admin",
        variant: "destructive",
      });
    },
  });

  const getInitials = (user: User) => {
    if (!user.firstName && !user.lastName) return "?";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  // Filter and sort admins
  const filteredAndSortedAdmins = useMemo(() => {
    let filtered = admins;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = admins.filter((admin) => {
        const firstName = (admin.firstName || "").toLowerCase();
        const lastName = (admin.lastName || "").toLowerCase();
        const email = (admin.email || "").toLowerCase();
        
        return (
          firstName.includes(query) ||
          lastName.includes(query) ||
          email.includes(query) ||
          `${firstName} ${lastName}`.trim().includes(query)
        );
      });
    }

    // Sort A to Z by first name
    return [...filtered].sort((a, b) => {
      const aFirstName = (a.firstName || "").toLowerCase();
      const bFirstName = (b.firstName || "").toLowerCase();
      
      if (aFirstName && bFirstName) {
        return aFirstName.localeCompare(bFirstName);
      }
      
      if (aFirstName && !bFirstName) return -1;
      if (!aFirstName && bFirstName) return 1;
      
      const aLastName = (a.lastName || "").toLowerCase();
      const bLastName = (b.lastName || "").toLowerCase();
      return aLastName.localeCompare(bLastName);
    });
  }, [admins, searchQuery]);

  const stats = useMemo(() => {
    const total = admins.length;
    const superAdmins = admins.filter((a) => a.isSuperAdmin).length;
    const regularAdmins = admins.filter((a) => a.isAdmin && !a.isSuperAdmin).length;
    return { total, superAdmins, regularAdmins };
  }, [admins]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="heading-admin-users">Admin Users</h1>
          <p className="text-muted-foreground">Manage admin users and their permissions</p>
        </div>
        <Button
          onClick={() => {
            setEditingUser(null);
            setShowUserDialog(true);
          }}
          data-testid="button-add-admin"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Admin
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-admins">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-super-admins">{stats.superAdmins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Regular Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-regular-admins">{stats.regularAdmins}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Admin Users List</CardTitle>
              <CardDescription>
                Manage admin users and configure their permissions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-admins"
              />
            </div>
          </div>
          {admins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No admin users yet</p>
              <p className="text-sm">Add an admin user to get started</p>
            </div>
          ) : filteredAndSortedAdmins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No admins found</p>
              <p className="text-sm">Try adjusting your search query</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedAdmins.map((admin) => (
                  <TableRow key={admin.id} data-testid={`row-admin-${admin.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          {admin.profileImageUrl && <AvatarImage src={admin.profileImageUrl} />}
                          <AvatarFallback className="text-xs">{getInitials(admin)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {admin.firstName || admin.lastName
                              ? `${admin.firstName || ""} ${admin.lastName || ""}`.trim()
                              : "No name"}
                          </p>
                          <p className="text-sm text-muted-foreground">{admin.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin.isSuperAdmin ? (
                        <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">
                          Super Admin
                        </Badge>
                      ) : (
                        <Badge variant="outline">Admin</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {admin.isSuperAdmin ? (
                        <span className="text-sm text-muted-foreground">All permissions</span>
                      ) : admin.permissions ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(admin.permissions as Record<string, boolean>)
                            .filter(([_, value]) => value)
                            .map(([key]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {key.replace(/([A-Z])/g, " $1").trim()}
                              </Badge>
                            ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No specific permissions</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {admin.createdAt ? formatDate(admin.createdAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingUser(admin);
                            setShowUserDialog(true);
                          }}
                          data-testid={`button-edit-admin-${admin.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {admin.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Are you sure you want to remove ${admin.firstName || admin.email} as an admin?`)) {
                                removeAdminMutation.mutate(admin.id);
                              }
                            }}
                            data-testid={`button-remove-admin-${admin.id}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AdminUserDialog
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
        user={editingUser}
      />
    </div>
  );
}

