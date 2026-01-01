import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Clock, Package, Repeat } from "lucide-react";
import { format, addDays, addWeeks, addMonths, startOfToday, isSameDay, startOfMonth, getDay, parseISO, startOfDay } from "date-fns";
import type { AdditionalItem, Booking } from "@shared/schema";
import { useFormattedDate } from "@/hooks/useFormattedDate";

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  selectedDate: Date;
  selectedTime: string;
  availableTimeSlots: string[];
  bookings?: Booking[];
  onSubmit: (data: { 
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
    recurrenceDays?: string[];
    recurrenceWeekOfMonth?: number;
    recurrenceDayOfWeek?: number;
  }) => void;
}

const currencySymbols: Record<string, string> = {
  TTD: "TT$",
  USD: "$",
  JMD: "J$",
  BBD: "Bds$",
  XCD: "EC$",
};

export default function BookingFormDialog({
  open,
  onOpenChange,
  roomName,
  selectedDate,
  selectedTime,
  availableTimeSlots,
  bookings = [],
  onSubmit,
}: BookingFormDialogProps) {
  const formatDate = useFormattedDate();
  const [selectedBookingDate, setSelectedBookingDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState(selectedTime);
  const [endTime, setEndTime] = useState("");
  const [eventName, setEventName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  // Quantity per additional item id
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<string>("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceWeekOfMonth, setRecurrenceWeekOfMonth] = useState<number>(1);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(0);
  const [conflictError, setConflictError] = useState<string>("");

  const { data: additionalItems = [] } = useQuery<AdditionalItem[]>({
    queryKey: ["/api/additional-items"],
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const currency = (settings as any)?.currency || "TTD";
  const currencySymbol = currencySymbols[currency] || currency;

  // Normalize date to local date only (ignore time/timezone)
  const normalizeDate = (date: Date | string): Date => {
    const d = typeof date === 'string' ? parseISO(date.split('T')[0]) : date;
    const dateStr = format(d, 'yyyy-MM-dd');
    return startOfDay(parseISO(dateStr));
  };

  useEffect(() => {
    const today = startOfToday();
    // Normalize the selected date to avoid timezone issues
    const normalizedSelectedDate = normalizeDate(selectedDate);
    // Ensure the selected date is not in the past
    const validDate = normalizedSelectedDate < today ? today : normalizedSelectedDate;
    setSelectedBookingDate(validDate);
    setStartTime(selectedTime);
    const startIndex = availableTimeSlots.indexOf(selectedTime);
    if (startIndex >= 0 && startIndex < availableTimeSlots.length - 1) {
      setEndTime(availableTimeSlots[startIndex + 1]);
    }
  }, [selectedTime, selectedDate, availableTimeSlots]);

  // Reset form state when dialog opens/closes or when selecting a different slot
  useEffect(() => {
    if (open) {
      // Reset transient form state when dialog opens
      setEventName("");
      setPurpose("");
      setAttendees("");
      setVisibility("private");
      setItemQuantities({});
      setIsRecurring(false);
      setRecurrencePattern("weekly");
      setRecurrenceEndDate("");
      setRecurrenceDays([]);
      setRecurrenceWeekOfMonth(1);
      setRecurrenceDayOfWeek(0);
      setConflictError("");
      // Ensure the selected time is set when dialog opens
      setStartTime(selectedTime);
      const startIndex = availableTimeSlots.indexOf(selectedTime);
      if (startIndex >= 0 && startIndex < availableTimeSlots.length - 1) {
        setEndTime(availableTimeSlots[startIndex + 1]);
      }
    }
  }, [open, selectedDate, selectedTime, availableTimeSlots]);

  const handleQuantityChange = (itemId: string, value: string) => {
    const qty = Math.max(0, parseInt(value || "0", 10) || 0);
    setItemQuantities((prev) => {
      const next = { ...prev };
      if (qty === 0) {
        delete next[itemId];
      } else {
        next[itemId] = qty;
      }
      return next;
    });
  };

  const getEndTimeOptions = () => {
    const startIndex = availableTimeSlots.indexOf(startTime);
    if (startIndex < 0) return [];
    return availableTimeSlots.slice(startIndex + 1);
  };

  // Convert 12-hour time to 24-hour time
  const convertTo24Hour = (time12h: string): string => {
    const [timePart, period] = time12h.split(' ');
    const [hourStr, minute] = timePart.split(':');
    let hour = parseInt(hourStr);
    
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  };

  // Check if a time slot conflicts with existing bookings
  const checkConflict = (date: Date, startTime24: string, endTime24: string): boolean => {
    const normalizedDate = normalizeDate(date);
    
    return bookings.some(booking => {
      // Only check confirmed or pending bookings (not cancelled)
      if (booking.status === "cancelled") return false;
      
      // Normalize booking date to avoid timezone issues
      const bookingDate = normalizeDate(booking.date);
      if (!isSameDay(bookingDate, normalizedDate)) return false;
      
      // Check if time slots overlap
      const bookingStart = booking.startTime;
      const bookingEnd = booking.endTime;
      
      // Time slots overlap if: start < other.end AND end > other.start
      return startTime24 < bookingEnd && endTime24 > bookingStart;
    });
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    setConflictError(""); // Clear conflict error when time changes
    const startIndex = availableTimeSlots.indexOf(value);
    if (startIndex >= 0 && startIndex < availableTimeSlots.length - 1) {
      setEndTime(availableTimeSlots[startIndex + 1]);
    } else {
      setEndTime("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) return;
    if (isRecurring && !recurrenceEndDate) return;

    // Convert times to 24-hour format for conflict checking
    const startTime24 = convertTo24Hour(startTime);
    const endTime24 = convertTo24Hour(endTime);

    // Check for conflicts
    if (checkConflict(selectedBookingDate, startTime24, endTime24)) {
      setConflictError("This time slot is unavailable. Please select a different time.");
      return;
    }

    // Check for conflicts in recurring bookings
    if (isRecurring && recurrenceEndDate) {
      const endDate = normalizeDate(recurrenceEndDate);
      let currentDate = normalizeDate(selectedBookingDate);
      const conflictingDates: Date[] = [];
      
      while (currentDate <= endDate) {
        let shouldCheck = true;
        
        // For weekly pattern with specific days selected, only check those days
        if (recurrencePattern === 'weekly' && recurrenceDays.length > 0) {
          const dayOfWeek = currentDate.getDay();
          shouldCheck = recurrenceDays.includes(dayOfWeek);
        }
        
        if (shouldCheck && checkConflict(currentDate, startTime24, endTime24)) {
          conflictingDates.push(new Date(currentDate));
        }
        
        // Move to next occurrence
        if (recurrencePattern === 'daily') {
          currentDate = addDays(currentDate, 1);
        } else if (recurrencePattern === 'weekly') {
          if (recurrenceDays.length > 0) {
            // Move to next selected day
            currentDate = addDays(currentDate, 1);
          } else {
            // Default: same day next week
            currentDate = addWeeks(currentDate, 1);
          }
        } else if (recurrencePattern === 'monthly') {
          // Move to next month
          currentDate = addMonths(currentDate, 1);
          
          // For monthly by week (e.g., "second Saturday"), calculate the specific date
          if (recurrenceWeekOfMonth && recurrenceDayOfWeek !== undefined) {
            const nthDay = getNthDayOfMonth(currentDate, recurrenceWeekOfMonth, recurrenceDayOfWeek);
            if (nthDay) {
              currentDate = nthDay;
            }
          }
        }
      }
      
      if (conflictingDates.length > 0) {
        const datesStr = conflictingDates.map(d => formatDate(d)).join(', ');
        setConflictError(`Unavailable on: ${datesStr}. Please adjust your booking dates or times.`);
        return;
      }
    }

    setConflictError(""); // Clear any previous errors

    // Build human-readable selected items with quantities and line totals
    const selectedItems: string[] = additionalItems
      .map((item) => {
        const qty = itemQuantities[item.id] ?? 0;
        if (qty <= 0) return null;
        const price = parseFloat(item.price || "0");
        const lineTotal = price * qty;
        const priceLabel =
          price === 0
            ? "Free"
            : `${currencySymbol}${price.toFixed(2)} each`;
        const totalLabel =
          price === 0
            ? ""
            : `, total ${currencySymbol}${lineTotal.toFixed(2)}`;
        return `${item.name} x ${qty} (${priceLabel}${totalLabel})`;
      })
      .filter((v): v is string => v !== null);

    onSubmit({ 
      date: selectedBookingDate,
      startTime, 
      endTime,
      eventName,
      purpose, 
      attendees: parseInt(attendees) || 1,
      selectedItems,
      visibility,
      isRecurring,
      recurrencePattern: isRecurring ? recurrencePattern : undefined,
      recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate) : undefined,
      recurrenceDays: isRecurring && recurrencePattern === 'weekly' && recurrenceDays.length > 0 ? recurrenceDays.map(String) : undefined,
      recurrenceWeekOfMonth: isRecurring && recurrencePattern === 'monthly' ? recurrenceWeekOfMonth : undefined,
      recurrenceDayOfWeek: isRecurring && recurrencePattern === 'monthly' ? recurrenceDayOfWeek : undefined,
    });
    setEventName("");
    setPurpose("");
    setAttendees("");
    setVisibility("private");
    setItemQuantities({});
    setIsRecurring(false);
    setRecurrencePattern("weekly");
    setRecurrenceEndDate("");
  };

  // Calculate minimum end date for recurring (1 day after selected date)
  const minRecurrenceEndDate = format(addDays(selectedBookingDate, 1), 'yyyy-MM-dd');
  
  // Calculate max end date (1 year from selected date for reasonable limits)
  const maxRecurrenceEndDate = format(addMonths(selectedBookingDate, 12), 'yyyy-MM-dd');

  const handleDayToggle = (day: number) => {
    setRecurrenceDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  // Helper function to get the nth occurrence of a day in a month
  const getNthDayOfMonth = (date: Date, weekOfMonth: number, dayOfWeek: number): Date | null => {
    const firstDay = startOfMonth(date);
    const firstDayOfWeek = getDay(firstDay);
    
    // Calculate days to add to get to the first occurrence of the target day
    let daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7;
    
    // Special case: "last" occurrence (weekOfMonth === 5)
    if (weekOfMonth === 5) {
      // Start from the last day of the month and work backwards
      const nextMonth = addMonths(firstDay, 1);
      const lastDay = addDays(nextMonth, -1);
      const lastDayOfWeek = getDay(lastDay);
      const daysBack = (lastDayOfWeek - dayOfWeek + 7) % 7;
      return addDays(lastDay, -daysBack);
    }
    
    // Add weeks to get to the nth occurrence
    daysToAdd += (weekOfMonth - 1) * 7;
    const targetDate = addDays(firstDay, daysToAdd);
    
    // Verify the date is still in the same month
    if (targetDate.getMonth() !== date.getMonth()) {
      return null; // This occurrence doesn't exist in this month
    }
    
    return targetDate;
  };

  // Calculate how many occurrences will be created
  const calculateOccurrences = () => {
    if (!isRecurring || !recurrenceEndDate) return 0;
    const endDate = normalizeDate(recurrenceEndDate);
    let count = 0;
    let currentDate = normalizeDate(selectedBookingDate);
    
    while (currentDate <= endDate) {
      if (recurrencePattern === 'daily') {
        count++;
        currentDate = addDays(currentDate, 1);
      } else if (recurrencePattern === 'weekly') {
        if (recurrenceDays.length > 0) {
          // Count only selected days
          const dayOfWeek = currentDate.getDay();
          if (recurrenceDays.includes(dayOfWeek)) {
            count++;
          }
          currentDate = addDays(currentDate, 1);
        } else {
          // Default: same day every week
          count++;
          currentDate = addWeeks(currentDate, 1);
        }
      } else if (recurrencePattern === 'monthly') {
        count++;
        // Move to next month
        currentDate = addMonths(currentDate, 1);
        
        // For monthly by week (e.g., "second Saturday"), calculate the specific date
        if (recurrenceWeekOfMonth && recurrenceDayOfWeek !== undefined) {
          const nthDay = getNthDayOfMonth(currentDate, recurrenceWeekOfMonth, recurrenceDayOfWeek);
          if (nthDay) {
            currentDate = nthDay;
          } else {
            // Skip this month if the occurrence doesn't exist
            continue;
          }
        }
      }
    }
    return count;
  };

  const additionalItemsTotal = additionalItems.reduce((sum, item) => {
    const qty = itemQuantities[item.id] ?? 0;
    if (qty <= 0) return sum;
    const price = parseFloat(item.price || "0");
    return sum + price * qty;
  }, 0);

  const endTimeOptions = getEndTimeOptions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Book {roomName}</DialogTitle>
          <DialogDescription>
            Complete the form below to submit your booking request
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-3 py-4 overflow-y-auto flex-1 pr-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bookingDate" className="text-xs">Date <span className="text-destructive">*</span></Label>
                <Input
                  id="bookingDate"
                  type="date"
                  className="h-9 text-sm"
                  value={format(selectedBookingDate, 'yyyy-MM-dd')}
                  min={format(startOfToday(), 'yyyy-MM-dd')}
                  onChange={(e) => {
                    if (e.target.value) {
                      // Parse the date string and normalize it to avoid timezone issues
                      const newDate = normalizeDate(e.target.value);
                      // Ensure the selected date is not in the past
                      const today = startOfToday();
                      if (newDate < today) {
                        setSelectedBookingDate(today);
                      } else {
                        setSelectedBookingDate(newDate);
                      }
                      setConflictError(""); // Clear conflict error when date changes
                    }
                  }}
                  required
                  data-testid="input-booking-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startTime" className="text-xs">From <span className="text-destructive">*</span></Label>
                <Select value={startTime} onValueChange={handleStartTimeChange}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-start-time">
                    <Clock className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimeSlots.slice(0, -1).map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="endTime" className="text-xs">To <span className="text-destructive">*</span></Label>
                <Select value={endTime} onValueChange={(value) => {
                  setEndTime(value);
                  setConflictError(""); // Clear conflict error when time changes
                }}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-end-time">
                    <Clock className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="End time" />
                  </SelectTrigger>
                  <SelectContent>
                    {endTimeOptions.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {conflictError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                {conflictError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eventName" className="text-xs">Event Name <span className="text-destructive">*</span></Label>
                <Input
                  id="eventName"
                  className="h-9 text-sm"
                  placeholder="e.g., Annual Board Meeting..."
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  required
                  data-testid="input-event-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="attendees" className="text-xs">Attendees <span className="text-destructive">*</span></Label>
                <Input
                  id="attendees"
                  type="number"
                  min="1"
                  className="h-9 text-sm"
                  placeholder="e.g., 5"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  required
                  data-testid="input-attendees"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visibility" className="text-xs">Visibility <span className="text-destructive">*</span></Label>
              <Select value={visibility} onValueChange={(value: "private" | "public") => setVisibility(value)}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-visibility">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purpose" className="text-xs">Description <span className="text-destructive">*</span></Label>
              <Textarea
                id="purpose"
                className="text-sm min-h-[60px] resize-none"
                placeholder="Describe your event, any special requirements..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                data-testid="input-description"
              />
            </div>

            {additionalItems.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Package className="w-3.5 h-3.5" />
                  Additional Items (optional)
                </Label>
                <div className="space-y-1.5 border rounded-md p-2.5 bg-muted/30 max-h-[180px] overflow-y-auto">
                  {additionalItems.map((item) => {
                    const qty = itemQuantities[item.id] ?? 0;
                    const price = parseFloat(item.price || "0");
                    const lineTotal = qty > 0 ? price * qty : 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate">{item.name}</span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {price === 0 ? "Free" : `${currencySymbol}${price.toFixed(2)}`}
                            </span>
                          </div>
                          {item.description && (
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {item.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            className="w-16 h-7 text-right text-xs px-1.5"
                            value={qty === 0 ? "" : qty}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            placeholder="0"
                            data-testid={`input-item-qty-${item.id}`}
                          />
                          {lineTotal > 0 && (
                            <span className="text-xs font-medium w-14 text-right">
                              {currencySymbol}{lineTotal.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs pt-0.5 border-t">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    {additionalItemsTotal === 0
                      ? "—"
                      : `${currencySymbol}${additionalItemsTotal.toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 border rounded-md p-2.5 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurring" className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <Repeat className="w-3.5 h-3.5" />
                  Recurring Booking
                </Label>
                <Switch
                  id="recurring"
                  checked={isRecurring}
                  onCheckedChange={(checked) => {
                    setIsRecurring(checked);
                    setConflictError(""); // Clear conflict error when recurring changes
                  }}
                  data-testid="switch-recurring"
                />
              </div>
              
              {isRecurring && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="recurrencePattern" className="text-xs">Repeat <span className="text-destructive">*</span></Label>
                      <Select value={recurrencePattern} onValueChange={(value) => {
                        setRecurrencePattern(value);
                        setConflictError(""); // Clear conflict error when pattern changes
                      }}>
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
                        onChange={(e) => {
                          setRecurrenceEndDate(e.target.value);
                          setConflictError(""); // Clear conflict error when end date changes
                        }}
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
          </div>
          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!startTime || !endTime || (isRecurring && !recurrenceEndDate)} 
              data-testid="button-submit"
            >
              {isRecurring ? `Submit ${calculateOccurrences()} Bookings` : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
