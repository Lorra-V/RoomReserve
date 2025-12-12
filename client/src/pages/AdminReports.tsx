import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Calendar, DollarSign, Loader2, TrendingUp, Users, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
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
  
  // Booking report state
  const [reportStartDate, setReportStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [reportStatusFilter, setReportStatusFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");
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

    const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
    const pendingBookings = bookings.filter((b) => b.status === "pending");
    const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

    const roomStats = rooms.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomId === room.id);
      const confirmedCount = roomBookings.filter((b) => b.status === "confirmed").length;
      return {
        ...room,
        totalBookings: roomBookings.length,
        confirmedBookings: confirmedCount,
        pendingBookings: roomBookings.filter((b) => b.status === "pending").length,
      };
    }).sort((a, b) => b.totalBookings - a.totalBookings);

    return {
      totalBookings: bookings.length,
      thisMonthBookings: thisMonthBookings.length,
      thisWeekBookings: thisWeekBookings.length,
      confirmedBookings: confirmedBookings.length,
      pendingBookings: pendingBookings.length,
      cancelledBookings: cancelledBookings.length,
      confirmationRate: bookings.length > 0 
        ? Math.round((confirmedBookings.length / bookings.length) * 100) 
        : 0,
      totalCustomers: customers.length,
      roomStats,
    };
  }, [bookings, rooms, customers, thisMonthStart, thisMonthEnd, thisWeekStart, thisWeekEnd]);

  const monthlyData = useMemo(() => {
    const months: { [key: string]: { total: number; confirmed: number; cancelled: number } } = {};
    
    // Helper function to parse date without timezone shift
    const parseDateLocal = (date: string | Date): Date => {
      if (date instanceof Date) return date;
      const dateStr = typeof date === 'string' ? date.split('T')[0] : String(date);
      return new Date(dateStr + 'T12:00:00');
    };
    
    bookings.forEach((booking) => {
      const monthKey = format(parseDateLocal(booking.date), "yyyy-MM");
      if (!months[monthKey]) {
        months[monthKey] = { total: 0, confirmed: 0, cancelled: 0 };
      }
      months[monthKey].total++;
      if (booking.status === "confirmed") months[monthKey].confirmed++;
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
            <CardTitle className="text-sm font-medium">Confirmation Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-confirmation-rate">{stats.confirmationRate}%</div>
            <p className="text-xs text-muted-foreground">{stats.confirmedBookings} confirmed</p>
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
          <TabsTrigger value="booking-report" data-testid="tab-booking-report">Booking Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Booking Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Confirmed</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                    {stats.confirmedBookings}
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
                    <TableHead className="text-right">Confirmed</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.roomStats.map((room) => (
                    <TableRow key={room.id} data-testid={`row-room-${room.id}`}>
                      <TableCell className="font-medium">{room.name}</TableCell>
                      <TableCell className="text-right">{room.totalBookings}</TableCell>
                      <TableCell className="text-right">{room.confirmedBookings}</TableCell>
                      <TableCell className="text-right">{room.pendingBookings}</TableCell>
                      <TableCell className="text-right">
                        {room.totalBookings > 0
                          ? `${Math.round((room.confirmedBookings / room.totalBookings) * 100)}%`
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
                    <TableHead className="text-right">Confirmed</TableHead>
                    <TableHead className="text-right">Cancelled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((data) => (
                    <TableRow key={data.month} data-testid={`row-month-${data.month}`}>
                      <TableCell className="font-medium">{data.month}</TableCell>
                      <TableCell className="text-right">{data.total}</TableCell>
                      <TableCell className="text-right">{data.confirmed}</TableCell>
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

        <TabsContent value="booking-report" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Booking Report</CardTitle>
              <CardDescription>Customizable booking report with date range selection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Range Selection and Status Filter */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    data-testid="input-report-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    data-testid="input-report-end-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Booking Status</Label>
                  <Select
                    value={reportStatusFilter}
                    onValueChange={(value) => setReportStatusFilter(value as "all" | "pending" | "confirmed" | "cancelled")}
                    data-testid="select-report-status"
                  >
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filtered Bookings */}
              {(() => {
                const startDate = startOfDay(new Date(reportStartDate));
                const endDate = endOfDay(new Date(reportEndDate));
                
                // Helper function to parse date without timezone shift
                const parseDateLocal = (date: string | Date): Date => {
                  if (date instanceof Date) return date;
                  const dateStr = typeof date === 'string' ? date.split('T')[0] : String(date);
                  return new Date(dateStr + 'T12:00:00');
                };
                
                const filteredBookings = bookings.filter((booking) => {
                  const bookingDate = parseDateLocal(booking.date);
                  const isInDateRange = isWithinInterval(bookingDate, { start: startDate, end: endDate });
                  const matchesStatus = reportStatusFilter === "all" || booking.status === reportStatusFilter;
                  return isInDateRange && matchesStatus;
                }).sort((a, b) => {
                  const dateA = parseDateLocal(a.date).getTime();
                  const dateB = parseDateLocal(b.date).getTime();
                  if (dateA !== dateB) return dateA - dateB;
                  return a.startTime.localeCompare(b.startTime);
                });

                const exportToCSV = () => {
                  const headers = [
                    "Date",
                    "Time",
                    "Customer Name",
                    "Event Name",
                    "Organization",
                    "Room",
                    "Status"
                  ];
                  
                  const rows = filteredBookings.map((booking) => [
                    format(parseDateLocal(booking.date), 'dd/MMM/yy'),
                    `${booking.startTime} - ${booking.endTime}`,
                    booking.userName || "—",
                    booking.eventName || "—",
                    booking.userOrganization || "—",
                    booking.roomName || "—",
                    booking.status.charAt(0).toUpperCase() + booking.status.slice(1),
                  ]);

                  const csvContent = [
                    headers.join(","),
                    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
                  ].join("\n");

                  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                  const link = document.createElement("a");
                  const url = URL.createObjectURL(blob);
                  link.setAttribute("href", url);
                  const statusSuffix = reportStatusFilter !== "all" ? `-${reportStatusFilter}` : "";
                  link.setAttribute("download", `booking-report-${reportStartDate}-to-${reportEndDate}${statusSuffix}.csv`);
                  link.style.visibility = "hidden";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                };

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''} 
                          {" "}from {format(startDate, 'dd/MMM/yy')} to {format(endDate, 'dd/MMM/yy')}
                          {reportStatusFilter !== "all" && ` (${reportStatusFilter})`}
                        </p>
                      </div>
                      <Button
                        onClick={exportToCSV}
                        disabled={filteredBookings.length === 0}
                        data-testid="button-export-report"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>

                    {filteredBookings.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No bookings found for the selected date range</p>
                      </div>
                    ) : (
                      <div className="border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead>Customer Name</TableHead>
                              <TableHead>Event Name</TableHead>
                              <TableHead>Organization</TableHead>
                              <TableHead>Room</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredBookings.map((booking) => (
                              <TableRow key={booking.id} data-testid={`row-report-booking-${booking.id}`}>
                                <TableCell className="font-mono text-sm">
                                  {format(parseDateLocal(booking.date), 'dd/MMM/yy')}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {booking.startTime} - {booking.endTime}
                                </TableCell>
                                <TableCell>{booking.userName || "—"}</TableCell>
                                <TableCell>{booking.eventName || "—"}</TableCell>
                                <TableCell>{booking.userOrganization || "—"}</TableCell>
                                <TableCell>{booking.roomName || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "pending" ? "secondary" : "destructive"}>
                                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
