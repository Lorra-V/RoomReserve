import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Wifi, Monitor, Coffee, Calendar } from "lucide-react";
import ImageCarousel from "./ImageCarousel";

interface RoomCardProps {
  id: string;
  name: string;
  capacity: number;
  images: string[];
  amenities: string[];
  onViewCalendar: (id: string) => void;
}

export default function RoomCard({ id, name, capacity, images, amenities, onViewCalendar }: RoomCardProps) {
  const amenityIcons: Record<string, any> = {
    wifi: Wifi,
    projector: Monitor,
    coffee: Coffee,
  };

  return (
    <Card className="overflow-hidden hover-elevate active-elevate-2" data-testid={`card-room-${id}`}>
      <div className="relative">
        <ImageCarousel images={images} alt={name} />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-white">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{capacity} people</span>
            </div>
            <div className="flex items-center gap-2">
              {amenities.slice(0, 3).map((amenity) => {
                const Icon = amenityIcons[amenity.toLowerCase()];
                return Icon ? (
                  <div key={amenity} className="text-white" title={amenity}>
                    <Icon className="w-4 h-4" />
                  </div>
                ) : null;
              })}
              {amenities.length > 3 && (
                <span className="text-white text-xs">+{amenities.length - 3}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-medium">{name}</h3>
      </CardHeader>
      <CardFooter className="pt-0">
        <Button 
          className="w-full" 
          onClick={() => onViewCalendar(id)}
          data-testid={`button-view-calendar-${id}`}
        >
          <Calendar className="w-4 h-4 mr-2" />
          View Calendar
        </Button>
      </CardFooter>
    </Card>
  );
}
