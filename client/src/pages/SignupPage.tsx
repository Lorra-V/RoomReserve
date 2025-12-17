import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle, Users, LogIn } from "lucide-react";
import { Link } from "wouter";
import meetingRoomImg from '@assets/generated_images/meeting_room_interior.png';
import multipurposeHallImg from '@assets/generated_images/multipurpose_hall_interior.png';

export default function SignupPage() {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });

  const authLogo = settings?.authLogoUrl || settings?.logoUrl;
  const authHero = settings?.authHeroUrl || multipurposeHallImg;

  const handleAuth = () => {
    window.location.href = "/api/login";
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
              Create your account or log in to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Book rooms with real-time availability</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Instant confirmation after approval</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Manage all reservations in one place</span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleAuth}
              data-testid="button-sign-up"
            >
              <Users className="w-5 h-5 mr-2" />
              Continue to sign up
            </Button>

            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleAuth}
              data-testid="button-log-in"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Already have an account? Log in
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Secure sign in with Google or email/password
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
          <h2 className="text-2xl font-semibold">Why join?</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="aspect-[4/3] rounded-md overflow-hidden">
                <img src={authHero || meetingRoomImg} alt="Spaces" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-medium">Spaces you can book</p>
            </div>
            <div className="space-y-2">
              <div className="aspect-[4/3] rounded-md overflow-hidden">
                <img src={meetingRoomImg} alt="Events" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm font-medium">Events made simple</p>
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


