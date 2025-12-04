import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";

interface BookingCardProps {
  id: string;
  roomName: string;
  roomImage: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled";
  onCancel?: (id: string) => void;
}

export default function BookingCard({ 
  id, 
  roomName, 
  roomImage, 
  date, 
  startTime, 
  endTime, 
  status,
  onCancel 
}: BookingCardProps) {
  const statusColors = {
    pending: "secondary",
    confirmed: "default",
    cancelled: "destructive",
  } as const;

  const statusLabels = {
    pending: "Pending",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
            <img src={roomImage} alt={roomName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="text-lg font-medium">{roomName}</h3>
            <Badge variant={statusColors[status]} data-testid={`badge-status-${id}`}>
              {statusLabels[status]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono">{format(date, 'dd-MM-yyyy')}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono">{startTime} - {endTime}</span>
        </div>
      </CardContent>
      {status !== "cancelled" && onCancel && (
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => onCancel(id)}
            data-testid={`button-cancel-${id}`}
          >
            Cancel Booking
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
