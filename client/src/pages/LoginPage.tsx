import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle, Shield, Users } from "lucide-react";
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';
import multipurposeHallImg from '@assets/generated_images/multipurpose_hall_interior.png';

export default function LoginPage() {
  const handleUserLogin = () => {
    window.location.href = "/api/login";
  };

  const handleAdminLogin = () => {
    window.location.href = "/api/admin/login";
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-3xl font-semibold">Arima Community Centre</CardTitle>
            <CardDescription className="text-lg">
              Room Booking System
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Real-time availability calendar</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Instant booking confirmation</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Manage all your reservations</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleUserLogin}
                data-testid="button-user-login"
              >
                <Users className="w-5 h-5 mr-2" />
                Community Member Login
              </Button>
              
              <Button 
                variant="outline"
                className="w-full" 
                size="lg"
                onClick={handleAdminLogin}
                data-testid="button-admin-login"
              >
                <Shield className="w-5 h-5 mr-2" />
                Admin Login
              </Button>
            </div>
            
            <p className="text-center text-xs text-muted-foreground">
              Sign in with Google or email/password
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:flex flex-1 bg-muted p-8 items-center justify-center">
        <div className="max-w-md space-y-6">
          <h2 className="text-2xl font-semibold">Available Spaces</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="aspect-[4/3] rounded-md overflow-hidden">
                <img src={meetingRoomImg} alt="Meeting Room" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-medium">Meeting Rooms</p>
            </div>
            <div className="space-y-2">
              <div className="aspect-[4/3] rounded-md overflow-hidden">
                <img src={multipurposeHallImg} alt="Multipurpose Hall" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-medium">Event Halls</p>
            </div>
          </div>
          <div className="flex items-center gap-8 pt-4">
            <div className="text-center">
              <div className="text-2xl font-semibold">12</div>
              <div className="text-xs text-muted-foreground">Rooms</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">250+</div>
              <div className="text-xs text-muted-foreground">Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">95%</div>
              <div className="text-xs text-muted-foreground">Satisfaction</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
