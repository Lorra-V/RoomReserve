import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BookingTable from "./BookingTable";
import AdminCustomerDialog from "./AdminCustomerDialog";
import { Loader2, Calendar, History, Pencil, Mail, Phone, Building } from "lucide-react";
import type { User as UserType, BookingWithMeta } from "@shared/schema";
import { startOfDay, isBefore, isSameDay } from "date-fns";
import { useFormattedDate } from "@/hooks/useFormattedDate";

interface CustomerBookingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: UserType | null;
}

export default function CustomerBookingsDialog({ open, onOpenChange, customer }: CustomerBookingsDialogProps) {
  const formatDate = useFormattedDate();
  const [customerEditOpen, setCustomerEditOpen] = useState(false);

  const { data: bookings = [], isLoading } = useQuery<BookingWithMeta[]>({
    queryKey: [`/api/admin/customers/${customer?.id}/bookings`],
    enabled: !!customer?.id && open,
  });

  const getInitials = (user: UserType | null) => {
    if (!user) return "?";
    if (!user.firstName && !user.lastName) return "?";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  };

  const fullName = customer
    ? (customer.firstName || customer.lastName
        ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
        : "Customer")
    : "Customer";

  const { currentBookings, historyBookings } = useMemo(() => {
    if (!bookings.length) return { currentBookings: [], historyBookings: [] };

    const now = startOfDay(new Date());
    const current: BookingWithMeta[] = [];
    const history: BookingWithMeta[] = [];

    bookings.forEach((booking) => {
      const bookingDate = startOfDay(new Date(booking.date));
      const isPast = isBefore(bookingDate, now);

      if (booking.status === "cancelled" || isPast) {
        history.push(booking);
      } else if (booking.status === "pending" || booking.status === "confirmed") {
        current.push(booking);
      }
    });

    current.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.startTime.localeCompare(b.startTime);
    });

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>{fullName}</DialogTitle>
          </DialogHeader>

          {/* Customer Info Section */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <Avatar className="w-12 h-12">
                {customer.profileImageUrl && <AvatarImage src={customer.profileImageUrl} />}
                <AvatarFallback className="text-sm">{getInitials(customer)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold leading-tight">{fullName}</h2>
                    {customer.profileComplete ? (
                      <Badge variant="outline" className="mt-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 text-xs">
                        Complete Profile
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="mt-1 bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800 text-xs">
                        Incomplete Profile
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 -mt-1 -mr-1 flex-shrink-0"
                    onClick={() => setCustomerEditOpen(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{customer.email || "—"}</span>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.organization && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{customer.organization}</span>
                    </div>
                  )}
                  {customer.createdAt && (
                    <p className="text-xs text-muted-foreground/70 pt-1">
                      Joined {formatDate(customer.createdAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bookings Section */}
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
                    <History className="w-4 h-4 mr-2" />
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
                      <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
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

      <AdminCustomerDialog
        open={customerEditOpen}
        onOpenChange={setCustomerEditOpen}
        customer={customer}
      />
    </>
  );
}
