import BookingTable from '../BookingTable';
import type { BookingWithMeta } from '@shared/schema';

const mockBookings: BookingWithMeta[] = [
  {
    id: "1",
    roomId: "room-1",
    userId: "user-1",
    date: new Date(2025, 11, 25),
    startTime: "10:00",
    endTime: "11:30",
    eventName: "Team Meeting",
    purpose: "Weekly sync",
    attendees: 5,
    status: "pending",
    visibility: "public",
    selectedItems: [],
    isRecurring: false,
    recurrencePattern: null,
    recurrenceEndDate: null,
    recurrenceDays: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeek: null,
    bookingGroupId: null,
    parentBookingId: null,
    adminNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roomName: "Meeting Room A",
    userName: "John Doe",
    userEmail: "john@example.com",
    userPhone: null,
    userOrganization: null,
  },
  {
    id: "2",
    roomId: "room-2",
    userId: "user-2",
    date: new Date(2025, 11, 26),
    startTime: "14:00",
    endTime: "15:00",
    eventName: "Workshop",
    purpose: "Training session",
    attendees: 10,
    status: "confirmed",
    visibility: "public",
    selectedItems: [],
    isRecurring: false,
    recurrencePattern: null,
    recurrenceEndDate: null,
    recurrenceDays: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeek: null,
    bookingGroupId: null,
    parentBookingId: null,
    adminNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roomName: "Multipurpose Hall",
    userName: "Jane Smith",
    userEmail: "jane@example.com",
    userPhone: null,
    userOrganization: null,
  },
  {
    id: "3",
    roomId: "room-3",
    userId: "user-3",
    date: new Date(2025, 11, 27),
    startTime: "09:00",
    endTime: "10:00",
    eventName: null,
    purpose: "Study session",
    attendees: 2,
    status: "pending",
    visibility: "private",
    selectedItems: [],
    isRecurring: false,
    recurrencePattern: null,
    recurrenceEndDate: null,
    recurrenceDays: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeek: null,
    bookingGroupId: null,
    parentBookingId: null,
    adminNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    roomName: "Study Room",
    userName: "Bob Johnson",
    userEmail: "bob@example.com",
    userPhone: null,
    userOrganization: null,
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
