import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarIcon, Calendar as CalendarIconLucide } from "lucide-react";
import { format, addWeeks, startOfWeek, addDays, isSameDay, startOfDay, parseISO } from "date-fns";
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | 'none'>('none');
  const prevDateRef = useRef<Date>(new Date());
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const prevDate = prevDateRef.current;
      const direction = date > prevDate ? 'right' : date < prevDate ? 'left' : 'none';
      setAnimationDirection(direction);
      setIsAnimating(true);
      prevDateRef.current = date;
      
      setCurrentWeek(date);
      setSelectedDate(date);
      setCalendarOpen(false);
      
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const handleDateChange = (newDate: Date) => {
    const prevDate = prevDateRef.current;
    const direction = newDate > prevDate ? 'right' : 'left';
    setAnimationDirection(direction);
    setIsAnimating(true);
    prevDateRef.current = newDate;
    
    setSelectedDate(newDate);
    setCurrentWeek(newDate);
    
    setTimeout(() => setIsAnimating(false), 300);
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

  const convertTo12Hour = (time24h: string): string => {
    const [hourStr, minute] = time24h.split(':');
    let hour = parseInt(hourStr);
    const period = hour >= 12 ? 'PM' : 'AM';
    
    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;
    
    return `${hour.toString().padStart(2, '0')}:${minute} ${period}`;
  };

  // Check if a time slot is covered by any booking
  const isTimeSlotBooked = (day: Date, time: string): { booking: Booking | null; status: "available" | "booked" | "pending" } => {
    const time24 = convertTo24Hour(time);
    const dayBookings = getBookingsForDay(day);
    
    for (const booking of dayBookings) {
      const bookingStart = booking.startTime;
      const bookingEnd = booking.endTime;
      
      // Check if this time slot falls within the booking range
      if (time24 >= bookingStart && time24 < bookingEnd) {
        return {
          booking,
          status: booking.status === "confirmed" ? "booked" : "pending"
        };
      }
    }
    
    return { booking: null, status: "available" };
  };

  // Get all time slots that are part of a booking block (for rendering continuous blocks)
  const getBookingBlockSlots = (day: Date, booking: Booking): string[] => {
    const bookingStart = booking.startTime;
    const bookingEnd = booking.endTime;
    const slots: string[] = [];
    
    timeSlots.forEach(time => {
      const time24 = convertTo24Hour(time);
      if (time24 >= bookingStart && time24 < bookingEnd) {
        slots.push(time);
      }
    });
    
    return slots;
  };

  // Normalize date to local date only (ignore time/timezone)
  const normalizeDate = (date: Date | string): Date => {
    const d = typeof date === 'string' ? parseISO(date.split('T')[0]) : date;
    // Extract just the date part (YYYY-MM-DD) and create a new date at local midnight
    const dateStr = format(d, 'yyyy-MM-dd');
    return startOfDay(parseISO(dateStr));
  };

  const getBookingForSlot = (day: Date, time: string): Booking | undefined => {
    const time24 = convertTo24Hour(time);
    const normalizedDay = normalizeDate(day);
    return bookings.find(b => {
      const bookingDate = normalizeDate(b.date);
      return isSameDay(bookingDate, normalizedDay) && b.startTime === time24 && b.status !== "cancelled";
    });
  };

  const getSlotStatus = (day: Date, time: string): TimeSlot["status"] => {
    const booking = getBookingForSlot(day, time);
    if (!booking) return "available";
    return booking.status === "confirmed" ? "booked" : "pending";
  };

  // Get all bookings for a specific day (for mobile full day view)
  const getBookingsForDay = (day: Date): Booking[] => {
    const normalizedDay = normalizeDate(day);
    return bookings.filter(b => {
      const bookingDate = normalizeDate(b.date);
      return isSameDay(bookingDate, normalizedDay) && b.status !== "cancelled";
    });
  };

  // Check if a day has any booked or pending bookings
  const hasBookingsForDay = (day: Date): boolean => {
    return getBookingsForDay(day).length > 0;
  };

  // Get the first public booking for a day (for mobile click)
  const getFirstPublicBookingForDay = (day: Date): Booking | undefined => {
    const dayBookings = getBookingsForDay(day);
    return dayBookings.find(b => b.visibility === "public");
  };

  // Get all dates that have confirmed bookings
  const getConfirmedDates = (): Date[] => {
    const confirmedDatesSet = new Set<string>();
    bookings.forEach(booking => {
      if (booking.status === "confirmed") {
        const bookingDate = normalizeDate(booking.date);
        const dateKey = format(bookingDate, 'yyyy-MM-dd');
        confirmedDatesSet.add(dateKey);
      }
    });
    return Array.from(confirmedDatesSet).map(dateStr => startOfDay(parseISO(dateStr)));
  };

  // Get all dates that have pending bookings
  const getPendingDates = (): Date[] => {
    const pendingDatesSet = new Set<string>();
    bookings.forEach(booking => {
      if (booking.status === "pending") {
        const bookingDate = normalizeDate(booking.date);
        const dateKey = format(bookingDate, 'yyyy-MM-dd');
        pendingDatesSet.add(dateKey);
      }
    });
    return Array.from(pendingDatesSet).map(dateStr => startOfDay(parseISO(dateStr)));
  };

  const confirmedDates = getConfirmedDates();
  const pendingDates = getPendingDates();

  const handleSlotClick = (day: Date, time: string) => {
    const booking = getBookingForSlot(day, time);
    if (booking && booking.visibility === "public") {
      setSelectedBooking(booking);
      setBookingDetailsOpen(true);
    }
  };

  const handleDayClick = (day: Date) => {
    const publicBooking = getFirstPublicBookingForDay(day);
    if (publicBooking) {
      setSelectedBooking(publicBooking);
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
            onClick={() => {
              const newWeek = addWeeks(currentWeek, -1);
              setAnimationDirection('left');
              setIsAnimating(true);
              setCurrentWeek(newWeek);
              setTimeout(() => setIsAnimating(false), 300);
            }}
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
                  {format(weekStart, 'dd-MM-yyyy')}
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
                modifiers={{
                  confirmed: confirmedDates,
                  pending: pendingDates,
                }}
                modifiersClassNames={{
                  confirmed: "bg-[#857f7f] text-white hover:bg-[#857f7f] hover:text-white",
                  pending: "bg-[#ffea18] text-gray-900 hover:bg-[#ffea18] hover:text-gray-900",
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const newWeek = addWeeks(currentWeek, 1);
              setAnimationDirection('right');
              setIsAnimating(true);
              setCurrentWeek(newWeek);
              setTimeout(() => setIsAnimating(false), 300);
            }}
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
                handleDateChange(newDate);
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-sm font-medium">{format(selectedDate, 'EEEE, dd-MM-yyyy')}</h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const newDate = addDays(selectedDate, 1);
                handleDateChange(newDate);
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
              modifiers={{
                confirmed: confirmedDates,
                pending: pendingDates,
              }}
              modifiersClassNames={{
                confirmed: "bg-[#857f7f] text-white hover:bg-[#857f7f] hover:text-white",
                pending: "bg-[#ffea18] text-gray-900 hover:bg-[#ffea18] hover:text-gray-900",
              }}
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
          <div 
            key={weekStart.toISOString()}
            className={`min-w-[800px] ${isAnimating ? 'calendar-fade-in' : ''}`}
          >
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div className="text-sm font-medium"></div>
              {weekDays.map((day, i) => (
                <div key={i} className="text-center text-sm font-medium">
                  <div>{format(day, 'EEE')}</div>
                  <div className="text-muted-foreground">{format(day, 'dd')}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1 relative">
              {/* Base grid - time slots */}
              {timeSlots.map((time, timeIndex) => (
                <div key={time} className="grid grid-cols-8 gap-2">
                  <div className="text-xs font-mono text-muted-foreground flex items-center">
                    {time}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const { booking, status } = isTimeSlotBooked(day, time);
                    // Only render cell if not covered by a booking block
                    const isStartOfBooking = booking && booking.startTime === convertTo24Hour(time);
                    
                    if (booking && !isStartOfBooking) {
                      // This slot is covered by a booking block, render placeholder
                      return <div key={dayIndex} className="h-12" />;
                    }
                    
                    const isClickable = status === "available";
                    
                    return (
                      <button
                        key={dayIndex}
                        className={`h-12 rounded-md border ${statusColors[status]} ${isClickable ? 'cursor-pointer active-elevate-2' : 'cursor-not-allowed opacity-60'}`}
                        onClick={() => {
                          if (isClickable) {
                            onBookSlot(day, time);
                          }
                        }}
                        disabled={!isClickable}
                        data-testid={`slot-${dayIndex}-${timeIndex}`}
                      />
                    );
                  })}
                </div>
              ))}
              
              {/* Booking blocks layer - absolutely positioned */}
              {weekDays.map((day, dayIndex) => {
                const dayBookings = getBookingsForDay(day);
                
                // Calculate position similar to admin calendar
                const columnIndex = dayIndex + 1;
                const totalColumns = 8;
                const gapSize = 8; // gap-2 = 8px
                const totalGaps = totalColumns - 1;
                const columnWidthPercent = `(100% - ${totalGaps * gapSize}px) / ${totalColumns}`;
                const leftCalc = `calc(${columnWidthPercent} * ${columnIndex} + ${gapSize * columnIndex}px)`;
                const blockWidth = `calc(${columnWidthPercent})`;
                
                return dayBookings.map((booking) => {
                  const time24Start = booking.startTime;
                  const time24End = booking.endTime;
                  
                  // Calculate start hour from time string
                  const startHour = parseInt(time24Start.split(':')[0]);
                  const endHour = parseInt(time24End.split(':')[0]);
                  const slotSpan = endHour - startHour;
                  
                  // Find which time slot index this starts at
                  const startSlotIndex = timeSlots.findIndex(t => {
                    const t24 = convertTo24Hour(t);
                    return parseInt(t24.split(':')[0]) === startHour;
                  });
                  
                  if (startSlotIndex === -1 || slotSpan <= 0) return null;
                  
                  const slotHeight = 48; // h-12 = 48px
                  const slotGap = 4; // space-y-1 = 4px
                  const topPosition = startSlotIndex * (slotHeight + slotGap);
                  const blockHeight = slotSpan * (slotHeight + slotGap) - slotGap;
                  
                  const isPublic = booking.visibility === "public";
                  const status = booking.status === "confirmed" ? "booked" : "pending";
                  const statusColor = status === "booked" ? "bg-[#857f7f]" : "bg-[#ffea18]";
                  
                  return (
                    <button
                      key={booking.id}
                      className={`absolute rounded-md border ${statusColor} ${
                        isPublic ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'
                      }`}
                      style={{
                        height: `${blockHeight}px`,
                        width: blockWidth,
                        top: `${topPosition}px`,
                        left: leftCalc,
                        zIndex: 10,
                      }}
                      onClick={() => {
                        if (isPublic) {
                          setSelectedBooking(booking);
                          setBookingDetailsOpen(true);
                        }
                      }}
                      disabled={!isPublic}
                      title={isPublic ? (booking.eventName || "Event") : "Private"}
                    >
                      <div className="h-full flex items-center justify-center p-1">
                        <span className="text-[10px] font-medium text-center leading-tight truncate">
                          {isPublic ? (booking.eventName || "Event") : "Private"}
                        </span>
                      </div>
                    </button>
                  );
                });
              })}
            </div>
          </div>
        </div>

        {/* Mobile: Single day view */}
        <div className="md:hidden relative overflow-hidden">
          <div 
            key={selectedDate.toISOString()}
            className={`space-y-1 ${
              isAnimating 
                ? animationDirection === 'right' 
                  ? 'calendar-slide-right' 
                  : animationDirection === 'left'
                  ? 'calendar-slide-left'
                  : ''
                : ''
            }`}
          >
            {(() => {
              const dayBookings = getBookingsForDay(selectedDate);
              const processedSlots = new Set<string>();
              const bookingBlocks: { booking: Booking; startSlot: string; endSlot: string }[] = [];
              
              // Process bookings to create blocks
              dayBookings.forEach(booking => {
                const blockSlots = getBookingBlockSlots(selectedDate, booking);
                if (blockSlots.length > 0) {
                  bookingBlocks.push({
                    booking,
                    startSlot: blockSlots[0],
                    endSlot: blockSlots[blockSlots.length - 1]
                  });
                  blockSlots.forEach(slot => processedSlots.add(slot));
                }
              });
              
              // Sort bookings by start time
              bookingBlocks.sort((a, b) => {
                const aTime = convertTo24Hour(a.startSlot);
                const bTime = convertTo24Hour(b.startSlot);
                return aTime.localeCompare(bTime);
              });
              
              // Create combined view: booking blocks + available slots
              const items: Array<{ type: 'booking' | 'slot'; booking?: Booking; time?: string; startSlot?: string; endSlot?: string }> = [];
              
              // Add booking blocks
              bookingBlocks.forEach(({ booking, startSlot, endSlot }) => {
                items.push({
                  type: 'booking',
                  booking,
                  startSlot,
                  endSlot
                });
              });
              
              // Add available time slots
              timeSlots.forEach(time => {
                if (!processedSlots.has(time)) {
                  items.push({ type: 'slot', time });
                }
              });
              
              // Sort all items by time
              items.sort((a, b) => {
                const aTime = a.time ? convertTo24Hour(a.time) : (a.startSlot ? convertTo24Hour(a.startSlot) : '');
                const bTime = b.time ? convertTo24Hour(b.time) : (b.startSlot ? convertTo24Hour(b.startSlot) : '');
                return aTime.localeCompare(bTime);
              });
              
              return items.map((item, index) => {
                if (item.type === 'booking' && item.booking) {
                  const booking = item.booking;
                  const isPublic = booking.visibility === "public";
                  const status = booking.status === "confirmed" ? "booked" : "pending";
                  const statusColor = status === "booked" ? "bg-[#857f7f]" : "bg-[#ffea18]";
                  const startTime12 = convertTo12Hour(booking.startTime);
                  const endTime12 = convertTo12Hour(booking.endTime);
                  
                  return (
                    <button
                      key={booking.id}
                      className={`w-full rounded-md border ${statusColor} p-4 text-left ${
                        isPublic ? 'cursor-pointer hover:opacity-80 active:opacity-70' : 'cursor-default opacity-80'
                      } transition-opacity`}
                      onClick={() => {
                        if (isPublic) {
                          setSelectedBooking(booking);
                          setBookingDetailsOpen(true);
                        }
                      }}
                      disabled={!isPublic}
                      data-testid={`booking-day-block-${booking.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {startTime12} - {endTime12}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              status === "booked" 
                                ? "bg-[#6b6565] text-white" 
                                : "bg-[#d4c414] text-gray-900"
                            }`}>
                              {status === "booked" ? "Booked" : "Pending"}
                            </span>
                          </div>
                          {isPublic && booking.eventName && (
                            <h3 className="font-medium text-sm mb-1 truncate">
                              {booking.eventName}
                            </h3>
                          )}
                          {isPublic && booking.purpose && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {booking.purpose}
                            </p>
                          )}
                          {!isPublic && (
                            <p className="text-xs text-muted-foreground italic">
                              Private booking
                            </p>
                          )}
                        </div>
                        {isPublic && (
                          <div className="flex-shrink-0">
                            <CalendarIconLucide className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                } else if (item.type === 'slot' && item.time) {
                  const time = item.time;
                  const slotInfo = isTimeSlotBooked(selectedDate, time);
                  const isClickable = slotInfo.status === "available";
                  const isPublicBooking = slotInfo.booking && slotInfo.booking.visibility === "public";
                  const displayText = slotInfo.booking 
                    ? (slotInfo.booking.visibility === "public" ? (slotInfo.booking.eventName || "Event") : "Private")
                    : "";
                  
                  return (
                    <div key={time} className="grid grid-cols-2 gap-2 items-center">
                      <div className="text-xs font-mono text-muted-foreground">
                        {time}
                      </div>
                      <button
                        className={`h-12 rounded-md border ${statusColors[slotInfo.status]} ${isClickable ? 'cursor-pointer active-elevate-2' : isPublicBooking ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'} relative`}
                        onClick={() => {
                          if (isClickable) {
                            onBookSlot(selectedDate, time);
                          } else if (isPublicBooking) {
                            handleSlotClick(selectedDate, time);
                          }
                        }}
                        disabled={!isClickable && !isPublicBooking}
                        data-testid={`slot-mobile-${index}`}
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
                }
                return null;
              });
            })()}
          </div>
        </div>
      </CardContent>
      
      <Dialog open={bookingDetailsOpen} onOpenChange={setBookingDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedBooking?.eventName || "Event Details"}</DialogTitle>
            <DialogDescription>
              {selectedBooking && format(normalizeDate(selectedBooking.date), 'dd-MM-yyyy')}
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <CalendarIconLucide className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{selectedBooking.startTime} - {selectedBooking.endTime}</span>
              </div>
              {selectedBooking.purpose && (
                <div className="space-y-1">
                  <span className="text-sm font-medium">Description:</span>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedBooking.purpose}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
