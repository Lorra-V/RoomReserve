import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import StatsCard from "@/components/StatsCard";
import BookingTable from "@/components/BookingTable";
import AdminCreateBookingDialog from "@/components/AdminCreateBookingDialog";
import AdminBookingCalendar from "@/components/AdminBookingCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, CheckCircle, Clock, TrendingUp, Plus, Search, Download, Upload } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";
import type { BookingWithMeta, Room } from "@shared/schema";
import { useRef } from "react";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<BookingWithMeta[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/bookings/${id}/status`, { status: "approved" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking approved",
        description: "The booking has been approved successfully.",
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
          description: "You do not have permission to approve bookings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to approve booking. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/bookings/${id}/status`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking rejected",
        description: "The booking has been cancelled.",
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

  // Filter bookings by search query
  const filterBookings = useMemo(() => {
    return (bookingList: BookingWithMeta[]) => {
      if (!searchQuery.trim()) return bookingList;

      const query = searchQuery.toLowerCase().trim();
      return bookingList.filter((booking) => {
        const userName = (booking.userName || "").toLowerCase();
        const roomName = (booking.roomName || "").toLowerCase();
        const eventName = (booking.eventName || "").toLowerCase();
        const purpose = (booking.purpose || "").toLowerCase();
        const dateStr = booking.date ? format(new Date(booking.date), "MMM dd, yyyy").toLowerCase() : "";
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
    };
  }, [searchQuery]);

  const pendingBookings = useMemo(() => {
    const filtered = bookings.filter((b) => b.status === "pending");
    return filterBookings(filtered);
  }, [bookings, filterBookings]);

  const approvedBookings = useMemo(() => {
    const filtered = bookings.filter((b) => b.status === "approved");
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
    
    const approvedBookings = bookings.filter((b) => b.status === "approved").length;
    const utilizationRate = totalBookings > 0 
      ? Math.round((approvedBookings / (rooms.length * 100)) * 100)
      : 0;

    return {
      totalBookings,
      pendingCount,
      activeRooms,
      utilizationRate,
    };
  }, [bookings, rooms, pendingBookings]);

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id);
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
      booking.date ? format(new Date(booking.date), "yyyy-MM-dd") : "",
      booking.startTime || "",
      booking.endTime || "",
      booking.status || "",
      booking.eventName || "",
      booking.purpose || "",
      booking.attendees?.toString() || "",
      booking.visibility || "private",
      booking.createdAt ? format(new Date(booking.createdAt), "yyyy-MM-dd HH:mm") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bookings_${format(new Date(), "yyyy-MM-dd")}.csv`);
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
            <TabsTrigger value="approved" data-testid="tab-approved">
              Approved ({bookings.filter((b) => b.status === "approved").length})
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
          <AdminBookingCalendar bookings={bookings} rooms={rooms} />
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          <div className="mb-4">
            <div className="relative">
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
          </div>
          <BookingTable
            bookings={pendingBookings}
            showActions
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>
        
        <TabsContent value="approved" className="space-y-4">
          <div className="mb-4">
            <div className="relative">
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
          </div>
          <BookingTable bookings={approvedBookings} />
        </TabsContent>
        
        <TabsContent value="cancelled" className="space-y-4">
          <div className="mb-4">
            <div className="relative">
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
          </div>
          <BookingTable bookings={cancelledBookings} />
        </TabsContent>
        
        <TabsContent value="all" className="space-y-4">
          <div className="mb-4">
            <div className="relative">
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
          </div>
          <BookingTable bookings={allBookingsFiltered} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
