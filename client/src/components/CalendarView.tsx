import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarIcon, Clock, Users } from "lucide-react";
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingDetailsOpen, setBookingDetailsOpen] = useState(false);
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentWeek(date);
      setSelectedDate(date);
      setCalendarOpen(false);
    }
  };
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  const timeSlots = [
    "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
    "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"
  ];

  const convertTo24Hour = (time12h: string): string => {
    const [timePart, period] = time12h.split(' ');
    const [hourStr, minute] = timePart.split(':');
    let hour = parseInt(hourStr);
    
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  };

  const getBookingForSlot = (day: Date, time: string): Booking | undefined => {
    const time24 = convertTo24Hour(time);
    return bookings.find(b => {
      const bookingDate = new Date(b.date);
      return isSameDay(bookingDate, day) && b.startTime === time24 && b.status !== "cancelled";
    });
  };

  const getSlotStatus = (day: Date, time: string): TimeSlot["status"] => {
    const booking = getBookingForSlot(day, time);
    if (!booking) return "available";
    return booking.status === "approved" ? "booked" : "pending";
  };

  const handleSlotClick = (day: Date, time: string) => {
    const booking = getBookingForSlot(day, time);
    if (booking && booking.visibility === "public") {
      setSelectedBooking(booking);
      setBookingDetailsOpen(true);
    }
  };

  const statusColors = {
    available: "bg-accent hover-elevate",
    booked: "bg-[#857f7f] border",
    pending: "bg-[#ffea18] border",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <h2 className="text-xl font-medium">{roomName}</h2>
          <p className="text-sm text-muted-foreground">Click a time slot to book</p>
        </div>
        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
            data-testid="button-previous-week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="min-w-[160px] justify-center gap-2"
                data-testid="button-date-picker"
              >
                <CalendarIcon className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {format(weekStart, 'MMM dd, yyyy')}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={currentWeek}
                onSelect={handleDateSelect}
                initialFocus
                data-testid="mini-calendar"
              />
            </PopoverContent>
          </Popover>
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
        {/* Mobile: Mini calendar always visible */}
        <div className="md:hidden mb-4">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const newDate = addDays(selectedDate, -1);
                setSelectedDate(newDate);
                setCurrentWeek(newDate);
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-sm font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const newDate = addDays(selectedDate, 1);
                setSelectedDate(newDate);
                setCurrentWeek(newDate);
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              data-testid="mini-calendar-mobile"
            />
          </div>
        </div>
        <div className="mb-4 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-accent border"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#857f7f] border"></div>
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#ffea18] border"></div>
            <span>Pending</span>
          </div>
        </div>
        
        {/* Desktop: Week view */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-8 gap-2 mb-2">
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
                <div key={time} className="grid grid-cols-8 gap-2">
                  <div className="text-xs font-mono text-muted-foreground flex items-center">
                    {time}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const status = getSlotStatus(day, time);
                    const booking = getBookingForSlot(day, time);
                    const isClickable = status === "available";
                    const isPublicBooking = booking && booking.visibility === "public";
                    const displayText = booking 
                      ? (booking.visibility === "public" ? (booking.eventName || "Event") : "Private")
                      : "";
                    
                    return (
                      <button
                        key={dayIndex}
                        className={`h-12 rounded-md border ${statusColors[status]} ${isClickable ? 'cursor-pointer active-elevate-2' : isPublicBooking ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'} relative`}
                        onClick={() => {
                          if (isClickable) {
                            onBookSlot(day, time);
                          } else if (isPublicBooking) {
                            handleSlotClick(day, time);
                          }
                        }}
                        disabled={!isClickable && !isPublicBooking}
                        data-testid={`slot-${dayIndex}-${timeIndex}`}
                        title={displayText}
                      >
                        {displayText && (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium px-1 text-center leading-tight truncate">
                            {displayText}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: Single day view */}
        <div className="md:hidden">
          <div className="space-y-1">
            {timeSlots.map((time, timeIndex) => {
              const status = getSlotStatus(selectedDate, time);
              const booking = getBookingForSlot(selectedDate, time);
              const isClickable = status === "available";
              const isPublicBooking = booking && booking.visibility === "public";
              const displayText = booking 
                ? (booking.visibility === "public" ? (booking.eventName || "Event") : "Private")
                : "";
              
              return (
                <div key={time} className="grid grid-cols-2 gap-2 items-center">
                  <div className="text-xs font-mono text-muted-foreground">
                    {time}
                  </div>
                  <button
                    className={`h-12 rounded-md border ${statusColors[status]} ${isClickable ? 'cursor-pointer active-elevate-2' : isPublicBooking ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'} relative`}
                    onClick={() => {
                      if (isClickable) {
                        onBookSlot(selectedDate, time);
                      } else if (isPublicBooking) {
                        handleSlotClick(selectedDate, time);
                      }
                    }}
                    disabled={!isClickable && !isPublicBooking}
                    data-testid={`slot-mobile-${timeIndex}`}
                    title={displayText}
                  >
                    {displayText && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium px-1 text-center leading-tight truncate">
                        {displayText}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
      
      <Dialog open={bookingDetailsOpen} onOpenChange={setBookingDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedBooking?.eventName || "Event Details"}</DialogTitle>
            <DialogDescription>
              Public event booking details
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{format(new Date(selectedBooking.date), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{selectedBooking.startTime} - {selectedBooking.endTime}</span>
              </div>
              {selectedBooking.purpose && (
                <div className="space-y-1">
                  <span className="text-sm font-medium">Description:</span>
                  <p className="text-sm text-muted-foreground">{selectedBooking.purpose}</p>
                </div>
              )}
              {selectedBooking.attendees && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedBooking.attendees} attendee{selectedBooking.attendees > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
