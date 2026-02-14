import { Check } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const TEAL = "#0F766E";
const AMBER = "#F59E0B";

const freeFeatures = [
  "Perfect for single hall or room",
  "Online booking calendar",
  "Admin dashboard",
  "Email notifications",
  "Unlimited bookings",
];

const paidFeatures = [
  "Everything in Free, plus:",
  "2-15 rooms",
  "Multi-room management",
  "Advanced reporting",
  "Priority support",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16 lg:py-20">
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-3xl font-semibold md:text-4xl mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs. Start free, upgrade when you grow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <Card className="relative flex flex-col border-2 border-border">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Single Room</CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold" style={{ color: TEAL }}>
                  $0
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription>
                Ideal for a single hall or room
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <ul className="space-y-3">
                {freeFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: TEAL }}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link href="/signup">
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  style={{
                    borderColor: TEAL,
                    color: TEAL,
                  }}
                >
                  Get Started Free
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Paid Tier */}
          <Card className="relative flex flex-col border-2 shadow-lg" style={{ borderColor: AMBER }}>
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: AMBER }}
            >
              Most Popular
            </div>
            <CardHeader className="space-y-2 pt-6">
              <CardTitle className="text-xl">Multi-Room</CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold" style={{ color: AMBER }}>
                  $15
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription>
                Billed annually at $180/year
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <ul className="space-y-3">
                {paidFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      style={{ color: AMBER }}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link href="/signup">
                <Button
                  className="w-full bg-[#F59E0B] text-white border-[#F59E0B] hover:bg-[#D97706] hover:border-[#D97706]"
                  size="lg"
                >
                  Start Annual Plan
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>
    </div>
  );
}
