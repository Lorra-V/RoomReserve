import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Building2, Clock, Mail, CreditCard, Settings, Bell, Loader2, CheckCircle, XCircle, Upload, X } from "lucide-react";
import type { SiteSettings } from "@shared/schema";

export default function AdminSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  const { data: settings, isLoading } = useQuery<SiteSettings>({
    queryKey: ["/api/admin/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SiteSettings>) => {
      await apiRequest("PATCH", "/api/admin/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = (data: Partial<SiteSettings>) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-settings">Settings</h1>
        <p className="text-muted-foreground">
          Customize your community centre booking system
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-settings">
          <TabsTrigger value="general" className="gap-2" data-testid="tab-general">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2" data-testid="tab-pricing">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Pricing</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2" data-testid="tab-integrations">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="pricing">
          <PricingSettingsTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettingsTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SettingsTabProps {
  settings: SiteSettings | undefined;
  onSave: (data: Partial<SiteSettings>) => void;
  isPending: boolean;
}

function GeneralSettingsTab({ settings, onSave, isPending }: SettingsTabProps) {
  const [formData, setFormData] = useState({
    centreName: settings?.centreName || "",
    logoUrl: settings?.logoUrl || "",
    primaryColor: settings?.primaryColor || "#16a34a",
    contactEmail: settings?.contactEmail || "",
    contactPhone: settings?.contactPhone || "",
    address: settings?.address || "",
    openingTime: settings?.openingTime || "07:00",
    closingTime: settings?.closingTime || "23:00",
    timezone: settings?.timezone || "America/Port_of_Spain",
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(settings?.logoUrl || null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert("Logo file size must be less than 500KB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogoPreview(base64);
        setFormData({ ...formData, logoUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setFormData({ ...formData, logoUrl: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Centre Information
          </CardTitle>
          <CardDescription>
            Basic information about your community centre
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="centreName">Centre Name</Label>
              <Input
                id="centreName"
                value={formData.centreName}
                onChange={(e) => setFormData({ ...formData, centreName: e.target.value })}
                placeholder="Arima Community Centre"
                data-testid="input-centre-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Centre Logo</Label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      className="h-16 w-16 object-contain border rounded-md bg-white"
                      data-testid="img-logo-preview"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleRemoveLogo}
                      data-testid="button-remove-logo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-16 w-16 border-2 border-dashed rounded-md flex items-center justify-center bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="cursor-pointer"
                    data-testid="input-logo-upload"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, GIF or SVG. Max 500KB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Brand Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-16 h-10 p-1"
                  data-testid="input-primary-color"
                />
                <Input
                  value={formData.primaryColor}
                  onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  placeholder="#16a34a"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Port_of_Spain">Trinidad (AST)</SelectItem>
                  <SelectItem value="America/New_York">New York (EST)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Los Angeles (PST)</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="info@arimacentre.com"
                data-testid="input-contact-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="+1 868 555 0123"
                data-testid="input-contact-phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main Street, Arima, Trinidad and Tobago"
              rows={2}
              data-testid="input-address"
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Operating Hours
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="openingTime">Opening Time</Label>
                <Input
                  id="openingTime"
                  type="time"
                  value={formData.openingTime}
                  onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                  data-testid="input-opening-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closingTime">Closing Time</Label>
                <Input
                  id="closingTime"
                  type="time"
                  value={formData.closingTime}
                  onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                  data-testid="input-closing-time"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending} data-testid="button-save-general">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function PricingSettingsTab({ settings, onSave, isPending }: SettingsTabProps) {
  const [formData, setFormData] = useState<{
    currency: string;
    paymentGateway: "wipay" | "stripe" | "manual";
  }>({
    currency: settings?.currency || "TTD",
    paymentGateway: settings?.paymentGateway || "manual",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Pricing & Payments
          </CardTitle>
          <CardDescription>
            Configure currency and payment options. Room-specific pricing is set in the Rooms management page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TTD">Trinidad Dollar (TTD)</SelectItem>
                  <SelectItem value="USD">US Dollar (USD)</SelectItem>
                  <SelectItem value="JMD">Jamaican Dollar (JMD)</SelectItem>
                  <SelectItem value="BBD">Barbados Dollar (BBD)</SelectItem>
                  <SelectItem value="XCD">East Caribbean Dollar (XCD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentGateway">Payment Method</Label>
              <Select
                value={formData.paymentGateway}
                onValueChange={(value) => setFormData({ ...formData, paymentGateway: value as "wipay" | "stripe" | "manual" })}
              >
                <SelectTrigger data-testid="select-payment-gateway">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Bank Transfer / Pay at Centre</SelectItem>
                  <SelectItem value="wipay">WiPay (Caribbean)</SelectItem>
                  <SelectItem value="stripe">Stripe (International)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.paymentGateway === "manual" && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                With bank transfer or pay at centre, customers will book rooms and pay via bank transfer or directly at the centre. 
                Booking confirmations will include payment instructions.
              </p>
            </div>
          )}

          {formData.paymentGateway === "wipay" && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-900">
              <p className="text-sm">
                Configure WiPay credentials in the <strong>Integrations</strong> tab to enable online payments for Trinidad and Caribbean customers.
              </p>
            </div>
          )}

          {formData.paymentGateway === "stripe" && (
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-900">
              <p className="text-sm">
                Configure Stripe credentials in the <strong>Integrations</strong> tab to enable international online payments.
              </p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending} data-testid="button-save-pricing">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function NotificationSettingsTab({ settings, onSave, isPending }: SettingsTabProps) {
  const [formData, setFormData] = useState<{
    emailProvider: "sendgrid" | "resend" | "smtp" | "none";
    emailFromAddress: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpSecure: boolean;
    notifyOnNewBooking: boolean;
    notifyOnApproval: boolean;
    notifyOnCancellation: boolean;
  }>({
    emailProvider: settings?.emailProvider || "none",
    emailFromAddress: settings?.emailFromAddress || "",
    smtpHost: settings?.smtpHost || "",
    smtpPort: settings?.smtpPort || 587,
    smtpUser: settings?.smtpUser || "",
    smtpPassword: settings?.smtpPassword || "",
    smtpSecure: settings?.smtpSecure ?? false,
    notifyOnNewBooking: settings?.notifyOnNewBooking ?? true,
    notifyOnApproval: settings?.notifyOnApproval ?? true,
    notifyOnCancellation: settings?.notifyOnCancellation ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Configure email notifications for bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emailProvider">Email Provider</Label>
              <Select
                value={formData.emailProvider}
                onValueChange={(value) => setFormData({ ...formData, emailProvider: value as "sendgrid" | "resend" | "smtp" | "none" })}
              >
                <SelectTrigger data-testid="select-email-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Disabled</SelectItem>
                  <SelectItem value="smtp">SMTP (Gmail, Outlook, etc.)</SelectItem>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="resend">Resend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailFromAddress">From Email Address</Label>
              <Input
                id="emailFromAddress"
                type="email"
                value={formData.emailFromAddress}
                onChange={(e) => setFormData({ ...formData, emailFromAddress: e.target.value })}
                placeholder="bookings@yourcentre.com"
                disabled={formData.emailProvider === "none"}
                data-testid="input-email-from"
              />
            </div>
          </div>

          {formData.emailProvider === "smtp" && (
            <div className="space-y-4 border rounded-lg p-4">
              <h4 className="font-medium">SMTP Configuration</h4>
              <p className="text-sm text-muted-foreground mb-4">
                For Gmail: Use smtp.gmail.com with port 587. You'll need to create an App Password in your Google Account settings.
                <br />
                For Outlook: Use smtp.office365.com with port 587.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    value={formData.smtpHost}
                    onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                    data-testid="input-smtp-host"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={formData.smtpPort}
                    onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) || 587 })}
                    placeholder="587"
                    data-testid="input-smtp-port"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP Username</Label>
                  <Input
                    id="smtpUser"
                    value={formData.smtpUser}
                    onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                    placeholder="your-email@gmail.com"
                    data-testid="input-smtp-user"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP Password / App Password</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={formData.smtpPassword}
                    onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                    placeholder="••••••••••••••••"
                    data-testid="input-smtp-password"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="smtpSecure"
                  checked={formData.smtpSecure}
                  onCheckedChange={(checked) => setFormData({ ...formData, smtpSecure: checked })}
                  data-testid="switch-smtp-secure"
                />
                <Label htmlFor="smtpSecure">Use SSL/TLS (port 465)</Label>
              </div>
            </div>
          )}

          {(formData.emailProvider === "sendgrid" || formData.emailProvider === "resend") && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Configure your {formData.emailProvider === "sendgrid" ? "SendGrid" : "Resend"} API key in the <strong>Integrations</strong> tab.
              </p>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="font-medium mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Booking Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify admins when a new booking is submitted
                  </p>
                </div>
                <Switch
                  checked={formData.notifyOnNewBooking}
                  onCheckedChange={(checked) => setFormData({ ...formData, notifyOnNewBooking: checked })}
                  data-testid="switch-notify-new-booking"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Booking Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify customers when their booking is approved
                  </p>
                </div>
                <Switch
                  checked={formData.notifyOnApproval}
                  onCheckedChange={(checked) => setFormData({ ...formData, notifyOnApproval: checked })}
                  data-testid="switch-notify-approval"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Booking Cancellation</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify customers when a booking is cancelled
                  </p>
                </div>
                <Switch
                  checked={formData.notifyOnCancellation}
                  onCheckedChange={(checked) => setFormData({ ...formData, notifyOnCancellation: checked })}
                  data-testid="switch-notify-cancellation"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending} data-testid="button-save-notifications">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function IntegrationsTab({ settings, onSave, isPending }: SettingsTabProps) {
  const [formData, setFormData] = useState({
    wipayAccountId: settings?.wipayAccountId || "",
    wipayApiKey: settings?.wipayApiKey || "",
    stripePublicKey: settings?.stripePublicKey || "",
    stripeSecretKey: settings?.stripeSecretKey || "",
    emailApiKey: settings?.emailApiKey || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const wipayConfigured = !!(settings?.wipayAccountId && settings?.wipayApiKey);
  const stripeConfigured = !!(settings?.stripePublicKey && settings?.stripeSecretKey);
  const emailConfigured = !!(settings?.emailApiKey && settings?.emailProvider !== "none");

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  WiPay
                  <Badge variant={wipayConfigured ? "default" : "secondary"}>
                    {wipayConfigured ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Configured
                      </>
                    )}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Accept payments from Trinidad and Caribbean customers
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wipayAccountId">Account ID</Label>
                <Input
                  id="wipayAccountId"
                  value={formData.wipayAccountId}
                  onChange={(e) => setFormData({ ...formData, wipayAccountId: e.target.value })}
                  placeholder="Your WiPay account ID"
                  data-testid="input-wipay-account-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wipayApiKey">API Key</Label>
                <Input
                  id="wipayApiKey"
                  type="password"
                  value={formData.wipayApiKey}
                  onChange={(e) => setFormData({ ...formData, wipayApiKey: e.target.value })}
                  placeholder="Your WiPay API key"
                  data-testid="input-wipay-api-key"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your credentials from <a href="https://wipayfinancial.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">wipayfinancial.com</a>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Stripe
                  <Badge variant={stripeConfigured ? "default" : "secondary"}>
                    {stripeConfigured ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Configured
                      </>
                    )}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Accept international payments (optional)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stripePublicKey">Publishable Key</Label>
                <Input
                  id="stripePublicKey"
                  value={formData.stripePublicKey}
                  onChange={(e) => setFormData({ ...formData, stripePublicKey: e.target.value })}
                  placeholder="pk_..."
                  data-testid="input-stripe-public-key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stripeSecretKey">Secret Key</Label>
                <Input
                  id="stripeSecretKey"
                  type="password"
                  value={formData.stripeSecretKey}
                  onChange={(e) => setFormData({ ...formData, stripeSecretKey: e.target.value })}
                  placeholder="sk_..."
                  data-testid="input-stripe-secret-key"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe Dashboard</a>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Email Service
                  <Badge variant={emailConfigured ? "default" : "secondary"}>
                    {emailConfigured ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Configured
                      </>
                    )}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {settings?.emailProvider === "sendgrid" ? "SendGrid" : 
                   settings?.emailProvider === "resend" ? "Resend" : "No provider selected"} API Key
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailApiKey">API Key</Label>
              <Input
                id="emailApiKey"
                type="password"
                value={formData.emailApiKey}
                onChange={(e) => setFormData({ ...formData, emailApiKey: e.target.value })}
                placeholder={settings?.emailProvider === "none" ? "Select a provider in Notifications tab first" : "Your API key"}
                disabled={settings?.emailProvider === "none"}
                data-testid="input-email-api-key"
              />
            </div>
            {settings?.emailProvider === "sendgrid" && (
              <p className="text-xs text-muted-foreground">
                Get your API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SendGrid Settings</a>
              </p>
            )}
            {settings?.emailProvider === "resend" && (
              <p className="text-xs text-muted-foreground">
                Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Resend Dashboard</a>
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} data-testid="button-save-integrations">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save All Integrations
          </Button>
        </div>
      </div>
    </form>
  );
}
