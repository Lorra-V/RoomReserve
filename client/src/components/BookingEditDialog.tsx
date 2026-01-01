import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { format, parseISO, startOfDay, addDays, addMonths, getDay, startOfMonth } from "date-fns";
import type { BookingWithMeta, Room } from "@shared/schema";
import { formatDisplayDate } from "@/lib/utils";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import BookingSeriesViewDialog from "./BookingSeriesViewDialog";
import { Switch } from "@/components/ui/switch";

const bookingEditSchema = z.object({
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

interface BookingEditDialogProps {
  booking: BookingWithMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingChange?: (booking: BookingWithMeta) => void;
}

export default function BookingEditDialog({ booking, open, onOpenChange, onBookingChange }: BookingEditDialogProps) {
  const formatDate = useFormattedDate();
  const { toast } = useToast();
  const [updateGroup, setUpdateGroup] = useState(false);
  const [showSeriesView, setShowSeriesView] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<string>("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceWeekOfMonth, setRecurrenceWeekOfMonth] = useState<number>(1);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(0);

  // Get all bookings to check for group
  const { data: allBookings = [] } = useQuery<BookingWithMeta[]>({
    queryKey: ["/api/bookings"],
  });

  const form = useForm<BookingEditFormData>({
    resolver: zodResolver(bookingEditSchema),
    defaultValues: {
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
  const normalizeDate = (date: Date | string): Date => {
    const d = typeof date === 'string' ? parseISO(date.split('T')[0]) : date;
    const dateStr = format(d, 'yyyy-MM-dd');
    return startOfDay(parseISO(dateStr));
  };

  useEffect(() => {
    if (booking) {
      // Normalize the date to avoid timezone shifts
      const normalizedDate = normalizeDate(booking.date);
      form.reset({
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
      setIsRecurring(false);
      setRecurrencePattern("weekly");
      setRecurrenceEndDate("");
      setRecurrenceDays([]);
      setRecurrenceWeekOfMonth(1);
      setRecurrenceDayOfWeek(0);
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
    const uniqueRooms = [...new Set(groupBookings.map(b => b.roomName))];
    const uniqueDates = [...new Set(groupBookings.map(b => formatDate(b.date)))];
    
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
    mutationFn: async (data: BookingEditFormData & { updateGroup?: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/bookings/${booking?.id}`, data);
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update booking. Please try again.",
        variant: "destructive",
      });
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
    
    updateMutation.mutate({ 
      ...data, 
      updateGroup,
      isRecurring: canMakeRecurring ? isRecurring : false,
      recurrencePattern: canMakeRecurring && isRecurring ? recurrencePattern : undefined,
      recurrenceEndDate: canMakeRecurring && isRecurring && recurrenceEndDate ? recurrenceEndDate : undefined,
      recurrenceDays: canMakeRecurring && isRecurring && recurrencePattern === 'weekly' && recurrenceDays.length > 0 ? recurrenceDays.map(String) : undefined,
      recurrenceWeekOfMonth: canMakeRecurring && isRecurring && recurrencePattern === 'monthly' ? recurrenceWeekOfMonth : undefined,
      recurrenceDayOfWeek: canMakeRecurring && isRecurring && recurrencePattern === 'monthly' ? recurrenceDayOfWeek : undefined,
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Room</span>
                <span className="font-medium">{booking.roomName}</span>
              </div>
            </div>

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

            {/* Recurrence options - only show if booking is NOT already part of a recurring series */}
            {(() => {
              const groupInfo = getBookingGroupInfo();
              const canMakeRecurring = !groupInfo || (groupInfo.count === 1 && !groupInfo.isRecurring);
              
              if (!canMakeRecurring) return null;
              
              const selectedDate = booking ? normalizeDate(booking.date) : new Date();
              const minRecurrenceEndDate = format(addDays(selectedDate, 1), 'yyyy-MM-dd');
              const maxRecurrenceEndDate = format(addMonths(selectedDate, 12), 'yyyy-MM-dd');
              
              return (
                <div className="space-y-2 pt-2 border-t">
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
                  
                  {isRecurring && (
                    <div className="space-y-2 pt-2">
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
                        
                        <div className="space-y-1.5">
                          <Label htmlFor="recurrenceEndDate" className="text-xs">Until <span className="text-destructive">*</span></Label>
                          <Input
                            id="recurrenceEndDate"
                            type="date"
                            className="h-9 text-sm"
                            value={recurrenceEndDate}
                            onChange={(e) => setRecurrenceEndDate(e.target.value)}
                            min={minRecurrenceEndDate}
                            max={maxRecurrenceEndDate}
                            required={isRecurring}
                            data-testid="input-recurrence-end-date"
                          />
                        </div>
                      </div>

                      {/* Day selection for weekly recurring */}
                      {recurrencePattern === 'weekly' && (
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

                      {/* Week and day selection for monthly recurring */}
                      {recurrencePattern === 'monthly' && (
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
                          Will create <span className="font-medium text-foreground">{calculateOccurrences()}</span> booking{calculateOccurrences() > 1 ? 's' : ''} ({recurrencePattern})
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
                disabled={updateMutation.isPending || (isRecurring && !recurrenceEndDate)} 
                data-testid="button-save-booking"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isRecurring ? `Save ${calculateOccurrences()} Bookings` : 'Save Changes'}
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
        />
      </DialogContent>
    </Dialog>
  );
}
