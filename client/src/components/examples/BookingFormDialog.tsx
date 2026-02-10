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
        availableTimeSlots={[
          "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
          "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
          "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"
        ]}
        onSubmit={(data) => {
          console.log('Booking submitted:', data);
          setOpen(false);
        }}
      />
    </div>
  );
}
