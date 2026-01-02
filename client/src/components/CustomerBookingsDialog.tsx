import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BookingTable from "./BookingTable";
import { Loader2, Calendar, User } from "lucide-react";
import type { User as UserType, BookingWithMeta } from "@shared/schema";
import { startOfDay, isBefore, isAfter, isSameDay } from "date-fns";

interface CustomerBookingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: UserType | null;
}

export default function CustomerBookingsDialog({ open, onOpenChange, customer }: CustomerBookingsDialogProps) {
  const { data: bookings = [], isLoading } = useQuery<BookingWithMeta[]>({
    queryKey: [`/api/admin/customers/${customer?.id}/bookings`],
    enabled: !!customer?.id && open,
  });

  const getInitials = (user: UserType | null) => {
    if (!user) return "?";
    if (!user.firstName && !user.lastName) return "?";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  // Separate bookings into current and history
  const { currentBookings, historyBookings } = useMemo(() => {
    if (!bookings.length) return { currentBookings: [], historyBookings: [] };

    const now = startOfDay(new Date());
    const current: BookingWithMeta[] = [];
    const history: BookingWithMeta[] = [];

    bookings.forEach((booking) => {
      const bookingDate = startOfDay(new Date(booking.date));
      const isPast = isBefore(bookingDate, now);
      const isToday = isSameDay(bookingDate, now);

      // Current: pending/confirmed bookings that are today or in the future
      // History: cancelled bookings OR past bookings (regardless of status)
      if (booking.status === "cancelled" || isPast) {
        history.push(booking);
      } else if (booking.status === "pending" || booking.status === "confirmed") {
        current.push(booking);
      }
    });

    // Sort current by date ascending (upcoming first)
    current.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.startTime.localeCompare(b.startTime);
    });

    // Sort history by date descending (most recent first)
    history.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return b.startTime.localeCompare(a.startTime);
    });

    return { currentBookings: current, historyBookings: history };
  }, [bookings]);

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              {customer.profileImageUrl && <AvatarImage src={customer.profileImageUrl} />}
              <AvatarFallback>{getInitials(customer)}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>
                {customer.firstName || customer.lastName
                  ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                  : "Customer"} - Bookings
              </DialogTitle>
              <DialogDescription>
                {customer.email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <Tabs defaultValue="current" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="current">
                  <Calendar className="w-4 h-4 mr-2" />
                  Current ({currentBookings.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  <User className="w-4 h-4 mr-2" />
                  History ({historyBookings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="flex-1 overflow-auto mt-4">
                {currentBookings.length > 0 ? (
                  <BookingTable bookings={currentBookings} showActions={true} showEditButton={true} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No current bookings</p>
                    <p className="text-sm">This customer has no upcoming or active bookings</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="flex-1 overflow-auto mt-4">
                {historyBookings.length > 0 ? (
                  <BookingTable bookings={historyBookings} showActions={true} showEditButton={true} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No booking history</p>
                    <p className="text-sm">This customer has no past or cancelled bookings</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
