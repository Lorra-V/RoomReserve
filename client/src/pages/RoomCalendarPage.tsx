import { useState } from "react";
import CalendarView from "@/components/CalendarView";
import BookingFormDialog from "@/components/BookingFormDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function RoomCalendarPage() {
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: string } | null>(null);

  const handleBookSlot = (date: Date, time: string) => {
    setSelectedSlot({ date, time });
    setShowBookingForm(true);
  };

  const handleSubmitBooking = (data: { purpose: string; attendees: number }) => {
    console.log('Booking submitted:', { ...selectedSlot, ...data });
    setShowBookingForm(false);
    setSelectedSlot(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button variant="ghost" className="mb-2" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rooms
          </Button>
          <h1 className="text-3xl font-semibold">Meeting Room A</h1>
          <p className="text-muted-foreground">Capacity: 8 people • WiFi, Projector, Coffee</p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <CalendarView
          roomName="Meeting Room A"
          onBookSlot={handleBookSlot}
        />
      </div>

      {selectedSlot && (
        <BookingFormDialog
          open={showBookingForm}
          onOpenChange={setShowBookingForm}
          roomName="Meeting Room A"
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
          onSubmit={handleSubmitBooking}
        />
      )}
    </div>
  );
}
