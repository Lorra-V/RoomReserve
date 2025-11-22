import StatsCard from "@/components/StatsCard";
import BookingTable from "@/components/BookingTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CheckCircle, Clock, TrendingUp } from "lucide-react";

const mockAllBookings = [
  {
    id: "1",
    date: new Date(2025, 11, 25),
    time: "10:00 AM - 11:30 AM",
    room: "Meeting Room A",
    user: "John Doe",
    status: "pending" as const,
  },
  {
    id: "2",
    date: new Date(2025, 11, 26),
    time: "02:00 PM - 03:00 PM",
    room: "Multipurpose Hall",
    user: "Jane Smith",
    status: "approved" as const,
  },
  {
    id: "3",
    date: new Date(2025, 11, 27),
    time: "09:00 AM - 10:00 AM",
    room: "Study Room",
    user: "Bob Johnson",
    status: "pending" as const,
  },
  {
    id: "4",
    date: new Date(2025, 11, 28),
    time: "03:00 PM - 05:00 PM",
    room: "Workshop Space",
    user: "Alice Williams",
    status: "approved" as const,
  },
];

const mockPendingBookings = mockAllBookings.filter(b => b.status === "pending");

export default function AdminDashboard() {
  const handleApprove = (id: string) => {
    console.log('Approve booking:', id);
  };

  const handleReject = (id: string) => {
    console.log('Reject booking:', id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of room bookings and activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Bookings"
          value="142"
          icon={Calendar}
          description="All time bookings"
        />
        <StatsCard
          title="Pending Approvals"
          value={mockPendingBookings.length}
          icon={Clock}
          description="Requires review"
        />
        <StatsCard
          title="Active Rooms"
          value="12"
          icon={CheckCircle}
          description="Currently available"
        />
        <StatsCard
          title="Utilization Rate"
          value="67%"
          icon={TrendingUp}
          description="This month"
        />
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending Approvals ({mockPendingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            All Bookings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="space-y-4">
          <BookingTable
            bookings={mockPendingBookings}
            showActions
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>
        
        <TabsContent value="all" className="space-y-4">
          <BookingTable bookings={mockAllBookings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
