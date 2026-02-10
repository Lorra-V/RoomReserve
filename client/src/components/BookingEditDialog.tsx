import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useClerk } from "@clerk/clerk-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, List, Repeat } from "lucide-react";
import { format, parseISO, startOfDay, addDays, addMonths, getDay, startOfMonth, isValid } from "date-fns";
import type { BookingWithMeta, Room } from "@shared/schema";
import { formatDisplayDate } from "@/lib/utils";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import BookingSeriesViewDialog from "./BookingSeriesViewDialog";
import { Switch } from "@/components/ui/switch";

const bookingEditSchema = z.object({
  roomId: z.string().min(1, "Room is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  purpose: z.string().min(1, "Purpose is required"),
  attendees: z.coerce.number().min(1, "At least 1 attendee is required"),
  status: z.enum(["pending", "confirmed", "cancelled"]),
  visibility: z.enum(["private", "public"]).optional(),
  adminNotes: z.string().optional(),
});

type BookingEditFormData = z.infer<typeof bookingEditSchema>;

type BookingUpdatePayload = BookingEditFormData & {
  updateGroup?: boolean;
  isRecurring?: boolean;
  recurrencePattern?: string;
  recurrenceEndDate?: string;
  recurrenceDays?: string[];
  recurrenceWeekOfMonth?: number;
  recurrenceDayOfWeek?: number;
  extendRecurring?: boolean;
};

interface BookingEditDialogProps {
  booking: BookingWithMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingChange?: (booking: BookingWithMeta) => void;
}

export default function BookingEditDialog({ booking, open, onOpenChange, onBookingChange }: BookingEditDialogProps) {
  const formatDate = useFormattedDate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { redirectToSignIn } = useClerk();
  const [updateGroup, setUpdateGroup] = useState(false);
  const [showSeriesView, setShowSeriesView] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<string>("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceWeekOfMonth, setRecurrenceWeekOfMonth] = useState<number>(1);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(0);
  const [extendRecurring, setExtendRecurring] = useState(false);
  const shouldExtendRef = useRef(false);

  // Get all bookings to check for group
  const { data: allBookings = [] } = useQuery<BookingWithMeta[]>({
    queryKey: ["/api/bookings"],
  });

  // Get all rooms for room selection
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const form = useForm<BookingEditFormData>({
    resolver: zodResolver(bookingEditSchema),
    defaultValues: {
      roomId: "",
      date: "",
      startTime: "",
      endTime: "",
      purpose: "",
      attendees: 1,
      status: "pending",
      visibility: "private" as const,
      adminNotes: "",
    },
  });

  // Normalize date to local date only (ignore time/timezone)
  const normalizeDate = (date: Date | string | null | undefined): Date => {
    if (!date) {
      return startOfDay(new Date());
    }
    const parsed = typeof date === "string"
      ? parseISO(date.split("T")[0].split(" ")[0])
      : date;
    if (!isValid(parsed)) {
      return startOfDay(new Date());
    }
    const dateStr = format(parsed, "yyyy-MM-dd");
    const normalized = parseISO(dateStr);
    return isValid(normalized) ? startOfDay(normalized) : startOfDay(new Date());
  };

  useEffect(() => {
    if (booking) {
      // Normalize the date to avoid timezone shifts
      const normalizedDate = normalizeDate(booking.date);
      form.reset({
        roomId: booking.roomId,
        date: format(normalizedDate, "yyyy-MM-dd"),
        startTime: booking.startTime,
        endTime: booking.endTime,
        purpose: booking.purpose,
        attendees: booking.attendees,
        status: booking.status,
        visibility: (booking.visibility || "private") as "private" | "public",
        adminNotes: booking.adminNotes || "",
      });
      // Default to updating group only if this is a parent booking (not a child)
      // Child bookings should default to false so they can be edited individually
      const groupInfo = getBookingGroupInfo();
      const isChildBooking = !!booking.parentBookingId;
      setUpdateGroup(!!groupInfo && !isChildBooking);
      
      // Reset recurrence fields - only allow making recurring if NOT already part of a series
      const isExistingRecurring = groupInfo && groupInfo.isRecurring && groupInfo.count > 1;
      // Get the parent booking to check recurrence fields (parent has the recurrence settings)
      const parentBooking = groupInfo?.parentBooking || booking;
      
      if (isExistingRecurring && parentBooking.recurrencePattern && parentBooking.recurrenceEndDate) {
        // Pre-populate with existing recurrence pattern for extension
        setRecurrencePattern(parentBooking.recurrencePattern);
        setRecurrenceEndDate("");
        // Check if we should extend (set via ref from series view)
        if (shouldExtendRef.current) {
          setExtendRecurring(true);
          shouldExtendRef.current = false; // Reset the flag
        } else {
          setExtendRecurring(false);
        }
        if (parentBooking.recurrenceDays && parentBooking.recurrenceDays.length > 0) {
          setRecurrenceDays(parentBooking.recurrenceDays.map(d => parseInt(d)));
        } else {
          setRecurrenceDays([]);
        }
        setRecurrenceWeekOfMonth(parentBooking.recurrenceWeekOfMonth || 1);
        setRecurrenceDayOfWeek(parentBooking.recurrenceDayOfWeek || 0);
      } else {
        setIsRecurring(false);
        setRecurrencePattern("weekly");
        setRecurrenceEndDate("");
        setRecurrenceDays([]);
        setRecurrenceWeekOfMonth(1);
        setRecurrenceDayOfWeek(0);
        setExtendRecurring(false);
      }
    }
  }, [booking, form]);

  // Check if booking is part of a group
  const getBookingGroupInfo = () => {
    if (!booking?.bookingGroupId) return null;
    
    const groupBookings = allBookings.filter(b => 
      b.bookingGroupId === booking.bookingGroupId
    );
    
    if (groupBookings.length <= 1) return null;
    
    // Get unique rooms and dates
    const uniqueRooms = Array.from(new Set(groupBookings.map(b => b.roomName)));
    const uniqueDates = Array.from(new Set(groupBookings.map(b => formatDate(b.date))));
    
    // Check if this is a child booking (has a parentBookingId)
    const isChildBooking = !!booking.parentBookingId;
    const parentBooking = isChildBooking 
      ? groupBookings.find(b => !b.parentBookingId) || groupBookings[0]
      : booking;
    
    return {
      count: groupBookings.length,
      rooms: uniqueRooms,
      dates: uniqueDates,
      isMultiRoom: uniqueRooms.length > 1,
      isRecurring: uniqueDates.length > 1,
      isChildBooking,
      parentBooking,
    };
  };

  const updateMutation = useMutation({
    mutationFn: async (data: BookingUpdatePayload) => {
      console.log('[BookingEditDialog] Sending update payload:', JSON.stringify(data, null, 2));
      const endpoint = isAdmin ? `/api/admin/bookings/${booking?.id}` : `/api/bookings/${booking?.id}`;
      const response = await apiRequest("PATCH", endpoint, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      const isGroup = data?.isGroup || data?.count > 1;
      toast({
        title: isGroup ? `${data.count} Bookings updated` : "Booking updated",
        description: isGroup 
          ? `All ${data.count} bookings in the group have been updated.`
          : "The booking has been updated successfully.",
      });
      onOpenChange(false);
      setUpdateGroup(false);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session expired",
          description: "Your session has expired. Redirecting to login...",
          variant: "destructive",
        });
        setTimeout(() => {
          void redirectToSignIn({ redirectUrl: window.location.href });
        }, 1500);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update booking. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Helper function to calculate occurrences for recurring bookings
  const calculateOccurrences = (): number => {
    if (!isRecurring || !recurrenceEndDate || !booking) return 0;
    const startDate = normalizeDate(booking.date);
    const endDate = normalizeDate(recurrenceEndDate);
    
    let count = 1; // Include the initial booking
    let currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      if (recurrencePattern === 'daily') {
        currentDate = addDays(currentDate, 1);
        if (currentDate <= endDate) count++;
      } else if (recurrencePattern === 'weekly') {
        if (recurrenceDays.length > 0) {
          // Find next selected day
          let nextDate = new Date(currentDate);
          let found = false;
          for (let i = 0; i < 7; i++) {
            nextDate = addDays(nextDate, 1);
            if (recurrenceDays.includes(getDay(nextDate)) && nextDate <= endDate) {
              count++;
              currentDate = nextDate;
              found = true;
              break;
            }
          }
          if (!found) break;
        } else {
          currentDate = addDays(currentDate, 7);
          if (currentDate <= endDate) count++;
        }
      } else if (recurrencePattern === 'monthly') {
        currentDate = addMonths(currentDate, 1);
        if (currentDate <= endDate) count++;
      }
    }
    return count;
  };

  // Helper function to calculate additional occurrences when extending a recurring booking
  const calculateAdditionalOccurrences = (): number => {
    const groupInfo = getBookingGroupInfo();
    if (!extendRecurring || !recurrenceEndDate || !booking || !groupInfo) return 0;
    
    // Get the parent booking to access recurrence fields
    const parentBooking = groupInfo.parentBooking || booking;
    
    // Find the latest date in the existing series
    const groupBookings = allBookings.filter(b => b.bookingGroupId === booking.bookingGroupId);
    const latestDate = groupBookings.reduce((latest, b) => {
      const bookingDate = normalizeDate(b.date);
      return bookingDate > latest ? bookingDate : latest;
    }, normalizeDate(booking.date));
    
    const newEndDate = normalizeDate(recurrenceEndDate);
    
    // Only calculate if new end date is after the latest date in the series
    if (newEndDate <= latestDate) return 0;
    
    // Use recurrence pattern from parent booking or state (state takes precedence if set)
    const patternToUse = recurrencePattern || parentBooking.recurrencePattern || 'weekly';
    const daysToUse = recurrenceDays.length > 0 ? recurrenceDays : (parentBooking.recurrenceDays ? parentBooking.recurrenceDays.map(d => parseInt(d)) : []);
    
    // Start from the day after the latest date
    let count = 0;
    let currentDate = new Date(latestDate);
    currentDate = addDays(currentDate, 1); // Start from next day
    
    while (currentDate <= newEndDate) {
      if (patternToUse === 'daily') {
        count++;
        currentDate = addDays(currentDate, 1);
      } else if (patternToUse === 'weekly') {
        if (daysToUse.length > 0) {
          // Find next selected day
          let nextDate = new Date(currentDate);
          let found = false;
          for (let i = 0; i < 7; i++) {
            if (daysToUse.includes(getDay(nextDate)) && nextDate <= newEndDate) {
              count++;
              currentDate = nextDate;
              found = true;
              break;
            }
            nextDate = addDays(nextDate, 1);
          }
          if (!found) break;
          currentDate = addDays(currentDate, 1);
        } else {
          count++;
          currentDate = addDays(currentDate, 7);
        }
      } else if (patternToUse === 'monthly') {
        count++;
        currentDate = addMonths(currentDate, 1);
      } else {
        break; // Unknown pattern
      }
    }
    return count;
  };

  // Helper function to get the nth occurrence of a day in a month
  const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
    const firstDay = startOfMonth(date);
    const firstDayOfWeek = getDay(firstDay);
    
    let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
    
    if (weekOfMonth === 5) {
      const nextMonth = addMonths(firstDay, 1);
      const lastDay = addDays(nextMonth, -1);
      const lastDayOfWeek = getDay(lastDay);
      const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
      return addDays(lastDay, -daysBack);
    }
    
    daysToAdd += (weekOfMonth - 1) * 7;
    const targetDate = addDays(firstDay, daysToAdd);
    
    if (targetDate.getMonth() !== date.getMonth()) {
      return null;
    }
    
    return targetDate;
  };

  const handleDayToggle = (day: number) => {
    setRecurrenceDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const onSubmit = (data: BookingEditFormData) => {
    const groupInfo = getBookingGroupInfo();
    // Only allow making recurring if booking is NOT already part of a series
    const canMakeRecurring = !groupInfo || (groupInfo.count === 1 && !groupInfo.isRecurring);
    const isExtendingRecurring = !!(extendRecurring && groupInfo && groupInfo.isRecurring && recurrenceEndDate);

    const parsedDate = parseISO(data.date);
    if (!isValid(parsedDate)) {
      toast({
        title: "Invalid date",
        description: "Please select a valid date for the booking.",
        variant: "destructive",
      });
      return;
    }
    const normalizedDate = startOfDay(parsedDate);

    updateMutation.mutate({ 
      ...data, 
      date: format(normalizedDate, "yyyy-MM-dd"),
      updateGroup,
      isRecurring: canMakeRecurring ? isRecurring : false,
      recurrencePattern: (canMakeRecurring && isRecurring) || isExtendingRecurring ? recurrencePattern : undefined,
      recurrenceEndDate: ((canMakeRecurring && isRecurring && recurrenceEndDate) || (isExtendingRecurring && recurrenceEndDate)) ? recurrenceEndDate : undefined,
      recurrenceDays: ((canMakeRecurring && isRecurring && recurrencePattern === 'weekly' && recurrenceDays.length > 0) || (isExtendingRecurring && recurrencePattern === 'weekly' && recurrenceDays.length > 0)) ? recurrenceDays.map(String) : undefined,
      recurrenceWeekOfMonth: ((canMakeRecurring && isRecurring && recurrencePattern === 'monthly') || (isExtendingRecurring && recurrencePattern === 'monthly')) ? recurrenceWeekOfMonth : undefined,
      recurrenceDayOfWeek: ((canMakeRecurring && isRecurring && recurrencePattern === 'monthly') || (isExtendingRecurring && recurrencePattern === 'monthly')) ? recurrenceDayOfWeek : undefined,
      extendRecurring: isExtendingRecurring,
    });
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogDescription>
            Update the booking details for {booking.roomName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Customer</span>
                <span className="font-medium">{booking.userName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm">{booking.userEmail || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="text-sm">{booking.userPhone || "—"}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-booking-room">
                        <SelectValue placeholder="Select a room" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms
                        .filter(room => room.isActive)
                        .map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(() => {
              const groupInfo = getBookingGroupInfo();
              return groupInfo && (
                <div className="space-y-3">
                  <div className={`${groupInfo.isChildBooking ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'} border rounded-lg p-3`}>
                    <div className="flex items-start gap-2">
                      <div className={`${groupInfo.isChildBooking ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'} mt-0.5`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${groupInfo.isChildBooking ? 'text-blue-900 dark:text-blue-100' : 'text-purple-900 dark:text-purple-100'}`}>
                            {groupInfo.isChildBooking ? 'Child Booking' : 'Parent Booking'} - {groupInfo.isMultiRoom ? 'Multi-Room Series' : 'Recurring Series'}
                          </p>
                          {groupInfo.isChildBooking && (
                            <Badge variant="outline" className="text-xs">Part of Series</Badge>
                          )}
                        </div>
                        <p className={`text-xs ${groupInfo.isChildBooking ? 'text-blue-700 dark:text-blue-300' : 'text-purple-700 dark:text-purple-300'} mt-1`}>
                          {groupInfo.isChildBooking 
                            ? `This is a child booking in a recurring series with ${groupInfo.count} total bookings.`
                            : `This is the parent booking in a recurring series with ${groupInfo.count} total bookings.`}
                          {groupInfo.isMultiRoom && ` Across ${groupInfo.rooms.length} rooms.`}
                          {groupInfo.isRecurring && ` On ${groupInfo.dates.length} dates.`}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 p-3 border rounded-md bg-background flex-1">
                      <Checkbox
                        id="updateGroup"
                        checked={updateGroup}
                        onCheckedChange={(checked) => setUpdateGroup(checked === true)}
                        data-testid="checkbox-update-group"
                      />
                      <Label 
                        htmlFor="updateGroup" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Apply changes to all {groupInfo.count} bookings in this series
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSeriesView(true)}
                      className="gap-2"
                    >
                      <List className="w-4 h-4" />
                      View Series
                    </Button>
                  </div>
                </div>
              );
            })()}

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-booking-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} data-testid="input-booking-start-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} data-testid="input-booking-end-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} data-testid="input-booking-purpose" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="attendees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Attendees</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} data-testid="input-booking-attendees" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-booking-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "private"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-booking-visibility">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Recurrence options - show "Make Recurring" for single bookings, "Extend Recurring" for existing recurring bookings */}
            {(() => {
              const groupInfo = getBookingGroupInfo();
              const canMakeRecurring = !groupInfo || (groupInfo.count === 1 && !groupInfo.isRecurring);
              // For recurring bookings, check if it's a recurring series (multiple unique dates)
              // If it's a recurring series, show extend feature (recurrencePattern/EndDate are optional - they may not be set)
              const isExistingRecurring = groupInfo && groupInfo.isRecurring && groupInfo.count > 1;
              
              if (!canMakeRecurring && !isExistingRecurring) return null;
              
              // Get the parent booking to access recurrence fields for pre-population
              const parentBooking = groupInfo?.parentBooking || booking;
              
              const selectedDate = booking ? normalizeDate(booking.date) : new Date();
              const minRecurrenceEndDate = format(addDays(selectedDate, 1), 'yyyy-MM-dd');
              const maxRecurrenceEndDate = format(addMonths(selectedDate, 12), 'yyyy-MM-dd');
              
              // For existing recurring bookings, set min date to day after current end date
              // Use parentBooking's recurrenceEndDate if available, otherwise use the latest date in the series
              let currentEndDate = selectedDate;
              if (isExistingRecurring && parentBooking?.recurrenceEndDate) {
                currentEndDate = normalizeDate(parentBooking.recurrenceEndDate);
              } else if (isExistingRecurring && groupInfo) {
                // Find the latest date in the existing series
                const groupBookings = allBookings.filter(b => b.bookingGroupId === booking.bookingGroupId);
                const latestDate = groupBookings.reduce((latest, b) => {
                  const bookingDate = normalizeDate(b.date);
                  return bookingDate > latest ? bookingDate : latest;
                }, normalizeDate(booking.date));
                currentEndDate = latestDate;
              }
              const minExtendDate = isExistingRecurring 
                ? format(addDays(currentEndDate, 1), 'yyyy-MM-dd')
                : minRecurrenceEndDate;
              
              return (
                <div className="space-y-2 pt-2 border-t">
                  {isExistingRecurring ? (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="extendRecurring" className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <Repeat className="w-4 h-4" />
                        Extend Recurring Booking
                      </Label>
                      <Switch
                        id="extendRecurring"
                        checked={extendRecurring}
                        onCheckedChange={(checked) => setExtendRecurring(checked)}
                        data-testid="switch-extend-recurring"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="recurring" className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <Repeat className="w-4 h-4" />
                        Make Recurring Booking
                      </Label>
                      <Switch
                        id="recurring"
                        checked={isRecurring}
                        onCheckedChange={(checked) => setIsRecurring(checked)}
                        data-testid="switch-recurring"
                      />
                    </div>
                  )}
                  
                  {((isRecurring && canMakeRecurring) || (extendRecurring && isExistingRecurring)) && (
                    <div className="space-y-2 pt-2">
                      {canMakeRecurring && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="recurrencePattern" className="text-xs">Repeat <span className="text-destructive">*</span></Label>
                            <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                              <SelectTrigger className="h-9 text-sm" data-testid="select-recurrence-pattern">
                                <SelectValue placeholder="Select pattern" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      
                      <div className={canMakeRecurring ? "space-y-1.5" : "space-y-1.5"}>
                        <Label htmlFor="recurrenceEndDate" className="text-xs">
                          {isExistingRecurring ? "Extend Until" : "Until"} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="recurrenceEndDate"
                          type="date"
                          className="h-9 text-sm"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          min={minExtendDate}
                          max={maxRecurrenceEndDate}
                          required={(isRecurring && canMakeRecurring) || extendRecurring}
                          data-testid="input-recurrence-end-date"
                        />
                      </div>

                      {/* Day selection for weekly recurring - only show for new recurring, not extensions */}
                      {canMakeRecurring && recurrencePattern === 'weekly' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Select Days</Label>
                          <div className="grid grid-cols-7 gap-1">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleDayToggle(index)}
                                className={`h-8 text-xs rounded-md border transition-colors ${
                                  recurrenceDays.includes(index)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-accent'
                                }`}
                                data-testid={`button-day-${day.toLowerCase()}`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {recurrenceDays.length === 0 
                              ? 'No days selected - will repeat on the same day each week'
                              : `Selected: ${recurrenceDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
                            }
                          </p>
                        </div>
                      )}

                      {/* Week and day selection for monthly recurring - only show for new recurring, not extensions */}
                      {canMakeRecurring && recurrencePattern === 'monthly' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Monthly Pattern</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="weekOfMonth" className="text-xs">Week</Label>
                              <Select 
                                value={recurrenceWeekOfMonth.toString()} 
                                onValueChange={(value) => setRecurrenceWeekOfMonth(parseInt(value))}
                              >
                                <SelectTrigger className="h-9 text-sm" data-testid="select-week-of-month">
                                  <SelectValue placeholder="Select week" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">First</SelectItem>
                                  <SelectItem value="2">Second</SelectItem>
                                  <SelectItem value="3">Third</SelectItem>
                                  <SelectItem value="4">Fourth</SelectItem>
                                  <SelectItem value="5">Last</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="dayOfWeek" className="text-xs">Day</Label>
                              <Select 
                                value={recurrenceDayOfWeek.toString()} 
                                onValueChange={(value) => setRecurrenceDayOfWeek(parseInt(value))}
                              >
                                <SelectTrigger className="h-9 text-sm" data-testid="select-day-of-week">
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">Sunday</SelectItem>
                                  <SelectItem value="1">Monday</SelectItem>
                                  <SelectItem value="2">Tuesday</SelectItem>
                                  <SelectItem value="3">Wednesday</SelectItem>
                                  <SelectItem value="4">Thursday</SelectItem>
                                  <SelectItem value="5">Friday</SelectItem>
                                  <SelectItem value="6">Saturday</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Will repeat on the {['first', 'second', 'third', 'fourth', 'last'][recurrenceWeekOfMonth - 1]} {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][recurrenceDayOfWeek]} of each month
                          </p>
                        </div>
                      )}
                      
                      {recurrenceEndDate && (
                        <p className="text-xs text-muted-foreground">
                          {isExistingRecurring && extendRecurring ? (
                            <>
                              Will add <span className="font-medium text-foreground">{calculateAdditionalOccurrences()}</span> additional booking{calculateAdditionalOccurrences() !== 1 ? 's' : ''} to the series
                            </>
                          ) : (
                            <>
                              Will create <span className="font-medium text-foreground">{calculateOccurrences()}</span> booking{calculateOccurrences() > 1 ? 's' : ''} ({recurrencePattern})
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <FormField
              control={form.control}
              name="adminNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Notes (Private)</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={3} 
                      placeholder="Internal notes only visible to admins..."
                      {...field} 
                      data-testid="input-admin-notes" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            </div>
            
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending || ((isRecurring && !recurrenceEndDate) || (extendRecurring && !recurrenceEndDate))} 
                data-testid="button-save-booking"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {extendRecurring ? `Extend Series (+${calculateAdditionalOccurrences()} bookings)` : isRecurring ? `Save ${calculateOccurrences()} Bookings` : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        
        <BookingSeriesViewDialog
          booking={booking}
          open={showSeriesView}
          onOpenChange={setShowSeriesView}
          onEditBooking={(editedBooking) => {
            // When a booking is clicked in the series view, close the series view
            // and notify parent to update the booking being edited
            setShowSeriesView(false);
            if (onBookingChange) {
              onBookingChange(editedBooking);
            }
          }}
          onExtendRecurring={(parentBooking) => {
            // When extend recurring is clicked, close the series view
            // and switch to editing the parent booking with extend mode enabled
            setShowSeriesView(false);
            // Set flag to extend - this will be applied in useEffect when booking changes
            shouldExtendRef.current = true;
            if (onBookingChange) {
              // Change to the parent booking - this will trigger useEffect
              onBookingChange(parentBooking);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
