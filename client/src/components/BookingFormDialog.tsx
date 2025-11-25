import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  selectedDate: Date;
  selectedTime: string;
  availableTimeSlots: string[];
  onSubmit: (data: { startTime: string; endTime: string; purpose: string; attendees: number }) => void;
}

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
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("");

  useEffect(() => {
    setStartTime(selectedTime);
    const startIndex = availableTimeSlots.indexOf(selectedTime);
    if (startIndex >= 0 && startIndex < availableTimeSlots.length - 1) {
      setEndTime(availableTimeSlots[startIndex + 1]);
    }
  }, [selectedTime, availableTimeSlots]);

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
    onSubmit({ 
      startTime, 
      endTime, 
      purpose, 
      attendees: parseInt(attendees) || 1 
    });
    setPurpose("");
    setAttendees("");
  };

  const endTimeOptions = getEndTimeOptions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Book {roomName}</DialogTitle>
          <DialogDescription>
            Complete the form below to submit your booking request
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <div className="flex items-center gap-2 text-sm bg-muted p-3 rounded-md">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{format(selectedDate, 'MMM dd, yyyy')}</span>
              </div>
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
                    {availableTimeSlots.slice(0, -1).map((time) => (
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
              <Label htmlFor="purpose">Purpose <span className="text-destructive">*</span></Label>
              <Textarea
                id="purpose"
                placeholder="e.g., Team meeting, Workshop, Community event..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                data-testid="input-purpose"
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={!startTime || !endTime} data-testid="button-submit">
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
