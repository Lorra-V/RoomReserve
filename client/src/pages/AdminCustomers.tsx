import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Users, Search, Plus, Edit, Upload } from "lucide-react";
import { format } from "date-fns";
import AdminCustomerDialog from "@/components/AdminCustomerDialog";
import type { User } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminCustomers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export successful",
      description: `Exported ${customers.length} customers to CSV`,
    });
  };

  const importCustomersMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/customers/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to import customers");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({
        title: "Import successful",
        description: `Imported ${data.created || 0} customers successfully${data.errors && data.errors.length > 0 ? ` (${data.errors.length} errors)` : ""}`,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import customers",
        variant: "destructive",
      });
    },
  });

  const handleImportCustomers = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }
    
    importCustomersMutation.mutate(file);
  };

  const getInitials = (customer: User) => {
    if (!customer.firstName && !customer.lastName) return "?";
    return `${customer.firstName?.[0] || ""}${customer.lastName?.[0] || ""}`.toUpperCase();
  };

  // Filter and sort customers
  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = customers;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = customers.filter((customer) => {
        const firstName = (customer.firstName || "").toLowerCase();
        const lastName = (customer.lastName || "").toLowerCase();
        const email = (customer.email || "").toLowerCase();
        const phone = (customer.phone || "").toLowerCase();
        const organization = (customer.organization || "").toLowerCase();
        
        return (
          firstName.includes(query) ||
          lastName.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          organization.includes(query) ||
          `${firstName} ${lastName}`.trim().includes(query)
        );
      });
    }

    // Sort A to Z by first name
    return [...filtered].sort((a, b) => {
      const aFirstName = (a.firstName || "").toLowerCase();
      const bFirstName = (b.firstName || "").toLowerCase();
      
      // If both have first names, sort by first name
      if (aFirstName && bFirstName) {
        return aFirstName.localeCompare(bFirstName);
      }
      
      // If only one has a first name, prioritize it
      if (aFirstName && !bFirstName) return -1;
      if (!aFirstName && bFirstName) return 1;
      
      // If neither has first name, sort by last name
      const aLastName = (a.lastName || "").toLowerCase();
      const bLastName = (b.lastName || "").toLowerCase();
      return aLastName.localeCompare(bLastName);
    });
  }, [customers, searchQuery]);

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
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditingCustomer(null);
              setShowCustomerDialog(true);
            }}
            data-testid="button-create-customer"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Customer
          </Button>
          <Button onClick={exportToCSV} disabled={customers.length === 0} data-testid="button-export-csv" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCustomers}
            style={{ display: "none" }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={importCustomersMutation.isPending}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importCustomersMutation.isPending ? "Importing..." : "Import CSV"}
          </Button>
        </div>
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Customer List</CardTitle>
              <CardDescription>
                All registered customers who have signed up to book rooms
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
                placeholder="Search by name, email, phone, or organization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-customers"
              />
            </div>
          </div>
          {customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No customers yet</p>
              <p className="text-sm">Customers will appear here after they sign up</p>
            </div>
          ) : filteredAndSortedCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No customers found</p>
              <p className="text-sm">Try adjusting your search query</p>
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
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedCustomers.map((customer) => (
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCustomer(customer);
                          setShowCustomerDialog(true);
                        }}
                        data-testid={`button-edit-customer-${customer.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AdminCustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        customer={editingCustomer}
      />
    </div>
  );
}
