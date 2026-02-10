import RoomCard from '../RoomCard';
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';

export default function RoomCardExample() {
  return (
    <div className="p-6 max-w-sm">
      <RoomCard
        id="1"
        name="Meeting Room A"
        capacity={8}
        images={[meetingRoomImg]}
        amenities={["WiFi", "Projector", "Coffee"]}
        onViewCalendar={(id) => console.log('View calendar for room:', id)}
      />
    </div>
  );
}
