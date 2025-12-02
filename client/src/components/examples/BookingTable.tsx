import BookingTable from '../BookingTable';

const mockBookings = [
  {
    id: "1",
    date: new Date(2025, 11, 25),
    time: "10:00 AM - 11:30 AM",
    room: "Meeting Room A",
    user: "John Doe",
    status: "pending" as const,
  },
  {
    id: "2",
    date: new Date(2025, 11, 26),
    time: "02:00 PM - 03:00 PM",
    room: "Multipurpose Hall",
    user: "Jane Smith",
    status: "confirmed" as const,
  },
  {
    id: "3",
    date: new Date(2025, 11, 27),
    time: "09:00 AM - 10:00 AM",
    room: "Study Room",
    user: "Bob Johnson",
    status: "pending" as const,
  },
];

export default function BookingTableExample() {
  return (
    <div className="p-6">
      <BookingTable
        bookings={mockBookings}
        showActions
        onApprove={(id) => console.log('Approve booking:', id)}
        onReject={(id) => console.log('Reject booking:', id)}
      />
    </div>
  );
}
