import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function AdminLoginPage() {
  const handleAdminLogin = () => {
    window.location.href = "/api/admin/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-muted/30">
      <div className="w-full max-w-md space-y-4">
        <Link href="/rooms">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-to-site">
            <ArrowLeft className="w-4 h-4" />
            Back to Site
          </Button>
        </Link>
        
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold">Admin Portal</CardTitle>
            <CardDescription className="text-base">
              Arima Community Centre Management System
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span>Secure Administrator Access</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This area is restricted to authorized administrators only. Unauthorized access attempts are logged.
              </p>
            </div>
            
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleAdminLogin}
              data-testid="button-admin-sign-in"
            >
              <Shield className="w-5 h-5 mr-2" />
              Sign In as Administrator
            </Button>
            
            <p className="text-center text-xs text-muted-foreground">
              Sign in with your administrator account via Google or email/password
            </p>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground">
          Not an administrator?{" "}
          <Link href="/login" className="text-primary hover:underline" data-testid="link-user-login">
            Community member login
          </Link>
        </p>
      </div>
    </div>
  );
}
