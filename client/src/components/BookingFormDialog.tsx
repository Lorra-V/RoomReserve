import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, Package } from "lucide-react";
import { format } from "date-fns";
import type { AdditionalItem } from "@shared/schema";

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  selectedDate: Date;
  selectedTime: string;
  availableTimeSlots: string[];
  onSubmit: (data: { startTime: string; endTime: string; purpose: string; attendees: number; selectedItems: string[] }) => void;
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
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

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
      setPurpose("");
      setAttendees("");
      setSelectedItems([]);
    }
  }, [open, selectedDate, selectedTime]);

  const handleItemToggle = (itemId: string, checked: boolean) => {
    setSelectedItems(prev => 
      checked ? [...prev, itemId] : prev.filter(id => id !== itemId)
    );
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
    onSubmit({ 
      startTime, 
      endTime, 
      purpose, 
      attendees: parseInt(attendees) || 1,
      selectedItems,
    });
    setPurpose("");
    setAttendees("");
    setSelectedItems([]);
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

            {additionalItems.length > 0 && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Additional Items (optional)
                </Label>
                <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                  {additionalItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleItemToggle(item.id, checked as boolean)}
                          data-testid={`checkbox-item-${item.id}`}
                        />
                        <Label htmlFor={`item-${item.id}`} className="text-sm font-normal cursor-pointer">
                          {item.name}
                          {item.description && (
                            <span className="text-muted-foreground ml-1">- {item.description}</span>
                          )}
                        </Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {parseFloat(item.price || "0") === 0 
                          ? "Free" 
                          : `${currencySymbol}${parseFloat(item.price || "0").toFixed(2)}`
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
