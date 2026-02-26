import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, DoorOpen, CreditCard, ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

const TEAL = "#0F766E";
const TEAL_LIGHT = "#14B8A6";
const AMBER = "#F59E0B";

type VenueType = "community_centre" | "hall" | "guesthouse" | "other";

const venueTypeLabels: Record<VenueType, string> = {
  community_centre: "Community Centre",
  hall: "Hall",
  guesthouse: "Guesthouse",
  other: "Other",
};

interface OnboardingData {
  venueName: string;
  venueType: VenueType | "";
  location: string;
  roomName: string;
  roomCapacity: string;
  plan: "free" | "paid";
}

const stepIcons = [Building2, DoorOpen, CreditCard];
const stepLabels = ["Venue Details", "First Room", "Choose Plan"];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[0, 1, 2].map((step) => {
        const Icon = stepIcons[step];
        const isActive = step === currentStep;
        const isComplete = step < currentStep;

        return (
          <div key={step} className="flex items-center">
            {step > 0 && (
              <div
                className="w-10 h-0.5 mx-1 transition-colors duration-300"
                style={{ backgroundColor: isComplete ? TEAL : "#e5e7eb" }}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: isActive ? TEAL : isComplete ? TEAL_LIGHT : "#f3f4f6",
                  color: isActive || isComplete ? "white" : "#9ca3af",
                }}
              >
                {isComplete ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className="text-xs font-medium transition-colors duration-300"
                style={{ color: isActive ? TEAL : isComplete ? TEAL_LIGHT : "#9ca3af" }}
              >
                {stepLabels[step]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (user?.organizationId) {
      navigate("/admin");
    }
  }, [user?.organizationId, navigate]);

  const [data, setData] = useState<OnboardingData>({
    venueName: "",
    venueType: "",
    location: "",
    roomName: "Main Hall",
    roomCapacity: "",
    plan: "free",
  });

  const createOrgMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/organizations", {
        venueName: data.venueName,
        venueType: data.venueType,
        location: data.location,
        roomName: data.roomName || "Main Hall",
        roomCapacity: data.roomCapacity ? parseInt(data.roomCapacity, 10) : undefined,
        plan: data.plan,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "You're all set!",
        description: "Your venue is ready. Welcome to RoomReserve.",
      });
      navigate("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Something went wrong",
        description: error.message || "Could not create your venue. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateField = <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceedStep0 = data.venueName.trim().length > 0;
  const canProceedStep1 = true;

  const handleNext = () => {
    if (step < 2) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((s) => s - 1);
    }
  };

  const handleComplete = () => {
    createOrgMutation.mutate();
  };

  const handleSkipRoom = () => {
    updateField("roomName", "Main Hall");
    updateField("roomCapacity", "");
    setStep(2);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-teal-50/50 via-background to-amber-50/30 dark:from-teal-950/20 dark:via-background dark:to-amber-950/10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ backgroundColor: TEAL }}
          >
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold">Welcome to RoomReserve</h1>
          <p className="text-muted-foreground mt-1">
            Let's get your venue set up in a few quick steps
          </p>
        </div>

        <StepIndicator currentStep={step} />

        <Card className="shadow-lg border-0 ring-1 ring-border/50">
          {/* Step 0: Venue Details */}
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Tell us about your venue</CardTitle>
                <CardDescription>
                  What kind of space are you managing?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="venueName">Venue Name *</Label>
                  <Input
                    id="venueName"
                    placeholder="e.g. Sunrise Community Centre"
                    value={data.venueName}
                    onChange={(e) => updateField("venueName", e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venueType">Venue Type</Label>
                  <Select
                    value={data.venueType}
                    onValueChange={(v) => updateField("venueType", v as VenueType)}
                  >
                    <SelectTrigger id="venueType">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(venueTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location / City</Label>
                  <Input
                    id="location"
                    placeholder="e.g. Port of Spain"
                    value={data.location}
                    onChange={(e) => updateField("location", e.target.value)}
                  />
                </div>

                <Button
                  className="w-full text-white"
                  size="lg"
                  style={{ backgroundColor: TEAL }}
                  disabled={!canProceedStep0}
                  onClick={handleNext}
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 1: First Room */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Set up your first room</CardTitle>
                <CardDescription>
                  You can always add more rooms later from the dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="roomName">Room Name *</Label>
                  <Input
                    id="roomName"
                    placeholder="Main Hall"
                    value={data.roomName}
                    onChange={(e) => updateField("roomName", e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roomCapacity">Capacity</Label>
                  <Input
                    id="roomCapacity"
                    type="number"
                    min={1}
                    placeholder="e.g. 100"
                    value={data.roomCapacity}
                    onChange={(e) => updateField("roomCapacity", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    How many people can this room hold?
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="lg"
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    size="lg"
                    onClick={handleSkipRoom}
                  >
                    Skip (use defaults)
                  </Button>
                  <Button
                    className="flex-1 text-white"
                    size="lg"
                    style={{ backgroundColor: TEAL }}
                    disabled={!canProceedStep1}
                    onClick={handleNext}
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Choose Plan */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Choose your plan</CardTitle>
                <CardDescription>
                  Start free, upgrade whenever you need more rooms.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <RadioGroup
                  value={data.plan}
                  onValueChange={(v) => updateField("plan", v as "free" | "paid")}
                  className="grid gap-4"
                >
                  {/* Free tier */}
                  <label
                    htmlFor="plan-free"
                    className="cursor-pointer"
                  >
                    <div
                      className="flex items-start gap-4 rounded-xl border-2 p-4 transition-all"
                      style={{
                        borderColor: data.plan === "free" ? TEAL : "transparent",
                        backgroundColor: data.plan === "free" ? "rgba(15, 118, 110, 0.04)" : undefined,
                      }}
                    >
                      <RadioGroupItem value="free" id="plan-free" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="font-semibold">Free</span>
                          <span className="text-2xl font-semibold" style={{ color: TEAL }}>
                            $0
                            <span className="text-sm font-normal text-muted-foreground">/mo</span>
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          1 room &middot; Unlimited bookings &middot; Admin dashboard
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Paid tier */}
                  <label
                    htmlFor="plan-paid"
                    className="cursor-pointer"
                  >
                    <div
                      className="relative flex items-start gap-4 rounded-xl border-2 p-4 transition-all"
                      style={{
                        borderColor: data.plan === "paid" ? AMBER : "transparent",
                        backgroundColor: data.plan === "paid" ? "rgba(245, 158, 11, 0.04)" : undefined,
                      }}
                    >
                      <div
                        className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: AMBER }}
                      >
                        POPULAR
                      </div>
                      <RadioGroupItem value="paid" id="plan-paid" className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="font-semibold">Multi-Room</span>
                          <span className="text-2xl font-semibold" style={{ color: AMBER }}>
                            $15
                            <span className="text-sm font-normal text-muted-foreground">/mo</span>
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          2–15 rooms &middot; Advanced reporting &middot; Priority support
                        </p>
                      </div>
                    </div>
                  </label>
                </RadioGroup>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    size="lg"
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-[2] text-white"
                    size="lg"
                    style={{ backgroundColor: TEAL }}
                    disabled={createOrgMutation.isPending}
                    onClick={handleComplete}
                  >
                    {createOrgMutation.isPending ? (
                      "Setting up..."
                    ) : (
                      <>
                        Complete Setup
                        <Check className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can change all of these settings later from your dashboard.
        </p>
      </div>
    </div>
  );
}
