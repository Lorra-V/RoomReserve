import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import StatsCard from "@/components/StatsCard";
import BookingTable from "@/components/BookingTable";
import AdminCreateBookingDialog from "@/components/AdminCreateBookingDialog";
import AdminBookingCalendar from "@/components/AdminBookingCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CheckCircle, Clock, TrendingUp, Plus, Search, Download, Upload } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";
import type { BookingWithMeta, Room } from "@shared/schema";
import { useRef } from "react";
import { useFormattedDate } from "@/hooks/useFormattedDate";

type SortOption = "date-asc" | "date-desc" | "created-asc" | "created-desc";

export default function AdminDashboard() {
  const formatDate = useFormattedDate();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("date-asc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<BookingWithMeta[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, updateGroup }: { id: string; updateGroup?: boolean }) => {
      const response = await apiRequest("PATCH", `/api/bookings/${id}/status`, { 
        status: "confirmed",
        updateGroup: updateGroup || false
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      const isGroup = data?.isGroup || data?.count > 1;
      toast({
        title: isGroup ? `${data.count} Bookings confirmed` : "Booking confirmed",
        description: isGroup 
          ? `All ${data.count} bookings in the group have been confirmed.`
          : "The booking has been confirmed successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to continue.",
          variant: "destructive",
        });
      } else if (error.message.includes("403")) {
        toast({
          title: "Forbidden",
          description: "You do not have permission to confirm bookings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to confirm booking. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, updateGroup }: { id: string; updateGroup?: boolean }) => {
      const response = await apiRequest("PATCH", `/api/bookings/${id}/status`, { 
        status: "cancelled",
        updateGroup: updateGroup || false
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      const isGroup = data?.isGroup || data?.count > 1;
      toast({
        title: isGroup ? `${data.count} Bookings cancelled` : "Booking rejected",
        description: isGroup
          ? `All ${data.count} bookings in the group have been cancelled.`
          : "The booking has been cancelled.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to continue.",
          variant: "destructive",
        });
      } else if (error.message.includes("403")) {
        toast({
          title: "Forbidden",
          description: "You do not have permission to reject bookings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to reject booking. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/bookings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking deleted",
        description: "The booking has been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to continue.",
          variant: "destructive",
        });
      } else if (error.message.includes("403")) {
        toast({
          title: "Forbidden",
          description: "You do not have permission to delete bookings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete booking. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Filter and sort bookings
  const filterAndSortBookings = useMemo(() => {
    return (bookingList: BookingWithMeta[]) => {
      // Filter by search query
      let filtered = bookingList;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = bookingList.filter((booking) => {
          const userName = (booking.userName || "").toLowerCase();
          const roomName = (booking.roomName || "").toLowerCase();
          const eventName = (booking.eventName || "").toLowerCase();
          const purpose = (booking.purpose || "").toLowerCase();
          const dateStr = booking.date ? formatDate(booking.date) : "";
          const timeStr = `${booking.startTime || ""} ${booking.endTime || ""}`.toLowerCase();
          const status = (booking.status || "").toLowerCase();

          return (
            userName.includes(query) ||
            roomName.includes(query) ||
            eventName.includes(query) ||
            purpose.includes(query) ||
            dateStr.includes(query) ||
            timeStr.includes(query) ||
            status.includes(query)
          );
        });
      }

      // Sort bookings
      const sorted = [...filtered].sort((a, b) => {
        if (sortOption === "date-asc") {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return a.startTime.localeCompare(b.startTime);
        } else if (sortOption === "date-desc") {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) return dateB - dateA;
          return b.startTime.localeCompare(a.startTime);
        } else if (sortOption === "created-asc") {
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return createdA - createdB;
        } else if (sortOption === "created-desc") {
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return createdB - createdA;
        }
        return 0;
      });

      return sorted;
    };
  }, [searchQuery, formatDate, sortOption]);

  // Legacy filterBookings for backwards compatibility (now includes sorting)
  const filterBookings = filterAndSortBookings;

  const pendingBookings = useMemo(() => {
    const filtered = bookings.filter((b) => b.status === "pending");
    return filterBookings(filtered);
  }, [bookings, filterBookings]);

  const confirmedBookings = useMemo(() => {
    const filtered = bookings.filter((b) => b.status === "confirmed");
    return filterBookings(filtered);
  }, [bookings, filterBookings]);

  const cancelledBookings = useMemo(() => {
    const filtered = bookings.filter((b) => b.status === "cancelled");
    return filterBookings(filtered);
  }, [bookings, filterBookings]);

  const allBookingsFiltered = useMemo(() => {
    return filterBookings(bookings);
  }, [bookings, filterBookings]);

  const stats = useMemo(() => {
    const activeRooms = rooms.filter((r) => r.isActive).length;
    const totalBookings = bookings.length;
    const pendingCount = pendingBookings.length;
    
    const confirmedBookings = bookings.filter((b) => b.status === "confirmed").length;
    const utilizationRate = totalBookings > 0 
      ? Math.round((confirmedBookings / (rooms.length * 100)) * 100)
      : 0;

    return {
      totalBookings,
      pendingCount,
      activeRooms,
      utilizationRate,
    };
  }, [bookings, rooms, pendingBookings]);

  const handleApprove = (id: string, updateGroup?: boolean) => {
    approveMutation.mutate({ id, updateGroup });
  };

  const handleReject = (id: string, updateGroup?: boolean) => {
    rejectMutation.mutate({ id, updateGroup });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to permanently delete this booking? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  // Bulk action handlers
  const handleBulkApprove = async (ids: string[]) => {
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      try {
        await apiRequest("PATCH", `/api/bookings/${id}/status`, { status: "confirmed", updateGroup: false });
        successCount++;
      } catch (error) {
        console.error(`Failed to approve booking ${id}:`, error);
        errorCount++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    
    if (successCount > 0) {
      toast({
        title: `${successCount} booking${successCount > 1 ? 's' : ''} confirmed`,
        description: errorCount > 0 ? `${errorCount} failed` : undefined,
      });
    }
    if (errorCount > 0 && successCount === 0) {
      toast({
        title: "Error",
        description: "Failed to confirm bookings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBulkReject = async (ids: string[]) => {
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      try {
        await apiRequest("PATCH", `/api/bookings/${id}/status`, { status: "cancelled", updateGroup: false });
        successCount++;
      } catch (error) {
        console.error(`Failed to cancel booking ${id}:`, error);
        errorCount++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    
    if (successCount > 0) {
      toast({
        title: `${successCount} booking${successCount > 1 ? 's' : ''} cancelled`,
        description: errorCount > 0 ? `${errorCount} failed` : undefined,
      });
    }
    if (errorCount > 0 && successCount === 0) {
      toast({
        title: "Error",
        description: "Failed to cancel bookings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      try {
        await apiRequest("DELETE", `/api/admin/bookings/${id}`);
        successCount++;
      } catch (error) {
        console.error(`Failed to delete booking ${id}:`, error);
        errorCount++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    
    if (successCount > 0) {
      toast({
        title: `${successCount} booking${successCount > 1 ? 's' : ''} deleted`,
        description: errorCount > 0 ? `${errorCount} failed` : undefined,
      });
    }
    if (errorCount > 0 && successCount === 0) {
      toast({
        title: "Error",
        description: "Failed to delete bookings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportBookingsToCSV = () => {
    const headers = [
      "ID",
      "Customer Name",
      "Email",
      "Room Name",
      "Date",
      "Start Time",
      "End Time",
      "Status",
      "Event Name",
      "Purpose",
      "Attendees",
      "Visibility",
      "Created At",
    ];
    
    const rows = bookings.map((booking) => [
      booking.id || "",
      booking.userName || "",
      booking.userEmail || "",
      booking.roomName || "",
      booking.date ? formatDisplayDate(booking.date) : "",
      booking.startTime || "",
      booking.endTime || "",
      booking.status || "",
      booking.eventName || "",
      booking.purpose || "",
      booking.attendees?.toString() || "",
      booking.visibility || "private",
      booking.createdAt ? format(new Date(booking.createdAt), "dd-MMM-yyyy HH:mm") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bookings_${formatDate(new Date())}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export successful",
      description: `Exported ${bookings.length} bookings to CSV`,
    });
  };

  const importBookingsMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/bookings/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to import bookings");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Import successful",
        description: `Imported ${data.created || 0} bookings successfully${data.errors && data.errors.length > 0 ? ` (${data.errors.length} errors)` : ""}`,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import bookings",
        variant: "destructive",
      });
    },
  });

  const handleImportBookings = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    
    importBookingsMutation.mutate(file);
  };

  const isLoading = bookingsLoading || roomsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of room bookings and activity</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-booking">
            <Plus className="w-4 h-4 mr-2" />
            Create Booking
          </Button>
          <Button onClick={exportBookingsToCSV} disabled={bookings.length === 0} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportBookings}
            style={{ display: "none" }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={importBookingsMutation.isPending}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importBookingsMutation.isPending ? "Importing..." : "Import CSV"}
          </Button>
        </div>
      </div>

      <AdminCreateBookingDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Bookings"
          value={stats.totalBookings.toString()}
          icon={Calendar}
          description="All time bookings"
        />
        <StatsCard
          title="Pending Approvals"
          value={stats.pendingCount}
          icon={Clock}
          description="Requires review"
        />
        <StatsCard
          title="Active Rooms"
          value={stats.activeRooms.toString()}
          icon={CheckCircle}
          description="Currently available"
        />
        <StatsCard
          title="Utilization Rate"
          value={`${stats.utilizationRate}%`}
          icon={TrendingUp}
          description="This month"
        />
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="calendar" data-testid="tab-calendar">
              Calendar
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending ({bookings.filter((b) => b.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="confirmed" data-testid="tab-confirmed">
              Confirmed ({bookings.filter((b) => b.status === "confirmed").length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled">
              Cancelled ({bookings.filter((b) => b.status === "cancelled").length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">
              All Bookings
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="calendar" className="space-y-4">
          <AdminBookingCalendar 
            bookings={bookings} 
            rooms={rooms}
            onApprove={handleApprove}
            onReject={handleReject}
            onCreateBooking={() => setShowCreateDialog(true)}
          />
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by customer, room, date, time, event, or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-bookings"
              />
            </div>
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                <SelectItem value="created-asc">Created (Oldest First)</SelectItem>
                <SelectItem value="created-desc">Created (Newest First)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <BookingTable
            bookings={pendingBookings}
            showActions
            showBulkActions
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
            onBulkApprove={handleBulkApprove}
            onBulkReject={handleBulkReject}
            onBulkDelete={handleBulkDelete}
          />
        </TabsContent>
        
        <TabsContent value="confirmed" className="space-y-4">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by customer, room, date, time, event, or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-bookings"
              />
            </div>
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                <SelectItem value="created-asc">Created (Oldest First)</SelectItem>
                <SelectItem value="created-desc">Created (Newest First)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <BookingTable bookings={confirmedBookings} showBulkActions onDelete={handleDelete} onBulkDelete={handleBulkDelete} />
        </TabsContent>
        
        <TabsContent value="cancelled" className="space-y-4">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by customer, room, date, time, event, or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-bookings"
              />
            </div>
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                <SelectItem value="created-asc">Created (Oldest First)</SelectItem>
                <SelectItem value="created-desc">Created (Newest First)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <BookingTable bookings={cancelledBookings} showBulkActions onDelete={handleDelete} onBulkDelete={handleBulkDelete} />
        </TabsContent>
        
        <TabsContent value="all" className="space-y-4">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by customer, room, date, time, event, or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-bookings"
              />
            </div>
            <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                <SelectItem value="created-asc">Created (Oldest First)</SelectItem>
                <SelectItem value="created-desc">Created (Newest First)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <BookingTable bookings={allBookingsFiltered} showBulkActions onDelete={handleDelete} onBulkDelete={handleBulkDelete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
