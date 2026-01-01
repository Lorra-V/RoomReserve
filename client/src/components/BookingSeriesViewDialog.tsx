import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import type { BookingWithMeta } from "@shared/schema";

interface BookingSeriesViewDialogProps {
  booking: BookingWithMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BookingSeriesViewDialog({ booking, open, onOpenChange }: BookingSeriesViewDialogProps) {
  const { data: allBookings = [], isLoading } = useQuery<BookingWithMeta[]>({
    queryKey: ["/api/bookings"],
    enabled: open && !!booking?.bookingGroupId,
  });

  if (!booking || !booking.bookingGroupId) return null;

  // Get all bookings in the same group
  const seriesBookings = allBookings
    .filter(b => b.bookingGroupId === booking.bookingGroupId)
    .sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      return a.startTime.localeCompare(b.startTime);
    });

  // Identify parent booking (the one with null parentBookingId or the first one)
  const parentBooking = seriesBookings.find(b => !b.parentBookingId) || seriesBookings[0];
  const childBookings = seriesBookings.filter(b => b.id !== parentBooking.id);

  const statusColors = {
    pending: "secondary",
    confirmed: "default",
    cancelled: "destructive",
  } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recurring Booking Series</DialogTitle>
          <DialogDescription>
            View all {seriesBookings.length} booking{seriesBookings.length !== 1 ? 's' : ''} in this recurring series
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Room:</span>
                  <p className="font-medium">{parentBooking.roomName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer:</span>
                  <p className="font-medium">{parentBooking.userName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Bookings:</span>
                  <p className="font-medium">{seriesBookings.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Series Status:</span>
                  <p className="font-medium">
                    {seriesBookings.every(b => b.status === "confirmed") ? "All Confirmed" :
                     seriesBookings.every(b => b.status === "cancelled") ? "All Cancelled" :
                     seriesBookings.some(b => b.status === "confirmed") ? "Partially Confirmed" : "Pending"}
                  </p>
                </div>
              </div>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Attendees</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Parent booking */}
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell>
                      <Badge variant="outline" className="text-xs">Parent</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {format(parentBooking.date instanceof Date ? parentBooking.date : new Date(parentBooking.date), 'dd-MM-yyyy')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {parentBooking.startTime} - {parentBooking.endTime}
                    </TableCell>
                    <TableCell>{parentBooking.purpose}</TableCell>
                    <TableCell>{parentBooking.attendees}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[parentBooking.status]}>
                        {parentBooking.status.charAt(0).toUpperCase() + parentBooking.status.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  
                  {/* Child bookings */}
                  {childBookings.map((childBooking, index) => (
                    <TableRow key={childBooking.id} className="text-muted-foreground">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-0.5 h-6 bg-border" />
                          <Badge variant="outline" className="text-xs">Child {index + 1}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {format(childBooking.date instanceof Date ? childBooking.date : new Date(childBooking.date), 'dd-MM-yyyy')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {childBooking.startTime} - {childBooking.endTime}
                      </TableCell>
                      <TableCell>{childBooking.purpose}</TableCell>
                      <TableCell>{childBooking.attendees}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[childBooking.status]}>
                          {childBooking.status.charAt(0).toUpperCase() + childBooking.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {seriesBookings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No bookings found in this series
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
