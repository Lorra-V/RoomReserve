import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import CalendarView from "@/components/CalendarView";
import BookingFormDialog from "@/components/BookingFormDialog";
import LoginPromptDialog from "@/components/LoginPromptDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Calendar as CalendarIcon, DollarSign, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Room, Booking } from "@shared/schema";

const TIME_SLOTS = [
  "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"
];

export default function RoomCalendarPage() {
  const { id: roomId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: string } | null>(null);

  const { data: room, isLoading: isLoadingRoom } = useQuery<Room>({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
  });

  const { data: bookings, isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/rooms", roomId, "bookings"],
    enabled: !!roomId,
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  // Scroll to top when room changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [roomId]);

  // Restore booking intent after login
  useEffect(() => {
    if (isAuthenticated && room && roomId) {
      const bookingIntentStr = localStorage.getItem('bookingIntent');
      if (bookingIntentStr) {
        try {
          const bookingIntent = JSON.parse(bookingIntentStr);
          // Check if this booking intent is for the current room (by roomId or roomName)
          const isMatchingRoom = bookingIntent.roomId === roomId || bookingIntent.roomName === room.name;
          if (isMatchingRoom && bookingIntent.date && bookingIntent.time) {
            const intentDate = new Date(bookingIntent.date);
            const intentTime = bookingIntent.time;
            
            // Restore the selected slot
            setSelectedSlot({ date: intentDate, time: intentTime });
            setShowBookingForm(true);
            
            // Clear the booking intent
            localStorage.removeItem('bookingIntent');
          }
        } catch (error) {
          console.error('Error parsing booking intent:', error);
          localStorage.removeItem('bookingIntent');
        }
      }
    }
  }, [isAuthenticated, room, roomId]);

  const createBookingMutation = useMutation({
    mutationFn: async (data: { 
      roomId: string;
      date: Date;
      startTime: string;
      endTime: string;
      eventName: string;
      purpose: string;
      attendees: number;
      selectedItems: string[];
      visibility: "private" | "public";
      isRecurring?: boolean;
      recurrencePattern?: string;
      recurrenceEndDate?: Date;
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
      console.error("Booking error:", error);
      console.error("Error details:", {
        message: error.message,
        status: (error as any).status,
        stack: error.stack,
      });
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Failed to create booking",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBookSlot = (date: Date, time: string) => {
    setSelectedSlot({ date, time });
    if (isAuthenticated) {
      setShowBookingForm(true);
    } else {
      setShowLoginPrompt(true);
    }
  };

  const handleSubmitBooking = (data: { 
    date: Date;
    startTime: string; 
    endTime: string; 
    eventName: string; 
    purpose: string; 
    attendees: number; 
    selectedItems: string[];
    visibility: "private" | "public";
    isRecurring?: boolean;
    recurrencePattern?: string;
    recurrenceEndDate?: Date;
  }) => {
    if (!roomId) return;

    const convertTo24Hour = (time12h: string): string => {
      const [timePart, period] = time12h.split(' ');
      const [hourStr, minute] = timePart.split(':');
      let hour = parseInt(hourStr);
      
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    };

    const startTime24 = convertTo24Hour(data.startTime);
    const endTime24 = convertTo24Hour(data.endTime);

    // Ensure dates are properly formatted
    const bookingDate = data.date instanceof Date ? data.date : new Date(data.date);
    const recurrenceEndDate = data.recurrenceEndDate 
      ? (data.recurrenceEndDate instanceof Date ? data.recurrenceEndDate : new Date(data.recurrenceEndDate))
      : undefined;

    const bookingData = {
      roomId,
      date: bookingDate,
      startTime: startTime24,
      endTime: endTime24,
      eventName: data.eventName || undefined,
      purpose: data.purpose,
      attendees: data.attendees,
      selectedItems: data.selectedItems,
      visibility: data.visibility,
      isRecurring: data.isRecurring || false,
      recurrencePattern: data.recurrencePattern,
      recurrenceEndDate: recurrenceEndDate,
    };
    
    console.log("Submitting booking:", {
      ...bookingData,
      date: bookingDate.toISOString(),
      recurrenceEndDate: recurrenceEndDate?.toISOString(),
    });
    createBookingMutation.mutate(bookingData);
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
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-green-600">
            <TabsTrigger
              value="calendar"
              className="gap-2 text-white data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:text-black"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendar</span>
            </TabsTrigger>
            <TabsTrigger
              value="fees"
              className="gap-2 text-white data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:text-black"
            >
              <DollarSign className="w-4 h-4" />
              <span>Rental Fees</span>
            </TabsTrigger>
            <TabsTrigger
              value="agreement"
              className="gap-2 text-white data-[state=active]:bg-white data-[state=active]:text-black dark:data-[state=active]:text-black"
            >
              <FileText className="w-4 h-4" />
              <span>Agreement</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <CalendarView
              roomName={room.name}
              bookings={bookings || []}
              onBookSlot={handleBookSlot}
            />
          </TabsContent>

          <TabsContent value="fees">
            <Card>
              <CardContent className="pt-6">
                {(settings as any)?.rentalFeesUrl || (settings as any)?.rentalFeesContent ? (
                  <div className="space-y-4">
                    {(settings as any)?.rentalFeesUrl && (
                      <div className="flex justify-center pb-4 border-b">
                        <Button
                          asChild
                          size="lg"
                          className="gap-2"
                        >
                          <a 
                            href={(settings as any).rentalFeesUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <FileText className="w-4 h-4" />
                            View Full Fee Schedule
                          </a>
                        </Button>
                      </div>
                    )}
                    {(settings as any)?.rentalFeesContent && (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <div className="whitespace-pre-wrap">{(settings as any).rentalFeesContent}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Rental fees information will be available soon.</p>
                    <p className="text-sm mt-2">Please contact us for pricing details.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agreement">
            <Card>
              <CardContent className="pt-6">
                {(settings as any)?.agreementUrl || (settings as any)?.agreementContent ? (
                  <div className="space-y-4">
                    {(settings as any)?.agreementUrl && (
                      <div className="flex justify-center pb-4 border-b">
                        <Button
                          asChild
                          size="lg"
                          className="gap-2"
                        >
                          <a 
                            href={(settings as any).agreementUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <FileText className="w-4 h-4" />
                            View Full Rental Agreement
                          </a>
                        </Button>
                      </div>
                    )}
                    {(settings as any)?.agreementContent && (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <div className="whitespace-pre-wrap">{(settings as any).agreementContent}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Rental agreement will be available soon.</p>
                    <p className="text-sm mt-2">Please contact us for agreement details.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedSlot && (
        <BookingFormDialog
          open={showBookingForm}
          onOpenChange={setShowBookingForm}
          roomName={room.name}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
          availableTimeSlots={TIME_SLOTS}
          bookings={bookings || []}
          onSubmit={handleSubmitBooking}
        />
      )}

      {selectedSlot && (
        <LoginPromptDialog
          open={showLoginPrompt}
          onOpenChange={setShowLoginPrompt}
          roomName={room.name}
          roomId={roomId}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
        />
      )}
    </div>
  );
}
