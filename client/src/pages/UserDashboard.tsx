import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import BookingCard from "@/components/BookingCard";
import BookingTable from "@/components/BookingTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, PlusCircle, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import type { BookingWithMeta } from "@shared/schema";
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';
import multipurposeHallImg from '@assets/generated_images/multipurpose_hall_interior.png';
import studyRoomImg from '@assets/generated_images/study_room_interior.png';
import workshopImg from '@assets/generated_images/workshop_space_interior.png';

const imageMap: Record<string, string> = {
  'meeting': meetingRoomImg,
  'multipurpose': multipurposeHallImg,
  'hall': multipurposeHallImg,
  'study': studyRoomImg,
  'workshop': workshopImg,
};

function getRoomImage(roomName: string): string {
  const nameLower = roomName.toLowerCase();
  for (const [key, image] of Object.entries(imageMap)) {
    if (nameLower.includes(key)) {
      return image;
    }
  }
  return meetingRoomImg;
}

export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Check for booking intent and redirect to room page
  useEffect(() => {
    const bookingIntentStr = localStorage.getItem('bookingIntent');
    if (bookingIntentStr) {
      try {
        const bookingIntent = JSON.parse(bookingIntentStr);
        if (bookingIntent.roomId) {
          // Redirect to the room page - the RoomCalendarPage will handle restoring the slot
          setLocation(`/room/${bookingIntent.roomId}`);
        }
      } catch (error) {
        console.error('Error parsing booking intent:', error);
        localStorage.removeItem('bookingIntent');
      }
    }
  }, [setLocation]);

  const { data: bookings, isLoading } = useQuery<BookingWithMeta[]>({
    queryKey: ["/api/bookings"],
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiRequest("DELETE", `/api/bookings/${bookingId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking cancelled",
        description: "Your booking has been cancelled successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Failed to cancel booking",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCancelBooking = (id: string) => {
    cancelBookingMutation.mutate(id);
  };

  const handleBrowseRooms = () => {
    setLocation("/rooms");
  };

  const activeBookings = bookings?.filter(b => b.status !== "cancelled") || [];
  
  // Calculate series information for each booking
  const bookingsWithSeriesInfo = useMemo(() => {
    // Group bookings by bookingGroupId
    const seriesMap = new Map<string, BookingWithMeta[]>();
    activeBookings.forEach(booking => {
      if (booking.bookingGroupId) {
        if (!seriesMap.has(booking.bookingGroupId)) {
          seriesMap.set(booking.bookingGroupId, []);
        }
        seriesMap.get(booking.bookingGroupId)!.push(booking);
      }
    });

    return activeBookings.map(booking => {
      const seriesBookings = booking.bookingGroupId ? seriesMap.get(booking.bookingGroupId) || [] : [];
      const uniqueDates = new Set(seriesBookings.map(b => {
        const d = b.date instanceof Date ? b.date : new Date(b.date);
        return d.toISOString().split('T')[0];
      }));
      const isRecurring = uniqueDates.size > 1;
      const seriesCount = seriesBookings.length;

      return {
        ...booking,
        roomImage: getRoomImage(booking.roomName),
        isRecurring,
        seriesCount: seriesCount > 1 ? seriesCount : undefined,
      };
    });
  }, [activeBookings]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-semibold">My Bookings</h1>
          <p className="text-muted-foreground">Manage your room reservations</p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium">Upcoming Bookings</h2>
              <Button onClick={handleBrowseRooms} data-testid="button-new-booking">
                <PlusCircle className="w-4 h-4 mr-2" />
                New Booking
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : bookingsWithSeriesInfo.length > 0 ? (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "cards" | "table")}>
                <TabsList>
                  <TabsTrigger value="cards">Cards</TabsTrigger>
                  <TabsTrigger value="table">Table</TabsTrigger>
                </TabsList>
                
                <TabsContent value="cards" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bookingsWithSeriesInfo.map((booking) => (
                      <BookingCard
                        key={booking.id}
                        id={booking.id}
                        roomName={booking.roomName}
                        roomImage={booking.roomImage}
                        date={new Date(booking.date)}
                        startTime={booking.startTime}
                        endTime={booking.endTime}
                        status={booking.status}
                        eventName={booking.eventName}
                        onCancel={handleCancelBooking}
                        bookingGroupId={booking.bookingGroupId}
                        isRecurring={booking.isRecurring}
                        seriesCount={booking.seriesCount}
                        onClick={booking.status === "pending" ? () => {
                          // Switch to table view when clicking a pending booking card
                          setViewMode("table");
                        } : undefined}
                      />
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="table" className="space-y-4">
                  <BookingTable
                    bookings={activeBookings}
                    showEditButton={true}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No upcoming bookings</h3>
                  <p className="text-sm text-muted-foreground mb-4">Start by browsing available rooms</p>
                  <Button onClick={handleBrowseRooms}>
                    Browse Rooms
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="w-full lg:w-80 flex-shrink-0">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Quick Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Bookings</span>
                      <span className="font-medium">{isLoading ? "-" : bookings?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Upcoming</span>
                      <span className="font-medium">{isLoading ? "-" : activeBookings.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confirmed</span>
                      <span className="font-medium">{isLoading ? "-" : activeBookings.filter(b => b.status === "confirmed").length}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
