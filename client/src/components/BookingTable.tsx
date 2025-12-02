import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil } from "lucide-react";
import { format } from "date-fns";
import BookingEditDialog from "./BookingEditDialog";
import type { BookingWithMeta } from "@shared/schema";

interface BookingTableProps {
  bookings: BookingWithMeta[];
  showActions?: boolean;
  showEditButton?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function BookingTable({ bookings, showActions, showEditButton = true, onApprove, onReject }: BookingTableProps) {
  const [editingBooking, setEditingBooking] = useState<BookingWithMeta | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const statusColors = {
    pending: "secondary",
    approved: "default",
    cancelled: "destructive",
  } as const;

  const handleEditClick = (booking: BookingWithMeta) => {
    setEditingBooking(booking);
    setEditDialogOpen(true);
  };

  return (
    <>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Event Name</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              {(showActions || showEditButton) && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions || showEditButton ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow key={booking.id} className="cursor-pointer hover-elevate" onClick={() => handleEditClick(booking)}>
                  <TableCell className="font-mono text-sm">
                    {format(new Date(booking.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {booking.startTime} - {booking.endTime}
                  </TableCell>
                  <TableCell>{booking.roomName}</TableCell>
                  <TableCell>{booking.eventName || "—"}</TableCell>
                  <TableCell>{booking.userName}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[booking.status]} data-testid={`badge-status-${booking.id}`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </Badge>
                  </TableCell>
                  {(showActions || showEditButton) && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {showEditButton && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditClick(booking)}
                            data-testid={`button-edit-${booking.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {showActions && booking.status === "pending" && (
                          <>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => onApprove?.(booking.id)}
                              data-testid={`button-approve-${booking.id}`}
                              title="Confirm booking"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => onReject?.(booking.id)}
                              data-testid={`button-reject-${booking.id}`}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <BookingEditDialog 
        booking={editingBooking} 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />
    </>
  );
}
