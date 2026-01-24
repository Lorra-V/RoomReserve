import { useQuery } from "@tanstack/react-query";
import { useClerk } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle, Users } from "lucide-react";
import { Link } from "wouter";
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';
import multipurposeHallImg from '@assets/generated_images/multipurpose_hall_interior.png';

export default function LoginPage() {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });
  const { redirectToSignIn } = useClerk();

  const authLogo = settings?.authLogoUrl || settings?.logoUrl;
  const authHero1 = settings?.authHeroUrl || meetingRoomImg;
  const authHero2 = settings?.authHeroUrlSecondary || multipurposeHallImg;
  const headline = settings?.authHeadline || "Available Spaces";
  const subheadline = settings?.authSubheadline || "";
  const feature1 = settings?.authFeature1 || "Real-time availability calendar";
  const feature2 = settings?.authFeature2 || "Instant booking confirmation";
  const feature3 = settings?.authFeature3 || "Manage all your reservations";
  const statRooms = settings?.authStatRooms || "12";
  const statMembers = settings?.authStatMembers || "250+";
  const statSatisfaction = settings?.authStatSatisfaction || "95%";

  const handleUserLogin = () => {
    void redirectToSignIn({ redirectUrl: window.location.href });
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {authLogo ? (
                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  <img src={authLogo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary-foreground" />
                </div>
              )}
            </div>
            <CardTitle className="text-3xl font-semibold">{settings?.centreName || "Room Booking"}</CardTitle>
            <CardDescription className="text-lg">
              {subheadline || "Room Booking System"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{feature1}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{feature2}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{feature3}</span>
              </div>
            </div>
            
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleUserLogin}
              data-testid="button-user-login"
            >
              <Users className="w-5 h-5 mr-2" />
              Sign In
            </Button>
            
            <p className="text-center text-xs text-muted-foreground">
              Sign in with Google or email/password
            </p>
            
            <p className="text-center text-xs text-muted-foreground border-t pt-4">
              Administrator?{" "}
              <Link href="/admin/login" className="text-primary hover:underline" data-testid="link-admin-login">
                Admin Portal
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:flex flex-1 bg-muted p-8 items-center justify-center">
        <div className="max-w-md space-y-6">
          <h2 className="text-2xl font-semibold">{headline}</h2>
          {subheadline && <p className="text-sm text-muted-foreground">{subheadline}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="aspect-[4/3] rounded-md overflow-hidden">
                <img src={authHero1} alt="Space 1" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-medium">Meeting Rooms</p>
            </div>
            <div className="space-y-2">
              <div className="aspect-[4/3] rounded-md overflow-hidden">
                <img src={authHero2} alt="Space 2" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-medium">Event Halls</p>
            </div>
          </div>
          <div className="flex items-center gap-8 pt-4">
            <div className="text-center">
              <div className="text-2xl font-semibold">{statRooms}</div>
              <div className="text-xs text-muted-foreground">Rooms</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{statMembers}</div>
              <div className="text-xs text-muted-foreground">Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{statSatisfaction}</div>
              <div className="text-xs text-muted-foreground">Satisfaction</div>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{feature1}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{feature2}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{feature3}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
