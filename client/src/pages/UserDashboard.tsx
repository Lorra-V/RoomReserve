import BookingCard from "@/components/BookingCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, PlusCircle } from "lucide-react";
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';
import multipurposeHallImg from '@assets/generated_images/multipurpose_hall_interior.png';

const mockBookings = [
  {
    id: "1",
    roomName: "Meeting Room A",
    roomImage: meetingRoomImg,
    date: new Date(2025, 11, 25),
    startTime: "10:00 AM",
    endTime: "11:30 AM",
    status: "approved" as const,
  },
  {
    id: "2",
    roomName: "Multipurpose Hall",
    roomImage: multipurposeHallImg,
    date: new Date(2025, 11, 28),
    startTime: "02:00 PM",
    endTime: "04:00 PM",
    status: "pending" as const,
  },
];

export default function UserDashboard() {
  const handleCancelBooking = (id: string) => {
    console.log('Cancel booking:', id);
  };

  const handleBrowseRooms = () => {
    console.log('Navigate to browse rooms');
  };

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
            
            {mockBookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    {...booking}
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
                      <span className="font-medium">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Upcoming</span>
                      <span className="font-medium">{mockBookings.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">This Month</span>
                      <span className="font-medium">5</span>
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
