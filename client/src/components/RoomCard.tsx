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
      <ImageCarousel images={images} alt={name} />
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <h3 className="text-lg font-medium">{name}</h3>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span className="text-xs font-medium">{capacity}</span>
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {amenities.map((amenity) => {
            const Icon = amenityIcons[amenity.toLowerCase()];
            return Icon ? (
              <div key={amenity} className="text-muted-foreground" title={amenity}>
                <Icon className="w-4 h-4" />
              </div>
            ) : null;
          })}
        </div>
      </CardContent>
      <CardFooter>
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
