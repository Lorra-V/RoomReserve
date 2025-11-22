import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { format } from "date-fns";

interface Booking {
  id: string;
  date: Date;
  time: string;
  room: string;
  user: string;
  status: "pending" | "approved" | "cancelled";
}

interface BookingTableProps {
  bookings: Booking[];
  showActions?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function BookingTable({ bookings, showActions, onApprove, onReject }: BookingTableProps) {
  const statusColors = {
    pending: "secondary",
    approved: "default",
    cancelled: "destructive",
  } as const;

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell className="font-mono text-sm">
                {format(booking.date, 'MMM dd, yyyy')}
              </TableCell>
              <TableCell className="font-mono text-sm">{booking.time}</TableCell>
              <TableCell>{booking.room}</TableCell>
              <TableCell>{booking.user}</TableCell>
              <TableCell>
                <Badge variant={statusColors[booking.status]} data-testid={`badge-status-${booking.id}`}>
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </Badge>
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  {booking.status === "pending" && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => onApprove?.(booking.id)}
                        data-testid={`button-approve-${booking.id}`}
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
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
