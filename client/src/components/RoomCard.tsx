import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar } from "lucide-react";
import ImageCarousel from "./ImageCarousel";
import { getAmenityIconByName } from "@/lib/amenityIcons";

interface RoomCardProps {
  id: string;
  name: string;
  capacity: number;
  images: string[];
  amenities: string[];
  onViewCalendar: (id: string) => void;
}

export default function RoomCard({ id, name, capacity, images, amenities, onViewCalendar }: RoomCardProps) {
  return (
    <Card className="overflow-hidden hover-elevate active-elevate-2" data-testid={`card-room-${id}`}>
      <ImageCarousel images={images} alt={name} />
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex-1">
          <h3 className="text-lg font-medium mb-2">{name}</h3>
          <div className="flex items-center gap-1 text-muted-foreground mb-2">
            <Users className="w-4 h-4" />
            <span className="text-sm">{capacity}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {amenities.map((amenity) => {
              const Icon = getAmenityIconByName(amenity);
              return (
                <div key={amenity} className="text-muted-foreground" title={amenity}>
                  <Icon className="w-4 h-4" />
                </div>
              );
            })}
          </div>
        </div>
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
