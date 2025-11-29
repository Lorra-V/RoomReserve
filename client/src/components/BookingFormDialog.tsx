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
import { Calendar, Clock, Package, Repeat } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import type { AdditionalItem } from "@shared/schema";

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  selectedDate: Date;
  selectedTime: string;
  availableTimeSlots: string[];
  onSubmit: (data: { 
    startTime: string; 
    endTime: string; 
    eventName: string; 
    purpose: string; 
    attendees: number; 
    selectedItems: string[];
    isRecurring?: boolean;
    recurrencePattern?: string;
    recurrenceEndDate?: Date;
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
  onSubmit,
}: BookingFormDialogProps) {
  const [startTime, setStartTime] = useState(selectedTime);
  const [endTime, setEndTime] = useState("");
  const [eventName, setEventName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("");
  // Quantity per additional item id
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<string>("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");

  const { data: additionalItems = [] } = useQuery<AdditionalItem[]>({
    queryKey: ["/api/additional-items"],
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const currency = (settings as any)?.currency || "TTD";
  const currencySymbol = currencySymbols[currency] || currency;

  useEffect(() => {
    setStartTime(selectedTime);
    const startIndex = availableTimeSlots.indexOf(selectedTime);
    if (startIndex >= 0 && startIndex < availableTimeSlots.length - 1) {
      setEndTime(availableTimeSlots[startIndex + 1]);
    }
  }, [selectedTime, availableTimeSlots]);

  // Reset form state when dialog opens/closes or when selecting a different slot
  useEffect(() => {
    if (open) {
      // Reset transient form state when dialog opens
      setEventName("");
      setPurpose("");
      setAttendees("");
      setItemQuantities({});
      setIsRecurring(false);
      setRecurrencePattern("weekly");
      setRecurrenceEndDate("");
    }
  }, [open, selectedDate, selectedTime]);

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

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
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
      startTime, 
      endTime,
      eventName,
      purpose, 
      attendees: parseInt(attendees) || 1,
      selectedItems,
      isRecurring,
      recurrencePattern: isRecurring ? recurrencePattern : undefined,
      recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate) : undefined,
    });
    setEventName("");
    setPurpose("");
    setAttendees("");
    setItemQuantities({});
    setIsRecurring(false);
    setRecurrencePattern("weekly");
    setRecurrenceEndDate("");
  };

  // Calculate minimum end date for recurring (1 day after selected date)
  const minRecurrenceEndDate = format(addDays(selectedDate, 1), 'yyyy-MM-dd');
  
  // Calculate max end date (6 months from selected date for reasonable limits)
  const maxRecurrenceEndDate = format(addMonths(selectedDate, 6), 'yyyy-MM-dd');

  // Calculate how many occurrences will be created
  const calculateOccurrences = () => {
    if (!isRecurring || !recurrenceEndDate) return 0;
    const endDate = new Date(recurrenceEndDate);
    let count = 0;
    let currentDate = new Date(selectedDate);
    
    while (currentDate <= endDate) {
      count++;
      if (recurrencePattern === 'daily') {
        currentDate = addDays(currentDate, 1);
      } else if (recurrencePattern === 'weekly') {
        currentDate = addWeeks(currentDate, 1);
      } else if (recurrencePattern === 'monthly') {
        currentDate = addMonths(currentDate, 1);
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
                <Label className="text-xs text-muted-foreground">Date</Label>
                <div className="flex items-center gap-2 text-sm bg-muted px-2.5 py-2 rounded-md">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">{format(selectedDate, 'MMM dd, yyyy')}</span>
                </div>
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
                <Select value={endTime} onValueChange={setEndTime}>
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
                  onCheckedChange={setIsRecurring}
                  data-testid="switch-recurring"
                />
              </div>
              
              {isRecurring && (
                <div className="space-y-2 pt-2 border-t">
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
