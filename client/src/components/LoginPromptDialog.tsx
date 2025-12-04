import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, Calendar } from "lucide-react";
import { format } from "date-fns";

interface LoginPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  roomId?: string;
  selectedDate: Date;
  selectedTime: string;
}

export default function LoginPromptDialog({
  open,
  onOpenChange,
  roomName,
  roomId,
  selectedDate,
  selectedTime,
}: LoginPromptDialogProps) {
  const handleLogin = () => {
    // Store booking intent in localStorage
    const bookingIntent = {
      date: selectedDate.toISOString(),
      time: selectedTime,
      roomName,
      roomId,
    };
    localStorage.setItem('bookingIntent', JSON.stringify(bookingIntent));
    window.location.href = "/api/login";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <LogIn className="w-6 h-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">Login Required</DialogTitle>
          <DialogDescription className="text-center">
            Please log in to book a room at Arima Community Centre
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">{roomName}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(selectedDate, 'EEEE, dd-MM-yyyy')}</span>
            </div>
            <p className="text-sm text-muted-foreground">Starting at {selectedTime}</p>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto" data-testid="button-cancel-login">
            Cancel
          </Button>
          <Button onClick={handleLogin} className="w-full sm:w-auto" data-testid="button-login-to-book">
            <LogIn className="w-4 h-4 mr-2" />
            Log In to Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
