import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  selectedDate: Date;
  selectedTime: string;
  onSubmit: (data: { purpose: string; attendees: number }) => void;
}

export default function BookingFormDialog({
  open,
  onOpenChange,
  roomName,
  selectedDate,
  selectedTime,
  onSubmit,
}: BookingFormDialogProps) {
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ purpose, attendees: parseInt(attendees) || 1 });
    setPurpose("");
    setAttendees("");
  };

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
              <Label>Booking Details</Label>
              <div className="flex items-center gap-2 text-sm bg-muted p-3 rounded-md">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{format(selectedDate, 'MMM dd, yyyy')}</span>
                <span className="text-muted-foreground">•</span>
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono">{selectedTime}</span>
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
            <Button type="submit" data-testid="button-submit">
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
