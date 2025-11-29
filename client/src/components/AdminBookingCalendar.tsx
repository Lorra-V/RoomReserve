import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { format, addWeeks, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import type { BookingWithMeta, Room } from "@shared/schema";

interface AdminBookingCalendarProps {
  bookings: BookingWithMeta[];
  rooms: Room[];
}

interface BookingSlot {
  booking: BookingWithMeta;
  startHour: number;
  endHour: number;
  roomColor: string;
}

export default function AdminBookingCalendar({ bookings, rooms }: AdminBookingCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  const timeSlots = [
    "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
    "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"
  ];

  // Create a map of room colors
  const roomColorMap = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach(room => {
      map.set(room.id, room.color || "#3b82f6");
    });
    return map;
  }, [rooms]);

  const convertTo24Hour = (time12h: string): string => {
    const [timePart, period] = time12h.split(' ');
    const [hourStr, minute] = timePart.split(':');
    let hour = parseInt(hourStr);
    
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  };

  const parseTimeToHour = (time24: string): number => {
    const [hour] = time24.split(':');
    return parseInt(hour);
  };

  const getBookingsForSlot = (day: Date, time: string): BookingSlot[] => {
    const time24 = convertTo24Hour(time);
    const hour = parseTimeToHour(time24);
    
    return bookings
      .filter(b => {
        const bookingDate = new Date(b.date);
        return (
          isSameDay(bookingDate, day) &&
          b.status !== "cancelled" &&
          parseTimeToHour(b.startTime) <= hour &&
          parseTimeToHour(b.endTime) > hour
        );
      })
      .map(b => ({
        booking: b,
        startHour: parseTimeToHour(b.startTime),
        endHour: parseTimeToHour(b.endTime),
        roomColor: roomColorMap.get(b.roomId) || "#3b82f6",
      }));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentWeek(date);
      setCalendarOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <h2 className="text-xl font-medium">Consolidated Booking Calendar</h2>
          <p className="text-sm text-muted-foreground">All room bookings in one view</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="min-w-[160px] justify-center gap-2"
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
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-dashed border-muted-foreground"></div>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-solid border-muted-foreground"></div>
            <span>Approved</span>
          </div>
          <div className="text-muted-foreground">•</div>
          <span className="text-xs text-muted-foreground">Colors represent rooms</span>
        </div>
        <div className="overflow-x-auto">
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
                    const slotBookings = getBookingsForSlot(day, time);
                    return (
                      <div
                        key={dayIndex}
                        className="h-12 rounded-md border border-border bg-background relative overflow-hidden"
                      >
                        {slotBookings.length > 0 ? (
                          slotBookings.map((slot, idx) => {
                            const isPending = slot.booking.status === "pending";
                            const borderStyle = isPending ? "border-dashed" : "border-solid";
                            const width = slotBookings.length > 1 ? `${100 / slotBookings.length}%` : "100%";
                            const left = slotBookings.length > 1 ? `${(idx * 100) / slotBookings.length}%` : "0%";
                            return (
                              <div
                                key={idx}
                                className={`absolute rounded-md border-2 ${borderStyle} h-full`}
                                style={{
                                  backgroundColor: `${slot.roomColor}30`,
                                  borderColor: slot.roomColor,
                                  width,
                                  left,
                                  zIndex: idx + 1,
                                }}
                                title={`${slot.booking.roomName} - ${slot.booking.userName} (${slot.booking.startTime} - ${slot.booking.endTime}) - ${slot.booking.status}`}
                              >
                                <div className="h-full flex items-center justify-center p-1">
                                  <div className="text-[10px] font-medium truncate w-full text-center" style={{ color: slot.roomColor }}>
                                    {slot.booking.roomName}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="h-full w-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="font-medium">Room Colors:</span>
            {rooms.map(room => (
              <div key={room.id} className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded border"
                  style={{ backgroundColor: room.color || "#3b82f6" }}
                />
                <span>{room.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

