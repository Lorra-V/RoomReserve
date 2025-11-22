import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import BookingCard from "@/components/BookingCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, PlusCircle, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import type { Booking, Room } from "@shared/schema";
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

  const { data: bookings, isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: rooms, isLoading: isLoadingRooms } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
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

  const isLoading = isLoadingBookings || isLoadingRooms;

  const activeBookings = bookings?.filter(b => b.status !== "cancelled") || [];
  
  const bookingsWithRooms = activeBookings.map(booking => {
    const room = rooms?.find(r => r.id === booking.roomId);
    return {
      ...booking,
      roomName: room?.name || "Unknown Room",
      roomImage: room ? getRoomImage(room.name) : meetingRoomImg,
    };
  });

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
            ) : bookingsWithRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bookingsWithRooms.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    id={booking.id}
                    roomName={booking.roomName}
                    roomImage={booking.roomImage}
                    date={new Date(booking.date)}
                    startTime={booking.startTime}
                    endTime={booking.endTime}
                    status={booking.status}
                    onCancel={handleCancelBooking}
                  />
                ))}
              </div>
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
                      <span className="font-medium">{isLoading ? "-" : bookingsWithRooms.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved</span>
                      <span className="font-medium">{isLoading ? "-" : activeBookings.filter(b => b.status === "approved").length}</span>
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
