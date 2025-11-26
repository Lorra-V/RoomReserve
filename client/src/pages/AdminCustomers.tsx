import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import type { User } from "@shared/schema";

export default function AdminCustomers() {
  const { data: customers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/customers"],
  });

  const exportToCSV = () => {
    const headers = ["First Name", "Last Name", "Email", "Phone", "Organization", "Profile Complete", "Created At"];
    const rows = customers.map((customer) => [
      customer.firstName || "",
      customer.lastName || "",
      customer.email || "",
      customer.phone || "",
      customer.organization || "",
      customer.profileComplete ? "Yes" : "No",
      customer.createdAt ? format(new Date(customer.createdAt), "yyyy-MM-dd HH:mm") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `customers_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getInitials = (customer: User) => {
    if (!customer.firstName && !customer.lastName) return "?";
    return `${customer.firstName?.[0] || ""}${customer.lastName?.[0] || ""}`.toUpperCase();
  };

  const stats = useMemo(() => {
    const total = customers.length;
    const withProfile = customers.filter((c) => c.profileComplete).length;
    const withOrg = customers.filter((c) => c.organization).length;
    return { total, withProfile, withOrg };
  }, [customers]);

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
          <h1 className="text-3xl font-semibold" data-testid="heading-customers">Customers</h1>
          <p className="text-muted-foreground">Manage your community centre customers</p>
        </div>
        <Button onClick={exportToCSV} disabled={customers.length === 0} data-testid="button-export-csv">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-customers">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Complete Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-complete-profiles">{stats.withProfile}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.withProfile / stats.total) * 100) : 0}% of customers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">With Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-with-org">{stats.withOrg}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>
            All registered customers who have signed up to book rooms
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No customers yet</p>
              <p className="text-sm">Customers will appear here after they sign up</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          {customer.profileImageUrl && <AvatarImage src={customer.profileImageUrl} />}
                          <AvatarFallback className="text-xs">{getInitials(customer)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {customer.firstName || customer.lastName
                              ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                              : "No name"}
                          </p>
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.phone || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {customer.organization || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {customer.profileComplete ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800">
                          Incomplete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.createdAt ? format(new Date(customer.createdAt), "MMM d, yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
