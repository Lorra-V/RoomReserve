import { useState } from "react";
import BookingFormDialog from '../BookingFormDialog';
import { Button } from "@/components/ui/button";

export default function BookingFormDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Open Booking Form</Button>
      <BookingFormDialog
        open={open}
        onOpenChange={setOpen}
        roomName="Meeting Room A"
        selectedDate={new Date(2025, 11, 25)}
        selectedTime="10:00 AM"
        onSubmit={(data) => {
          console.log('Booking submitted:', data);
          setOpen(false);
        }}
      />
    </div>
  );
}
