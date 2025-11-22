import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addWeeks, startOfWeek, addDays, isSameDay } from "date-fns";
import type { Booking } from "@shared/schema";

interface TimeSlot {
  id: string;
  time: string;
  status: "available" | "booked" | "pending";
  bookedBy?: string;
}

interface CalendarViewProps {
  roomName: string;
  bookings: Booking[];
  onBookSlot: (date: Date, time: string) => void;
}

export default function CalendarView({ roomName, bookings, onBookSlot }: CalendarViewProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  
  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
  ];

  const getSlotStatus = (day: Date, time: string): TimeSlot["status"] => {
    const booking = bookings.find(b => {
      const bookingDate = new Date(b.date);
      return isSameDay(bookingDate, day) && b.startTime === time && b.status !== "cancelled";
    });

    if (!booking) return "available";
    return booking.status === "approved" ? "booked" : "pending";
  };

  const statusColors = {
    available: "bg-accent hover-elevate",
    booked: "bg-muted",
    pending: "bg-secondary/50 border-2 border-dashed border-primary",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <h2 className="text-xl font-medium">{roomName}</h2>
          <p className="text-sm text-muted-foreground">Click a time slot to book</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
            data-testid="button-previous-week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(weekStart, 'MMM dd, yyyy')}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            data-testid="button-next-week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-accent border"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted border"></div>
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-secondary/50 border-2 border-dashed border-primary"></div>
            <span>Pending</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-6 gap-2 mb-2">
              <div className="text-sm font-medium"></div>
              {weekDays.map((day, i) => (
                <div key={i} className="text-center text-sm font-medium">
                  <div>{format(day, 'EEE')}</div>
                  <div className="text-muted-foreground">{format(day, 'dd')}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {timeSlots.map((time, timeIndex) => (
                <div key={time} className="grid grid-cols-6 gap-2">
                  <div className="text-xs font-mono text-muted-foreground flex items-center">
                    {time}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const status = getSlotStatus(day, time);
                    const isClickable = status === "available";
                    return (
                      <button
                        key={dayIndex}
                        className={`h-12 rounded-md border ${statusColors[status]} ${isClickable ? 'cursor-pointer active-elevate-2' : 'cursor-not-allowed opacity-60'}`}
                        onClick={() => isClickable && onBookSlot(day, time)}
                        disabled={!isClickable}
                        data-testid={`slot-${dayIndex}-${timeIndex}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
