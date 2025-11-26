import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Calendar, DollarSign, Loader2, TrendingUp, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfWeek, endOfWeek } from "date-fns";
import type { BookingWithMeta, Room, User } from "@shared/schema";

export default function AdminReports() {
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<BookingWithMeta[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/customers"],
  });

  const isLoading = bookingsLoading || roomsLoading || customersLoading;

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const stats = useMemo(() => {
    const thisMonthBookings = bookings.filter((b) => {
      const date = new Date(b.date);
      return isWithinInterval(date, { start: thisMonthStart, end: thisMonthEnd });
    });

    const thisWeekBookings = bookings.filter((b) => {
      const date = new Date(b.date);
      return isWithinInterval(date, { start: thisWeekStart, end: thisWeekEnd });
    });

    const approvedBookings = bookings.filter((b) => b.status === "approved");
    const pendingBookings = bookings.filter((b) => b.status === "pending");
    const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

    const roomStats = rooms.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomId === room.id);
      const approvedCount = roomBookings.filter((b) => b.status === "approved").length;
      return {
        ...room,
        totalBookings: roomBookings.length,
        approvedBookings: approvedCount,
        pendingBookings: roomBookings.filter((b) => b.status === "pending").length,
      };
    }).sort((a, b) => b.totalBookings - a.totalBookings);

    return {
      totalBookings: bookings.length,
      thisMonthBookings: thisMonthBookings.length,
      thisWeekBookings: thisWeekBookings.length,
      approvedBookings: approvedBookings.length,
      pendingBookings: pendingBookings.length,
      cancelledBookings: cancelledBookings.length,
      approvalRate: bookings.length > 0 
        ? Math.round((approvedBookings.length / bookings.length) * 100) 
        : 0,
      totalCustomers: customers.length,
      roomStats,
    };
  }, [bookings, rooms, customers, thisMonthStart, thisMonthEnd, thisWeekStart, thisWeekEnd]);

  const monthlyData = useMemo(() => {
    const months: { [key: string]: { total: number; approved: number; cancelled: number } } = {};
    
    bookings.forEach((booking) => {
      const monthKey = format(new Date(booking.date), "yyyy-MM");
      if (!months[monthKey]) {
        months[monthKey] = { total: 0, approved: 0, cancelled: 0 };
      }
      months[monthKey].total++;
      if (booking.status === "approved") months[monthKey].approved++;
      if (booking.status === "cancelled") months[monthKey].cancelled++;
    });

    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([month, data]) => ({
        month: format(parseISO(`${month}-01`), "MMM yyyy"),
        ...data,
      }));
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="heading-reports">Reports</h1>
        <p className="text-muted-foreground">View booking statistics and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-bookings">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-this-month">{stats.thisMonthBookings}</div>
            <p className="text-xs text-muted-foreground">{format(now, "MMMM yyyy")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-approval-rate">{stats.approvalRate}%</div>
            <p className="text-xs text-muted-foreground">{stats.approvedBookings} approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-customers">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Registered</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="rooms" data-testid="tab-rooms">By Room</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Booking Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Approved</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                    {stats.approvedBookings}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pending</span>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800">
                    {stats.pendingBookings}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cancelled</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                    {stats.cancelledBookings}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">This Week</CardTitle>
                <CardDescription>
                  {format(thisWeekStart, "MMM d")} - {format(thisWeekEnd, "MMM d, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.thisWeekBookings}</div>
                <p className="text-sm text-muted-foreground">bookings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Rooms</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{rooms.filter((r) => r.isActive).length}</div>
                <p className="text-sm text-muted-foreground">of {rooms.length} total</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rooms">
          <Card>
            <CardHeader>
              <CardTitle>Room Performance</CardTitle>
              <CardDescription>Booking statistics by room</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.roomStats.map((room) => (
                    <TableRow key={room.id} data-testid={`row-room-${room.id}`}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell className="text-right">{room.totalBookings}</TableCell>
                      <TableCell className="text-right">{room.approvedBookings}</TableCell>
                      <TableCell className="text-right">{room.pendingBookings}</TableCell>
                      <TableCell className="text-right">
                        {room.totalBookings > 0
                          ? `${Math.round((room.approvedBookings / room.totalBookings) * 100)}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {stats.roomStats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No rooms configured yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Summary</CardTitle>
              <CardDescription>Booking trends over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-right">Cancelled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((data) => (
                    <TableRow key={data.month} data-testid={`row-month-${data.month}`}>
                      <TableCell className="font-medium">{data.month}</TableCell>
                      <TableCell className="text-right">{data.total}</TableCell>
                      <TableCell className="text-right">{data.approved}</TableCell>
                      <TableCell className="text-right">{data.cancelled}</TableCell>
                    </TableRow>
                  ))}
                  {monthlyData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No booking data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
