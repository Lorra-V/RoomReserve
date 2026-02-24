import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarIcon, Edit, CheckCircle, XCircle, StickyNote, Lock, Globe, Pencil, Mail, Phone, Building, List } from "lucide-react";
import { format, addWeeks, startOfWeek, addDays, isSameDay, parseISO, startOfDay } from "date-fns";
import type { BookingWithMeta, Room, User } from "@shared/schema";
import BookingEditDialog from "./BookingEditDialog";
import BookingSeriesViewDialog from "./BookingSeriesViewDialog";
import AdminCustomerDialog from "./AdminCustomerDialog";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { useQuery } from "@tanstack/react-query";

interface AdminBookingCalendarProps {
  bookings: BookingWithMeta[];
  rooms: Room[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onCreateBooking?: (date: Date, time: string) => void;
  /** Called when the visible week changes so the parent can fetch bookings for that range */
  onVisibleWeekChange?: (weekStart: Date) => void;
}

interface BookingSlot {
  booking: BookingWithMeta;
  startHour: number;
  endHour: number;
  roomColor: string;
  overlapIndex?: number; // Index within overlapping group
  overlapCount?: number; // Total count of overlapping bookings
  isMultiRoomGroup?: boolean; // True if this represents a grouped multi-room booking
  multiRoomBookings?: BookingWithMeta[]; // All bookings in the multi-room group
}

export default function AdminBookingCalendar({ bookings, rooms, onApprove, onReject, onCreateBooking, onVisibleWeekChange }: AdminBookingCalendarProps) {
  const formatDate = useFormattedDate();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithMeta | null>(null);
  const [bookingDetailsOpen, setBookingDetailsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [seriesViewOpen, setSeriesViewOpen] = useState(false);
  const [customerEditOpen, setCustomerEditOpen] = useState(false);

  const { data: customers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/customers"],
  });
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Notify parent when visible week changes so it can fetch bookings for that range
  useEffect(() => {
    onVisibleWeekChange?.(weekStart);
  }, [weekStart, onVisibleWeekChange]);
  
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

  // Normalize date to local date only (ignore time/timezone)
  const normalizeDate = (date: Date | string): Date => {
    const d = typeof date === 'string' ? parseISO(date.split('T')[0]) : date;
    // Extract just the date part (YYYY-MM-DD) and create a new date at local midnight
    const dateStr = format(d, 'yyyy-MM-dd');
    return startOfDay(parseISO(dateStr));
  };

  // Check if a booking is part of a multi-room group
  const isMultiRoomBooking = (booking: BookingWithMeta): boolean => {
    if (!booking.bookingGroupId) return false;
    // Count how many bookings share this group ID
    const groupBookings = bookings.filter(b => b.bookingGroupId === booking.bookingGroupId);
    return groupBookings.length > 1;
  };

  // Check if two bookings overlap in time
  const bookingsOverlap = (slot1: BookingSlot, slot2: BookingSlot): boolean => {
    return slot1.startHour < slot2.endHour && slot1.endHour > slot2.startHour;
  };

  // Get all bookings for a specific day and detect overlaps
  const getBookingsForDay = (day: Date): BookingSlot[] => {
    const normalizedDay = normalizeDate(day);
    const dayBookings = bookings.filter(b => {
      const bookingDate = normalizeDate(b.date);
      return isSameDay(bookingDate, normalizedDay) && b.status !== "cancelled";
    });

    // First, group multi-room bookings by the same customer (same bookingGroupId, userId, date, time)
    const multiRoomGroups = new Map<string, BookingWithMeta[]>();
    const processedBookingIds = new Set<string>();
    const slots: BookingSlot[] = [];

    // Identify and group multi-room bookings
    for (const booking of dayBookings) {
      if (processedBookingIds.has(booking.id)) continue;
      
      if (booking.bookingGroupId) {
        // Find all bookings in this group that are for the same user, date, and time
        const groupBookings = dayBookings.filter(b => 
          b.bookingGroupId === booking.bookingGroupId &&
          b.userId === booking.userId &&
          b.startTime === booking.startTime &&
          b.endTime === booking.endTime &&
          !processedBookingIds.has(b.id)
        );

        if (groupBookings.length > 1) {
          // This is a multi-room booking - create a grouped slot
          const groupKey = `${booking.bookingGroupId}-${booking.userId}-${booking.startTime}-${booking.endTime}`;
          multiRoomGroups.set(groupKey, groupBookings);
          
          // Create a single slot representing the group
          slots.push({
            booking: groupBookings[0], // Use first booking as representative
            startHour: parseTimeToHour(booking.startTime),
            endHour: parseTimeToHour(booking.endTime),
            roomColor: "#9333ea", // Purple for multi-room
            isMultiRoomGroup: true,
            multiRoomBookings: groupBookings,
          });

          // Mark all bookings in the group as processed
          groupBookings.forEach(b => processedBookingIds.add(b.id));
          continue;
        }
      }
    }

    // Add remaining individual bookings (not part of multi-room groups)
    for (const booking of dayBookings) {
      if (!processedBookingIds.has(booking.id)) {
        slots.push({
          booking: booking,
          startHour: parseTimeToHour(booking.startTime),
          endHour: parseTimeToHour(booking.endTime),
          roomColor: roomColorMap.get(booking.roomId) || "#3b82f6",
        });
      }
    }

    // Sort by start time
    slots.sort((a, b) => a.startHour - b.startHour);

    // Detect overlapping bookings (excluding multi-room groups from horizontal stacking)
    // Multi-room groups should overlap naturally (stack on top)
    const processedIndices = new Set<number>();
    
    for (let i = 0; i < slots.length; i++) {
      if (processedIndices.has(i)) continue;
      // Skip multi-room groups from horizontal overlap detection
      if (slots[i].isMultiRoomGroup) continue;
      
      const overlappingSlots: number[] = [i];
      
      // Find all slots that overlap with this one (excluding multi-room groups)
      for (let j = i + 1; j < slots.length; j++) {
        if (processedIndices.has(j)) continue;
        // Don't group multi-room bookings with regular bookings for horizontal stacking
        if (slots[j].isMultiRoomGroup) continue;
        if (bookingsOverlap(slots[i], slots[j])) {
          overlappingSlots.push(j);
        }
      }
      
      // If there are overlaps, assign indices and counts
      if (overlappingSlots.length > 1) {
        overlappingSlots.forEach((slotIdx, idx) => {
          slots[slotIdx].overlapIndex = idx;
          slots[slotIdx].overlapCount = overlappingSlots.length;
          processedIndices.add(slotIdx);
        });
      }
    }

    return slots;
  };

  // Get bookings that span a specific time slot
  const getBookingsForSlot = (day: Date, time: string): BookingSlot[] => {
    const time24 = convertTo24Hour(time);
    const hour = parseTimeToHour(time24);
    const normalizedDay = normalizeDate(day);
    
    return bookings
      .filter(b => {
        const bookingDate = normalizeDate(b.date);
        return (
          isSameDay(bookingDate, normalizedDay) &&
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

  // Calculate which time slots a booking spans
  const getBookingTimeSlots = (booking: BookingWithMeta): number => {
    const startHour = parseTimeToHour(booking.startTime);
    const endHour = parseTimeToHour(booking.endTime);
    return endHour - startHour;
  };

  const handleBookingClick = (booking: BookingWithMeta) => {
    setSelectedBooking(booking);
    setBookingDetailsOpen(true);
  };

  const handleEdit = () => {
    setBookingDetailsOpen(false);
    setEditDialogOpen(true);
  };

  // Check if selected booking is part of a group
  const getBookingGroupInfo = () => {
    if (!selectedBooking?.bookingGroupId) return null;
    
    const groupBookings = bookings.filter(b => 
      b.bookingGroupId === selectedBooking.bookingGroupId && 
      b.status !== "cancelled"
    );
    
    if (groupBookings.length <= 1) return null;
    
    // Get unique rooms and dates
    const uniqueRooms = Array.from(new Set(groupBookings.map(b => b.roomName)));
    const uniqueDates = Array.from(new Set(groupBookings.map(b => formatDate(b.date))));
    
    return {
      count: groupBookings.length,
      rooms: uniqueRooms,
      dates: uniqueDates,
      isMultiRoom: uniqueRooms.length > 1,
      isRecurring: uniqueDates.length > 1,
    };
  };

  const handleConfirm = () => {
    if (selectedBooking && onApprove) {
      const groupInfo = getBookingGroupInfo();
      if (onApprove.length > 1) {
        (onApprove as any)(selectedBooking.id, groupInfo ? true : false);
      } else {
        onApprove(selectedBooking.id);
      }
      setBookingDetailsOpen(false);
    }
  };

  const handleCancel = () => {
    if (selectedBooking && onReject) {
      const groupInfo = getBookingGroupInfo();
      if (onReject.length > 1) {
        (onReject as any)(selectedBooking.id, groupInfo ? true : false);
      } else {
        onReject(selectedBooking.id);
      }
      setBookingDetailsOpen(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentWeek(date);
      setCalendarOpen(false);
    }
  };

  // Get all dates that have confirmed bookings (for mini calendar)
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

  // Get all dates that have pending bookings (for mini calendar)
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
                  {formatDate(weekStart)}
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
            <span>Confirmed</span>
          </div>
          <div className="text-muted-foreground">•</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "#9333ea" }}></div>
            <span>Multi-room</span>
          </div>
          <div className="text-muted-foreground">•</div>
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-muted-foreground" />
            <span>Public</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span>Private</span>
          </div>
          <div className="text-muted-foreground">•</div>
          <span className="text-xs text-muted-foreground">Other colors represent single rooms</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[800px] relative">
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
              {/* Time slot rows */}
              {timeSlots.map((time, timeIndex) => {
                return (
                  <div key={time} className="grid grid-cols-8 gap-2">
                    <div className="text-xs font-mono text-muted-foreground flex items-center">
                      {time}
                    </div>
                    {weekDays.map((day, dayIndex) => {
                      return (
                        <button
                          key={dayIndex}
                          className="h-12 rounded-md border border-border bg-background hover:bg-accent cursor-pointer transition-colors relative"
                          onClick={() => onCreateBooking?.(day, time)}
                          title="Click to create booking"
                        />
                      );
                    })}
                  </div>
                );
              })}
              
              {/* Booking blocks layer - absolutely positioned over the grid */}
              {weekDays.map((day, dayIndex) => {
                const dayBookings = getBookingsForDay(day);
                // Grid layout: grid-cols-8 with gap-2 (0.5rem = 8px)
                // The gap applies BETWEEN columns, not before the first or after the last
                // Column 0 = time labels, Columns 1-7 = days
                // Each column gets equal width from the available space
                
                const columnIndex = dayIndex + 1; // +1 to skip time label column
                const totalColumns = 8;
                const gapSize = 8; // gap-2 = 0.5rem = 8px
                
                // Calculate position to match grid cells exactly
                // Each column width = (100% - total_gaps) / total_columns
                // Total gaps = 7 (between 8 columns)
                // Left = column_width * column_index + gap * (column_index)
                const totalGaps = totalColumns - 1;
                const columnWidthPercent = `(100% - ${totalGaps * gapSize}px) / ${totalColumns}`;
                const leftCalc = `calc(${columnWidthPercent} * ${columnIndex} + ${gapSize * columnIndex}px)`;
                const blockWidth = `calc(${columnWidthPercent})`;
                
                const columnLeft = leftCalc;
                
                return dayBookings.map((slot, idx) => {
                  const bookingStartHour = slot.startHour;
                  const bookingEndHour = slot.endHour;
                  const slotSpan = bookingEndHour - bookingStartHour;
                  
                  // Find the time slot index for the start time
                  const startSlotIndex = timeSlots.findIndex(t => {
                    const t24 = convertTo24Hour(t);
                    return parseTimeToHour(t24) === bookingStartHour;
                  });
                  
                  if (startSlotIndex === -1) return null;
                  
                  // Calculate position: each slot is 48px (h-12) + 4px gap (space-y-1 = 0.25rem)
                  const slotHeight = 48; // h-12 = 3rem = 48px
                  const slotGap = 4; // space-y-1 = 0.25rem = 4px
                  const topPosition = startSlotIndex * (slotHeight + slotGap);
                  const blockHeight = slotSpan * (slotHeight + slotGap) - slotGap;
                  
                  const isPending = slot.booking.status === "pending";
                  const borderStyle = isPending ? "border-dashed" : "border-solid";
                  
                  // Handle overlapping bookings - stack them horizontally
                  const hasOverlap = slot.overlapCount && slot.overlapCount > 1;
                  const overlapIndex = slot.overlapIndex || 0;
                  const overlapCount = slot.overlapCount || 1;
                  
                  // Calculate width and left position for overlapping bookings
                  let finalWidth = blockWidth;
                  let finalLeft = columnLeft;
                  
                  if (hasOverlap) {
                    // Divide width by overlap count, with a small gap between them
                    const gapBetween = 2; // 2px gap between overlapping bookings
                    const totalGaps = (overlapCount - 1) * gapBetween;
                    finalWidth = `calc((${blockWidth} - ${totalGaps}px) / ${overlapCount})`;
                    
                    // Calculate left offset: start at columnLeft, then add offset for this booking
                    // offset = overlapIndex * (individualWidth + gap)
                    // Use the same calculation as finalWidth for consistency
                    const individualWidthCalc = `calc((${blockWidth} - ${totalGaps}px) / ${overlapCount})`;
                    const overlapOffset = `calc(${individualWidthCalc} * ${overlapIndex} + ${gapBetween * overlapIndex}px)`;
                    finalLeft = `calc(${columnLeft} + ${overlapOffset})`;
                  }
                  
                  return (
                    <button
                      key={slot.booking.id}
                      className={`absolute rounded-md border-2 ${borderStyle} cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto`}
                      style={{
                        backgroundColor: `${slot.roomColor}30`,
                        borderColor: slot.roomColor,
                        height: `${blockHeight}px`,
                        width: finalWidth,
                        top: `${topPosition}px`,
                        left: finalLeft,
                        zIndex: idx + 10,
                      }}
                      onClick={() => handleBookingClick(slot.booking)}
                      title={slot.isMultiRoomGroup && slot.multiRoomBookings
                        ? `${slot.multiRoomBookings.map(b => b.roomName).join(", ")} - ${slot.booking.userName} (${slot.booking.startTime} - ${slot.booking.endTime}) - ${slot.booking.status}`
                        : `${slot.booking.roomName} - ${slot.booking.userName} (${slot.booking.startTime} - ${slot.booking.endTime}) - ${slot.booking.status}`}
                    >
                      <div className="h-full flex flex-col items-center justify-center p-1 gap-0.5">
                        {slot.isMultiRoomGroup && slot.multiRoomBookings ? (
                          <>
                            <div className="flex items-center justify-center gap-0.5 w-full">
                              <div className="text-[10px] font-medium truncate flex-1 text-center" style={{ color: slot.roomColor }}>
                                {slot.multiRoomBookings.map(b => b.roomName).join(", ")}
                              </div>
                              {slot.booking.visibility === "private" ? (
                                <Lock className="w-2 h-2 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <Globe className="w-2 h-2 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center justify-center gap-0.5 w-full">
                              <div className="text-[9px] text-muted-foreground truncate flex-1 text-center">
                                {slot.booking.userName}
                              </div>
                              {slot.multiRoomBookings.some(b => b.adminNotes) && (
                                <StickyNote className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-center gap-0.5 w-full">
                              <div className="text-[10px] font-medium truncate flex-1 text-center" style={{ color: slot.roomColor }}>
                                {slot.booking.roomName}
                              </div>
                              {slot.booking.visibility === "private" ? (
                                <Lock className="w-2 h-2 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <Globe className="w-2 h-2 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center justify-center gap-0.5 w-full">
                              <div className="text-[9px] text-muted-foreground truncate flex-1 text-center">
                                {slot.booking.userName}
                              </div>
                              {slot.booking.adminNotes && (
                                <StickyNote className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                  );
                });
              })}
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
      
      {/* Booking Details Dialog */}
      <Dialog open={bookingDetailsOpen} onOpenChange={setBookingDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              {selectedBooking && (() => {
                const gi = getBookingGroupInfo();
                const roomLabel = gi?.isMultiRoom ? gi.rooms.join(", ") : selectedBooking.roomName;
                return `${roomLabel} - ${formatDate(selectedBooking.date)}`;
              })()}
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              {(() => {
                const groupInfo = getBookingGroupInfo();
                return groupInfo && (
                  <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="text-purple-600 dark:text-purple-400 mt-0.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                          {groupInfo.isMultiRoom ? 'Multi-Room Booking' : 'Recurring Booking'}
                        </p>
                        <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                          This booking is part of a group with <strong>{groupInfo.count} bookings</strong>
                          {groupInfo.isMultiRoom && ` across ${groupInfo.rooms.length} rooms`}
                          {groupInfo.isRecurring && ` on ${groupInfo.dates.length} dates`}.
                          Your action will apply to all bookings in the group.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Customer Info Section */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold">{selectedBooking.userName}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 -mt-1 -mr-1"
                    onClick={() => setCustomerEditOpen(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {selectedBooking.userOrganization && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{selectedBooking.userOrganization}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{selectedBooking.userEmail || "—"}</span>
                  </div>
                  {selectedBooking.userPhone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{selectedBooking.userPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Details Section */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                {(() => {
                  const groupInfo = getBookingGroupInfo();
                  const isMultiRoom = groupInfo?.isMultiRoom;
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{isMultiRoom ? 'Rooms' : 'Room'}</span>
                      <span className="font-medium text-right">
                        {isMultiRoom ? groupInfo.rooms.join(", ") : selectedBooking.roomName}
                      </span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm">{formatDate(selectedBooking.date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time</span>
                  <span className="text-sm font-mono">{selectedBooking.startTime} - {selectedBooking.endTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={selectedBooking.status === "confirmed" ? "default" : selectedBooking.status === "pending" ? "secondary" : "destructive"}>
                    {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Visibility</span>
                  <div className="flex items-center gap-1.5">
                    {selectedBooking.visibility === "private" ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">Private</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">Public</span>
                      </>
                    )}
                  </div>
                </div>
                {selectedBooking.eventName && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Name of Event:</span>
                    <p className="text-sm mt-1">{selectedBooking.eventName}</p>
                  </div>
                )}
                {selectedBooking.purpose && (
                  <div className={`pt-2 ${selectedBooking.eventName ? '' : 'border-t'}`}>
                    <span className="text-sm text-muted-foreground">Purpose:</span>
                    <p className="text-sm mt-1">{selectedBooking.purpose}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            {selectedBooking?.bookingGroupId && (
              <Button
                variant="outline"
                onClick={() => {
                  setBookingDetailsOpen(false);
                  setSeriesViewOpen(true);
                }}
                className="flex-1"
              >
                <List className="w-4 h-4 mr-2" />
                View Series
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleEdit}
              className="flex-1"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            {selectedBooking?.status === "pending" && onApprove && (
              <Button
                onClick={handleConfirm}
                className="flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Dialog */}
      <BookingEditDialog
        booking={selectedBooking}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedBooking(null);
          }
        }}
        onBookingChange={(booking) => {
          // Update the booking being edited when changed from series view
          setSelectedBooking(booking);
        }}
      />

      {/* Series View Dialog */}
      <BookingSeriesViewDialog
        booking={selectedBooking}
        open={seriesViewOpen}
        onOpenChange={setSeriesViewOpen}
        onEditBooking={(booking) => {
          setSeriesViewOpen(false);
          setSelectedBooking(booking);
          setEditDialogOpen(true);
        }}
        onExtendRecurring={(parentBooking) => {
          setSeriesViewOpen(false);
          setSelectedBooking(parentBooking);
          setEditDialogOpen(true);
        }}
      />

      {/* Customer Edit Dialog */}
      <AdminCustomerDialog
        open={customerEditOpen}
        onOpenChange={setCustomerEditOpen}
        customer={selectedBooking ? customers.find(c => c.id === selectedBooking.userId) || null : null}
      />
    </Card>
  );
}

