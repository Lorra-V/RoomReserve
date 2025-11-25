import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import RoomCard from "@/components/RoomCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";
import type { Room } from "@shared/schema";
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';
import multipurposeHallImg from '@assets/generated_images/multipurpose_hall_interior.png';
import studyRoomImg from '@assets/generated_images/study_room_interior.png';
import workshopImg from '@assets/generated_images/workshop_space_interior.png';

const imageMap: Record<string, string> = {
  'meeting': meetingRoomImg,
  'multipurpose': multipurposeHallImg,
  'hall': multipurposeHallImg,
  'study': studyRoomImg,
  'workshop': workshopImg,
};

function getRoomImage(roomName: string): string {
  const nameLower = roomName.toLowerCase();
  for (const [key, image] of Object.entries(imageMap)) {
    if (nameLower.includes(key)) {
      return image;
    }
  }
  return meetingRoomImg;
}

function getRoomImages(room: Room): string[] {
  if (room.imageUrls && room.imageUrls.length > 0) {
    return room.imageUrls;
  }
  if (room.imageUrl) {
    return [room.imageUrl];
  }
  return [getRoomImage(room.name)];
}

export default function BrowseRooms() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const amenitiesList = ["WiFi", "Projector", "Coffee"];

  const handleAmenityChange = (amenity: string, checked: boolean) => {
    setSelectedAmenities(prev =>
      checked ? [...prev, amenity] : prev.filter(a => a !== amenity)
    );
  };

  const handleViewCalendar = (id: string) => {
    setLocation(`/room/${id}`);
  };

  const filteredRooms = rooms?.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAmenities = selectedAmenities.length === 0 || 
      selectedAmenities.every(amenity => room.amenities.includes(amenity));
    return matchesSearch && matchesAmenities;
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-semibold">Browse Rooms</h1>
          <p className="text-muted-foreground">Find the perfect space for your needs</p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-64 flex-shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Room name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Amenities</Label>
                  {amenitiesList.map((amenity) => (
                    <div key={amenity} className="flex items-center gap-2">
                      <Checkbox
                        id={`amenity-${amenity}`}
                        checked={selectedAmenities.includes(amenity)}
                        onCheckedChange={(checked) => handleAmenityChange(amenity, checked as boolean)}
                        data-testid={`checkbox-${amenity.toLowerCase()}`}
                      />
                      <Label htmlFor={`amenity-${amenity}`} className="text-sm font-normal cursor-pointer">
                        {amenity}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>

          <div className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    id={room.id}
                    name={room.name}
                    capacity={room.capacity}
                    images={getRoomImages(room)}
                    amenities={room.amenities}
                    onViewCalendar={handleViewCalendar}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No rooms found</h3>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
