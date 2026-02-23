import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Repeat, CalendarPlus } from "lucide-react";
import type { BookingWithMeta } from "@shared/schema";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";

interface BookingSeriesViewDialogProps {
  booking: BookingWithMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditBooking?: (booking: BookingWithMeta) => void;
  onExtendRecurring?: (booking: BookingWithMeta) => void;
}

export default function BookingSeriesViewDialog({ booking, open, onOpenChange, onEditBooking, onExtendRecurring }: BookingSeriesViewDialogProps) {
  const formatDate = useFormattedDate();
  const { toast } = useToast();
  const [showAddDate, setShowAddDate] = useState(false);
  const [addDateValue, setAddDateValue] = useState("");

  const { data: allBookings = [], isLoading } = useQuery<BookingWithMeta[]>({
    queryKey: ["/api/bookings"],
    enabled: open && !!booking?.bookingGroupId,
  });

  const addDateMutation = useMutation({
    mutationFn: async ({ bookingId, date }: { bookingId: string; date: string }) => {
      const response = await apiRequest("POST", `/api/bookings/${bookingId}/add-date`, { date });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Date added", description: "A new booking has been added to the series." });
      setShowAddDate(false);
      setAddDateValue("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add date", description: error.message, variant: "destructive" });
    },
  });

  if (!booking || !booking.bookingGroupId) return null;

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

  const parentBooking = seriesBookings.find(b => !b.parentBookingId) || seriesBookings[0];
  const childBookings = seriesBookings.filter(b => b.id !== parentBooking.id);

  const statusColors = {
    pending: "secondary",
    confirmed: "default",
    cancelled: "destructive",
  } as const;

  const handleAddDate = () => {
    if (!addDateValue || !parentBooking) return;
    addDateMutation.mutate({ bookingId: parentBooking.id, date: addDateValue });
  };

  const minAddDate = format(addDays(new Date(), 1), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setShowAddDate(false);
        setAddDateValue("");
      }
      onOpenChange(isOpen);
    }}>
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
                  <TableRow 
                    className={`bg-muted/30 font-medium ${onEditBooking ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={() => onEditBooking?.(parentBooking)}
                  >
                    <TableCell>
                      <Badge variant="outline" className="text-xs">Parent</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDate(parentBooking.date)}
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
                    <TableRow 
                      key={childBooking.id} 
                      className={`text-muted-foreground ${onEditBooking ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
                      onClick={() => onEditBooking?.(childBooking)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-0.5 h-6 bg-border" />
                          <Badge variant="outline" className="text-xs">Child {index + 1}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(childBooking.date)}
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

        {showAddDate && (
          <div className="flex items-end gap-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Select Date</label>
              <Input
                type="date"
                value={addDateValue}
                onChange={(e) => setAddDateValue(e.target.value)}
                min={minAddDate}
              />
            </div>
            <Button
              onClick={handleAddDate}
              disabled={!addDateValue || addDateMutation.isPending}
              size="sm"
            >
              {addDateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowAddDate(false); setAddDateValue(""); }}
            >
              Cancel
            </Button>
          </div>
        )}
        
        {parentBooking && (
          <DialogFooter className="sm:justify-start gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddDate(true)}
              disabled={showAddDate}
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Add a Date
            </Button>
            {onExtendRecurring && (
              <Button 
                onClick={() => {
                  onExtendRecurring(parentBooking);
                  onOpenChange(false);
                }}
                variant="outline"
              >
                <Repeat className="w-4 h-4 mr-2" />
                Extend Recurring Booking
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
