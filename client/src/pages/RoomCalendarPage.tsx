import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import CalendarView from "@/components/CalendarView";
import BookingFormDialog from "@/components/BookingFormDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import type { Room, Booking } from "@shared/schema";

export default function RoomCalendarPage() {
  const { id: roomId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: string } | null>(null);

  const { data: room, isLoading: isLoadingRoom } = useQuery<Room>({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
  });

  const { data: bookings, isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/rooms", roomId, "bookings"],
    enabled: !!roomId,
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: { 
      roomId: string;
      date: Date;
      startTime: string;
      endTime: string;
      purpose: string;
      attendees: number;
    }) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomId, "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Booking submitted",
        description: "Your booking request has been submitted and is pending approval.",
      });
      setShowBookingForm(false);
      setSelectedSlot(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Failed to create booking",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBookSlot = (date: Date, time: string) => {
    setSelectedSlot({ date, time });
    setShowBookingForm(true);
  };

  const handleSubmitBooking = (data: { purpose: string; attendees: number }) => {
    if (!selectedSlot || !roomId) return;

    const convertTo24Hour = (time12h: string): string => {
      const [timePart, period] = time12h.split(' ');
      const [hourStr, minute] = timePart.split(':');
      let hour = parseInt(hourStr);
      
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    };

    const addHourTo24Time = (time24h: string): string => {
      const [hourStr, minute] = time24h.split(':');
      let hour = parseInt(hourStr) + 1;
      if (hour >= 24) hour = hour - 24;
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    };

    const startTime24 = convertTo24Hour(selectedSlot.time);
    const endTime24 = addHourTo24Time(startTime24);

    createBookingMutation.mutate({
      roomId,
      date: selectedSlot.date,
      startTime: startTime24,
      endTime: endTime24,
      purpose: data.purpose,
      attendees: data.attendees,
    });
  };

  if (isLoadingRoom || isLoadingBookings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">Room not found</h2>
          <Button onClick={() => setLocation("/rooms")}>Back to Rooms</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button 
            variant="ghost" 
            className="mb-2" 
            data-testid="button-back"
            onClick={() => setLocation("/rooms")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rooms
          </Button>
          <h1 className="text-3xl font-semibold">{room.name}</h1>
          <p className="text-muted-foreground">
            Capacity: {room.capacity} people • {room.amenities.join(', ')}
          </p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <CalendarView
          roomName={room.name}
          bookings={bookings || []}
          onBookSlot={handleBookSlot}
        />
      </div>

      {selectedSlot && (
        <BookingFormDialog
          open={showBookingForm}
          onOpenChange={setShowBookingForm}
          roomName={room.name}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
          onSubmit={handleSubmitBooking}
        />
      )}
    </div>
  );
}
