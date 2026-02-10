import CalendarView from '../CalendarView';

export default function CalendarViewExample() {
  return (
    <div className="p-6">
      <CalendarView
        roomName="Meeting Room A"
        bookings={[]}
        onBookSlot={(date, time) => console.log('Book slot:', date, time)}
      />
    </div>
  );
}
