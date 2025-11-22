import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, Save, Trash2 } from "lucide-react";
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';
import multipurposeHallImg from '@assets/generated_images/multipurpose_hall_interior.png';
import studyRoomImg from '@assets/generated_images/study_room_interior.png';
import workshopImg from '@assets/generated_images/workshop_space_interior.png';

const mockRooms = [
  {
    id: "1",
    name: "Meeting Room A",
    capacity: 8,
    image: meetingRoomImg,
    amenities: "WiFi, Projector, Coffee",
    active: true,
  },
  {
    id: "2",
    name: "Multipurpose Hall",
    capacity: 50,
    image: multipurposeHallImg,
    amenities: "WiFi, Projector",
    active: true,
  },
  {
    id: "3",
    name: "Study Room",
    capacity: 4,
    image: studyRoomImg,
    amenities: "WiFi",
    active: true,
  },
  {
    id: "4",
    name: "Workshop Space",
    capacity: 12,
    image: workshopImg,
    amenities: "WiFi, Coffee",
    active: false,
  },
];

export default function AdminRooms() {
  const [rooms, setRooms] = useState(mockRooms);

  const handleToggleActive = (id: string) => {
    setRooms(rooms.map(room =>
      room.id === id ? { ...room, active: !room.active } : room
    ));
  };

  const handleSaveRoom = (id: string) => {
    console.log('Save room:', id);
  };

  const handleDeleteRoom = (id: string) => {
    console.log('Delete room:', id);
  };

  const handleAddRoom = () => {
    console.log('Add new room');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Room Management</h1>
          <p className="text-muted-foreground">Manage available rooms and their settings</p>
        </div>
        <Button onClick={handleAddRoom} data-testid="button-add-room">
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rooms.map((room) => (
          <Card key={room.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  <img src={room.image} alt={room.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-medium">{room.name}</h3>
                  <Badge variant={room.active ? "default" : "secondary"} data-testid={`badge-status-${room.id}`}>
                    {room.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`capacity-${room.id}`} className="text-sm">Capacity</Label>
                  <Input
                    id={`capacity-${room.id}`}
                    type="number"
                    defaultValue={room.capacity}
                    data-testid={`input-capacity-${room.id}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`amenities-${room.id}`} className="text-sm">Amenities</Label>
                  <Input
                    id={`amenities-${room.id}`}
                    defaultValue={room.amenities}
                    data-testid={`input-amenities-${room.id}`}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`active-${room.id}`}>Available for booking</Label>
                <Switch
                  id={`active-${room.id}`}
                  checked={room.active}
                  onCheckedChange={() => handleToggleActive(room.id)}
                  data-testid={`switch-active-${room.id}`}
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteRoom(room.id)}
                data-testid={`button-delete-${room.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button
                size="sm"
                onClick={() => handleSaveRoom(room.id)}
                data-testid={`button-save-${room.id}`}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
