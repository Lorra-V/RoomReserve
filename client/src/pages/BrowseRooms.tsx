import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import RoomCard from "@/components/RoomCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, DollarSign } from "lucide-react";
import type { Room, SiteSettings } from "@shared/schema";
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

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    staleTime: 0, // Always fetch fresh data
  });
  const { data: settings } = useQuery<SiteSettings>({
    queryKey: ["/api/settings"],
  });

  const handleViewCalendar = (id: string) => {
    setLocation(`/room/${id}`);
    // Scroll to top after navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewPricing = () => {
    const activeRoomsList = rooms?.filter((room) => room.isActive) || [];
    if (settings?.rentalFeesUrl) {
      window.open(settings.rentalFeesUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (activeRoomsList.length > 0) {
      // Fallback: go to the first room's Rental Fees tab if no external URL
      const firstRoom = activeRoomsList[0];
      setLocation(`/room/${firstRoom.id}?tab=fees`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const activeRooms = rooms?.filter(room => room.isActive) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Browse Rooms</h1>
            <p className="text-muted-foreground">Find the perfect space for your needs</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleViewPricing}
              className="gap-2"
              data-testid="button-view-pricing"
            >
              <DollarSign className="w-4 h-4" />
              Pricing
            </Button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeRooms.map((room) => (
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
              <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No rooms available</h3>
              <p className="text-sm text-muted-foreground">Please check back later</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
