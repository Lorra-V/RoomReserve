import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import StatsCard from "@/components/StatsCard";
import BookingTable from "@/components/BookingTable";
import AdminCreateBookingDialog from "@/components/AdminCreateBookingDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, Clock, TrendingUp, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { BookingWithMeta, Room } from "@shared/schema";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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

  const pendingBookings = useMemo(() => {
    return bookings.filter((b) => b.status === "pending");
  }, [bookings]);

  const approvedBookings = useMemo(() => {
    return bookings.filter((b) => b.status === "approved");
  }, [bookings]);

  const cancelledBookings = useMemo(() => {
    return bookings.filter((b) => b.status === "cancelled");
  }, [bookings]);

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
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-booking">
          <Plus className="w-4 h-4 mr-2" />
          Create Booking
        </Button>
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

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved ({approvedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" data-testid="tab-cancelled">
            Cancelled ({cancelledBookings.length})
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            All Bookings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="space-y-4">
          <BookingTable
            bookings={pendingBookings}
            showActions
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>
        
        <TabsContent value="approved" className="space-y-4">
          <BookingTable bookings={approvedBookings} />
        </TabsContent>
        
        <TabsContent value="cancelled" className="space-y-4">
          <BookingTable bookings={cancelledBookings} />
        </TabsContent>
        
        <TabsContent value="all" className="space-y-4">
          <BookingTable bookings={bookings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
