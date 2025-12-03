import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, Repeat, User, Building } from "lucide-react";
import { format, addDays, addWeeks, addMonths, startOfMonth, getDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Room, User as UserType } from "@shared/schema";

interface AdminCreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIME_SLOTS = [
  "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
  "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"
];

export default function AdminCreateBookingDialog({
  open,
  onOpenChange,
}: AdminCreateBookingDialogProps) {
  const { toast } = useToast();
  
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomName, setRoomName] = useState<string>("");
  const [isDuplicatingRoom, setIsDuplicatingRoom] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState<string>("09:00 AM");
  const [endTime, setEndTime] = useState<string>("10:00 AM");
  const [eventName, setEventName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<string>("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceWeekOfMonth, setRecurrenceWeekOfMonth] = useState<number>(1);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(0);

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/rooms", data);
      return response.json();
    },
    onSuccess: async (room: Room) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setSelectedRooms([room.id]);
      setIsDuplicatingRoom(false);
      
      // If we were creating a booking, create it now with the new room
      if (selectedUser && startTime && endTime && selectedDate && eventName && purpose && attendees) {
        const startTime24 = convertTo24Hour(startTime);
        const endTime24 = convertTo24Hour(endTime);
        
        createBookingMutation.mutate({
          roomId: room.id,
          userId: selectedUser,
          date: new Date(selectedDate),
          startTime: startTime24,
          endTime: endTime24,
          eventName,
          purpose,
          attendees: parseInt(attendees) || 1,
          visibility,
          selectedItems: [],
          isRecurring,
          recurrencePattern: isRecurring ? recurrencePattern : undefined,
          recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate) : undefined,
        });
      } else {
        toast({
          title: "Room duplicated",
          description: `Room "${room.name}" has been created successfully.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create room",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: customers = [] } = useQuery<UserType[]>({
    queryKey: ["/api/admin/customers"],
  });

  const activeRooms = rooms.filter(r => r.isActive);

  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/bookings", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    },
    onError: (error: Error) => {
      throw error;
    },
  });

  const resetForm = () => {
    setSelectedRooms([]);
    setRoomName("");
    setIsDuplicatingRoom(false);
    setSelectedUser("");
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime("09:00 AM");
    setEndTime("10:00 AM");
    setEventName("");
    setPurpose("");
    setAttendees("");
    setVisibility("private");
    setAdminNotes("");
    setIsRecurring(false);
    setRecurrencePattern("weekly");
    setRecurrenceEndDate("");
    setRecurrenceDays([]);
    setRecurrenceWeekOfMonth(1);
    setRecurrenceDayOfWeek(0);
  };

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const convertTo24Hour = (time12h: string): string => {
    const [timePart, period] = time12h.split(' ');
    const [hourStr, minute] = timePart.split(':');
    let hour = parseInt(hourStr);
    
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  };

  const getEndTimeOptions = () => {
    const startIndex = TIME_SLOTS.indexOf(startTime);
    if (startIndex < 0) return [];
    return TIME_SLOTS.slice(startIndex + 1);
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    const startIndex = TIME_SLOTS.indexOf(value);
    if (startIndex >= 0 && startIndex < TIME_SLOTS.length - 1) {
      setEndTime(TIME_SLOTS[startIndex + 1]);
    } else {
      setEndTime("");
    }
  };

  const handleRoomToggle = (roomId: string) => {
    setSelectedRooms(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRooms.length === 0 || !selectedUser || !startTime || !endTime || !selectedDate) return;
    if (isRecurring && !recurrenceEndDate) return;

    const startTime24 = convertTo24Hour(startTime);
    const endTime24 = convertTo24Hour(endTime);

    try {
      // Generate a unique booking group ID for multi-room bookings
      const bookingGroupId = selectedRooms.length > 1 ? crypto.randomUUID() : undefined;
      
      // Create bookings for each selected room
      const bookingPromises = selectedRooms.map(roomId => 
        apiRequest("POST", "/api/admin/bookings", {
          roomId,
          userId: selectedUser,
          date: new Date(selectedDate),
          startTime: startTime24,
          endTime: endTime24,
          eventName,
          purpose,
          attendees: parseInt(attendees) || 1,
          visibility,
          selectedItems: [],
          isRecurring,
          recurrencePattern: isRecurring ? recurrencePattern : undefined,
          recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate) : undefined,
          recurrenceDays: isRecurring && recurrencePattern === 'weekly' && recurrenceDays.length > 0 ? recurrenceDays.map(String) : undefined,
          recurrenceWeekOfMonth: isRecurring && recurrencePattern === 'monthly' ? recurrenceWeekOfMonth : undefined,
          recurrenceDayOfWeek: isRecurring && recurrencePattern === 'monthly' ? recurrenceDayOfWeek : undefined,
          bookingGroupId,
          adminNotes: adminNotes || undefined,
        })
      );

      await Promise.all(bookingPromises);
      
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Bookings created",
        description: `Successfully created ${selectedRooms.length} booking${selectedRooms.length > 1 ? 's' : ''} ${isRecurring ? '(recurring)' : ''}.`,
      });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Failed to create bookings",
        description: error.message || "Some bookings may have been created. Please check the bookings list.",
        variant: "destructive",
      });
    }
  };


  const minRecurrenceEndDate = format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd');
  const maxRecurrenceEndDate = format(addMonths(new Date(selectedDate), 6), 'yyyy-MM-dd');

  const calculateOccurrences = () => {
    if (!isRecurring || !recurrenceEndDate || !selectedDate) return 0;
    const startDate = new Date(selectedDate);
    const endDate = new Date(recurrenceEndDate);
    let count = 0;
    let currentDate = new Date(startDate);
    
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

  const endTimeOptions = getEndTimeOptions();
  const isFormValid = selectedRooms.length > 0 && selectedUser && selectedDate && startTime && endTime && eventName && purpose && attendees && (!isRecurring || recurrenceEndDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Booking</DialogTitle>
          <DialogDescription>
            Create a new booking on behalf of a customer
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rooms <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">Select one or more rooms to book</p>
              <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                {activeRooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No active rooms available</p>
                ) : (
                  activeRooms.map((room) => (
                    <div key={room.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`room-${room.id}`}
                        checked={selectedRooms.includes(room.id)}
                        onCheckedChange={() => handleRoomToggle(room.id)}
                        data-testid={`checkbox-room-${room.id}`}
                      />
                      <Label
                        htmlFor={`room-${room.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {room.name} (Capacity: {room.capacity})
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {selectedRooms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedRooms.length} room{selectedRooms.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer <span className="text-destructive">*</span></Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger data-testid="select-customer">
                  <User className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.firstName} {customer.lastName} ({customer.email || 'No email'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                required
                data-testid="input-booking-date"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">From <span className="text-destructive">*</span></Label>
                <Select value={startTime} onValueChange={handleStartTimeChange}>
                  <SelectTrigger data-testid="select-start-time">
                    <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.slice(0, -1).map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">To <span className="text-destructive">*</span></Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger data-testid="select-end-time">
                    <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
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

            <div className="space-y-2">
              <Label htmlFor="eventName">Event Name <span className="text-destructive">*</span></Label>
              <Input
                id="eventName"
                placeholder="e.g., Annual Board Meeting, Youth Workshop..."
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                data-testid="input-event-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Description <span className="text-destructive">*</span></Label>
              <Textarea
                id="purpose"
                placeholder="Describe the event, any special requirements..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                data-testid="input-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendees">Number of Attendees <span className="text-destructive">*</span></Label>
              <Input
                id="attendees"
                type="number"
                min="1"
                placeholder="e.g., 5"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                required
                data-testid="input-attendees"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility <span className="text-destructive">*</span></Label>
              <Select value={visibility} onValueChange={(value: "private" | "public") => setVisibility(value)}>
                <SelectTrigger data-testid="select-visibility">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 border rounded-md p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="recurring" className="flex items-center gap-2 cursor-pointer">
                  <Repeat className="w-4 h-4" />
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
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="recurrencePattern">Repeat <span className="text-destructive">*</span></Label>
                    <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                      <SelectTrigger data-testid="select-recurrence-pattern">
                        <SelectValue placeholder="Select pattern" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceEndDate">Until <span className="text-destructive">*</span></Label>
                    <Input
                      id="recurrenceEndDate"
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      min={minRecurrenceEndDate}
                      max={maxRecurrenceEndDate}
                      required={isRecurring}
                      data-testid="input-recurrence-end-date"
                    />
                  </div>

                  {/* Day selection for weekly recurring */}
                  {recurrencePattern === 'weekly' && (
                    <div className="space-y-2">
                      <Label className="text-sm">Select Days</Label>
                      <div className="grid grid-cols-7 gap-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleDayToggle(index)}
                            className={`h-9 text-xs rounded-md border transition-colors ${
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
                      <Label className="text-sm">Monthly Pattern</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="weekOfMonth" className="text-sm">Week</Label>
                          <Select 
                            value={recurrenceWeekOfMonth.toString()} 
                            onValueChange={(value) => setRecurrenceWeekOfMonth(parseInt(value))}
                          >
                            <SelectTrigger data-testid="select-week-of-month">
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
                        <div className="space-y-2">
                          <Label htmlFor="dayOfWeek" className="text-sm">Day</Label>
                          <Select 
                            value={recurrenceDayOfWeek.toString()} 
                            onValueChange={(value) => setRecurrenceDayOfWeek(parseInt(value))}
                          >
                            <SelectTrigger data-testid="select-day-of-week">
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
                    <p className="text-sm text-muted-foreground">
                      This will create <span className="font-medium text-foreground">{calculateOccurrences() * selectedRooms.length}</span> booking{(calculateOccurrences() * selectedRooms.length) > 1 ? 's' : ''} 
                      {selectedRooms.length > 1 && <span> ({calculateOccurrences()} occurrences × {selectedRooms.length} rooms)</span>}
                      {selectedRooms.length === 1 && <span> ({recurrencePattern})</span>}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminNotes">Admin Notes (Private)</Label>
              <Textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes only visible to admins..."
                rows={3}
                data-testid="input-admin-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid || createBookingMutation.isPending}
              data-testid="button-create-booking"
            >
              {createBookingMutation.isPending 
                ? "Creating..." 
                : isRecurring 
                  ? `Create ${calculateOccurrences() * selectedRooms.length} Bookings (${selectedRooms.length} room${selectedRooms.length > 1 ? 's' : ''})` 
                  : selectedRooms.length > 1
                    ? `Create ${selectedRooms.length} Bookings`
                    : 'Create Booking'
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
