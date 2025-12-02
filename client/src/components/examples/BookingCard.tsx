import BookingCard from '../BookingCard';
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';

export default function BookingCardExample() {
  return (
    <div className="p-6 max-w-md space-y-4">
      <BookingCard
        id="1"
        roomName="Meeting Room A"
        roomImage={meetingRoomImg}
        date={new Date(2025, 11, 25)}
        startTime="10:00 AM"
        endTime="11:30 AM"
        status="confirmed"
        onCancel={(id) => console.log('Cancel booking:', id)}
      />
    </div>
  );
}
