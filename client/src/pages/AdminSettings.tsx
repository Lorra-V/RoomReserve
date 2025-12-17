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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Clock, Mail, CreditCard, Settings, Bell, Loader2, CheckCircle, XCircle, Upload, X, Plus, Pencil, Trash2, Star, FileText, Eye } from "lucide-react";
import type { SiteSettings, Amenity } from "@shared/schema";
import RichTextEmailEditor from "@/components/RichTextEmailEditor";

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
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7" data-testid="tabs-settings">
          <TabsTrigger value="general" className="gap-2" data-testid="tab-general">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="amenities" className="gap-2" data-testid="tab-amenities">
            <Star className="w-4 h-4" />
            <span className="hidden sm:inline">Amenities</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2" data-testid="tab-pricing">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Pricing</span>
          </TabsTrigger>
          <TabsTrigger value="public-info" className="gap-2" data-testid="tab-public-info">
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Public Info</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="email-templates" className="gap-2" data-testid="tab-email-templates">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Emails</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2" data-testid="tab-integrations">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettingsTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="amenities">
          <AmenitiesTab />
        </TabsContent>

        <TabsContent value="pricing">
          <PricingSettingsTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="public-info">
          <PublicInfoTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettingsTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
        </TabsContent>

        <TabsContent value="email-templates">
          <EmailTemplatesTab settings={settings} onSave={handleSave} isPending={updateMutation.isPending} />
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
                    Notify customers when their booking is confirmed
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

function AmenitiesTab() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<Amenity | null>(null);
  const [formData, setFormData] = useState({ name: "", icon: "Star", isActive: true });

  const { data: amenities, isLoading } = useQuery<Amenity[]>({
    queryKey: ["/api/admin/amenities"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; icon: string; isActive: boolean }) => {
      await apiRequest("POST", "/api/admin/amenities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/amenities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amenities"] });
      toast({ title: "Amenity created", description: "The amenity has been added successfully." });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create amenity.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Amenity> }) => {
      await apiRequest("PATCH", `/api/admin/amenities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/amenities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amenities"] });
      toast({ title: "Amenity updated", description: "The amenity has been updated successfully." });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update amenity.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/amenities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/amenities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/amenities"] });
      toast({ title: "Amenity deleted", description: "The amenity has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete amenity.", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingAmenity(null);
    setFormData({ name: "", icon: "Star", isActive: true });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (amenity: Amenity) => {
    setEditingAmenity(amenity);
    setFormData({ name: amenity.name, icon: amenity.icon || "Star", isActive: amenity.isActive });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAmenity(null);
    setFormData({ name: "", icon: "Star", isActive: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingAmenity) {
      updateMutation.mutate({ id: editingAmenity.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this amenity?")) {
      deleteMutation.mutate(id);
    }
  };

  const iconOptions = [
    { value: "Wifi", label: "WiFi" },
    { value: "Monitor", label: "Projector/Screen" },
    { value: "Coffee", label: "Coffee/Refreshments" },
    { value: "Car", label: "Parking" },
    { value: "Snowflake", label: "Air Conditioning" },
    { value: "Mic", label: "Microphone/Audio" },
    { value: "Printer", label: "Printer" },
    { value: "Accessibility", label: "Wheelchair Access" },
    { value: "Utensils", label: "Kitchen/Catering" },
    { value: "Star", label: "Other" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Amenities
            </CardTitle>
            <CardDescription>
              Manage amenities that can be assigned to rooms
            </CardDescription>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-amenity">
            <Plus className="w-4 h-4 mr-2" />
            Add Amenity
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {amenities && amenities.length > 0 ? (
          <div className="space-y-3">
            {amenities.map((amenity) => (
              <div
                key={amenity.id}
                className="flex items-center justify-between p-3 border rounded-lg"
                data-testid={`amenity-row-${amenity.id}`}
              >
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{amenity.name}</p>
                    <p className="text-sm text-muted-foreground">Icon: {amenity.icon || "Star"}</p>
                  </div>
                  {!amenity.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(amenity)}
                    data-testid={`button-edit-amenity-${amenity.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(amenity.id)}
                    data-testid={`button-delete-amenity-${amenity.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No amenities configured yet.</p>
            <p className="text-sm">Add amenities that rooms can offer.</p>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAmenity ? "Edit Amenity" : "Add Amenity"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amenity-name">Name</Label>
                <Input
                  id="amenity-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. WiFi, Projector, Air Conditioning"
                  data-testid="input-amenity-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amenity-icon">Icon</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger data-testid="select-amenity-icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="amenity-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-amenity-active"
                />
                <Label htmlFor="amenity-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-amenity"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingAmenity ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function PublicInfoTab({ settings, onSave, isPending }: SettingsTabProps) {
  const [formData, setFormData] = useState({
    rentalFeesContent: settings?.rentalFeesContent || "",
    agreementContent: settings?.agreementContent || "",
    rentalFeesUrl: settings?.rentalFeesUrl || "",
    agreementUrl: settings?.agreementUrl || "",
    authHeroUrl: (settings as any)?.authHeroUrl || "",
    authLogoUrl: (settings as any)?.authLogoUrl || "",
    authHeroUrlSecondary: (settings as any)?.authHeroUrlSecondary || "",
    authHeadline: (settings as any)?.authHeadline || "Available Spaces",
    authSubheadline: (settings as any)?.authSubheadline || "",
    authFeature1: (settings as any)?.authFeature1 || "Real-time availability calendar",
    authFeature2: (settings as any)?.authFeature2 || "Instant booking confirmation",
    authFeature3: (settings as any)?.authFeature3 || "Manage all your reservations",
    authStatRooms: (settings as any)?.authStatRooms || "12",
    authStatMembers: (settings as any)?.authStatMembers || "250+",
    authStatSatisfaction: (settings as any)?.authStatSatisfaction || "95%",
  });
  const [authLogoPreview, setAuthLogoPreview] = useState<string | null>((settings as any)?.authLogoUrl || null);
  const [authHeroPreview, setAuthHeroPreview] = useState<string | null>((settings as any)?.authHeroUrl || null);
  const [authHeroPreviewSecondary, setAuthHeroPreviewSecondary] = useState<string | null>((settings as any)?.authHeroUrlSecondary || null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleAuthLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("Logo file size must be less than 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAuthLogoPreview(base64);
      setFormData({ ...formData, authLogoUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleAuthHeroUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Hero image must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAuthHeroPreview(base64);
      setFormData({ ...formData, authHeroUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAuthLogo = () => {
    setAuthLogoPreview(null);
    setFormData({ ...formData, authLogoUrl: "" });
  };

  const handleRemoveAuthHero = () => {
    setAuthHeroPreview(null);
    setFormData({ ...formData, authHeroUrl: "" });
  };

  const handleAuthHeroUploadSecondary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Hero image must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAuthHeroPreviewSecondary(base64);
      setFormData({ ...formData, authHeroUrlSecondary: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAuthHeroSecondary = () => {
    setAuthHeroPreviewSecondary(null);
    setFormData({ ...formData, authHeroUrlSecondary: "" });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Public Information</CardTitle>
          <CardDescription>
            Manage rental fees and agreement content shown to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">Rental Fees</h3>
            
            <div className="space-y-2">
              <Label htmlFor="rentalFeesUrl">Link to Full Fee Schedule (Optional)</Label>
              <p className="text-xs text-muted-foreground">
                Provide a URL to a PDF, Google Doc, or web page with complete fee information
              </p>
              <Input
                id="rentalFeesUrl"
                type="url"
                value={formData.rentalFeesUrl}
                onChange={(e) => setFormData({ ...formData, rentalFeesUrl: e.target.value })}
                placeholder="https://example.com/rental-fees.pdf"
                data-testid="input-rental-fees-url"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rentalFeesContent">Or Paste Fee Information Here</Label>
              <p className="text-xs text-muted-foreground">
                This content will be displayed in the "Rental Fees" tab on room booking pages
              </p>
              <Textarea
                id="rentalFeesContent"
                value={formData.rentalFeesContent}
                onChange={(e) => setFormData({ ...formData, rentalFeesContent: e.target.value })}
                placeholder="Enter rental fees information here... Supports plain text and basic formatting."
                rows={8}
                className="font-mono text-sm"
                data-testid="input-rental-fees"
              />
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">Rental Agreement</h3>
            
            <div className="space-y-2">
              <Label htmlFor="agreementUrl">Link to Full Agreement (Optional)</Label>
              <p className="text-xs text-muted-foreground">
                Provide a URL to a PDF, Google Doc, or web page with the complete rental agreement
              </p>
              <Input
                id="agreementUrl"
                type="url"
                value={formData.agreementUrl}
                onChange={(e) => setFormData({ ...formData, agreementUrl: e.target.value })}
                placeholder="https://example.com/rental-agreement.pdf"
                data-testid="input-agreement-url"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agreementContent">Or Paste Agreement Here</Label>
              <p className="text-xs text-muted-foreground">
                This content will be displayed in the "Agreement" tab on room booking pages
              </p>
              <Textarea
                id="agreementContent"
                value={formData.agreementContent}
                onChange={(e) => setFormData({ ...formData, agreementContent: e.target.value })}
                placeholder="Enter rental agreement terms and conditions here... Supports plain text and basic formatting."
                rows={8}
                className="font-mono text-sm"
                data-testid="input-agreement"
              />
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">Auth Pages Branding</h3>
            <p className="text-xs text-muted-foreground">
              Configure the images shown on the public login and signup pages.
            </p>
            <div className="space-y-2">
              <Label htmlFor="authLogoUrl">Auth Logo (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Shown in the auth card header. Square/round works best (e.g., 96x96).
              </p>
              <div className="flex items-center gap-4">
                {authLogoPreview ? (
                  <div className="relative">
                    <img
                      src={authLogoPreview}
                      alt="Auth Logo preview"
                      className="h-16 w-16 object-contain border rounded-md bg-white"
                      data-testid="img-auth-logo-preview"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleRemoveAuthLogo}
                      data-testid="button-remove-auth-logo"
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
                    onChange={handleAuthLogoUpload}
                    className="cursor-pointer"
                    data-testid="input-auth-logo-upload"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, GIF or SVG. Max 500KB.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="authHeroUrl">Auth Hero Image (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Shown on the right side of the login/signup pages (desktop). Use a wide image.
              </p>
              <div className="flex items-center gap-4">
                {authHeroPreview ? (
                  <div className="relative">
                    <div className="h-20 w-32 border rounded-md overflow-hidden bg-white">
                      <img
                        src={authHeroPreview}
                        alt="Auth Hero preview"
                        className="w-full h-full object-cover"
                        data-testid="img-auth-hero-preview"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleRemoveAuthHero}
                      data-testid="button-remove-auth-hero"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-20 w-32 border-2 border-dashed rounded-md flex items-center justify-center bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={handleAuthHeroUpload}
                    className="cursor-pointer"
                    data-testid="input-auth-hero-upload"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Wide images recommended. Max 2MB.
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="authHeroUrlSecondary">Second Hero Image (optional)</Label>
                <div className="flex items-center gap-4">
                  {authHeroPreviewSecondary ? (
                    <div className="relative">
                      <div className="h-20 w-32 border rounded-md overflow-hidden bg-white">
                        <img
                          src={authHeroPreviewSecondary}
                          alt="Auth Hero 2 preview"
                          className="w-full h-full object-cover"
                          data-testid="img-auth-hero2-preview"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleRemoveAuthHeroSecondary}
                        data-testid="button-remove-auth-hero2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-20 w-32 border-2 border-dashed rounded-md flex items-center justify-center bg-muted">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={handleAuthHeroUploadSecondary}
                      className="cursor-pointer"
                      data-testid="input-auth-hero2-upload"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Wide images recommended. Max 2MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">Auth Pages Text</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="authHeadline">Headline</Label>
                <Input
                  id="authHeadline"
                  value={formData.authHeadline}
                  onChange={(e) => setFormData({ ...formData, authHeadline: e.target.value })}
                  placeholder="Available Spaces"
                  data-testid="input-auth-headline"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authSubheadline">Subheadline</Label>
                <Input
                  id="authSubheadline"
                  value={formData.authSubheadline}
                  onChange={(e) => setFormData({ ...formData, authSubheadline: e.target.value })}
                  placeholder="Discover and book rooms easily"
                  data-testid="input-auth-subheadline"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="authFeature1">Feature 1</Label>
                <Input
                  id="authFeature1"
                  value={formData.authFeature1}
                  onChange={(e) => setFormData({ ...formData, authFeature1: e.target.value })}
                  data-testid="input-auth-feature1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authFeature2">Feature 2</Label>
                <Input
                  id="authFeature2"
                  value={formData.authFeature2}
                  onChange={(e) => setFormData({ ...formData, authFeature2: e.target.value })}
                  data-testid="input-auth-feature2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authFeature3">Feature 3</Label>
                <Input
                  id="authFeature3"
                  value={formData.authFeature3}
                  onChange={(e) => setFormData({ ...formData, authFeature3: e.target.value })}
                  data-testid="input-auth-feature3"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="authStatRooms">Stat 1 (e.g., Rooms)</Label>
                <Input
                  id="authStatRooms"
                  value={formData.authStatRooms}
                  onChange={(e) => setFormData({ ...formData, authStatRooms: e.target.value })}
                  data-testid="input-auth-stat-rooms"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authStatMembers">Stat 2 (e.g., Members)</Label>
                <Input
                  id="authStatMembers"
                  value={formData.authStatMembers}
                  onChange={(e) => setFormData({ ...formData, authStatMembers: e.target.value })}
                  data-testid="input-auth-stat-members"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authStatSatisfaction">Stat 3 (e.g., Satisfaction)</Label>
                <Input
                  id="authStatSatisfaction"
                  value={formData.authStatSatisfaction}
                  onChange={(e) => setFormData({ ...formData, authStatSatisfaction: e.target.value })}
                  data-testid="input-auth-stat-satisfaction"
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isPending} data-testid="button-save-public-info">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Public Information
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

function EmailTemplatesTab({ settings, onSave, isPending }: SettingsTabProps) {
  const [formData, setFormData] = useState({
    emailConfirmationTemplate: settings?.emailConfirmationTemplate || "",
    emailApprovalTemplate: settings?.emailApprovalTemplate || "",
    emailRejectionTemplate: settings?.emailRejectionTemplate || "",
    emailCancellationTemplate: settings?.emailCancellationTemplate || "",
  });
  const [activeTemplate, setActiveTemplate] = useState<"confirmation" | "approval" | "rejection" | "cancellation">("confirmation");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const templateConfigs = {
    confirmation: {
      title: "Booking Confirmation",
      description: "Sent when a customer submits a new booking request",
      value: formData.emailConfirmationTemplate,
      placeholder: "<p>Dear {{customerName}},</p><p>Thank you for your booking request at {{centreName}}. We have received your reservation for {{roomName}} on {{bookingDate}} from {{startTime}} to {{endTime}}.</p><p>Your booking is pending approval and you will receive a confirmation email once reviewed.</p>",
      onChange: (value: string) => setFormData({ ...formData, emailConfirmationTemplate: value }),
    },
    approval: {
      title: "Booking Confirmed",
      description: "Sent when an admin approves a booking request",
      value: formData.emailApprovalTemplate,
      placeholder: "<p>Dear {{customerName}},</p><p>Great news! Your booking request has been <strong>confirmed</strong>.</p><p>Room: {{roomName}}<br/>Date: {{bookingDate}}<br/>Time: {{startTime}} - {{endTime}}</p><p>We look forward to seeing you!</p>",
      onChange: (value: string) => setFormData({ ...formData, emailApprovalTemplate: value }),
    },
    rejection: {
      title: "Booking Rejected",
      description: "Sent when an admin rejects a booking request",
      value: formData.emailRejectionTemplate,
      placeholder: "<p>Dear {{customerName}},</p><p>We regret to inform you that your booking request for {{roomName}} on {{bookingDate}} has been declined.</p><p><strong>Reason:</strong> {{rejectionReason}}</p><p>Please contact us if you have any questions or would like to discuss alternative options.</p>",
      onChange: (value: string) => setFormData({ ...formData, emailRejectionTemplate: value }),
    },
    cancellation: {
      title: "Booking Cancelled",
      description: "Sent when a booking is cancelled",
      value: formData.emailCancellationTemplate,
      placeholder: "<p>Dear {{customerName}},</p><p>This email confirms that your booking for {{roomName}} on {{bookingDate}} has been cancelled.</p><p>If you would like to make a new booking, please visit our website.</p>",
      onChange: (value: string) => setFormData({ ...formData, emailCancellationTemplate: value }),
    },
  };

  const currentTemplate = templateConfigs[activeTemplate];

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Email Templates
            </CardTitle>
            <CardDescription>
              Create rich HTML email templates with formatting, images, and dynamic variables. Templates support text styling, colors, and embedded images.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={activeTemplate === "confirmation" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTemplate("confirmation")}
                data-testid="button-template-confirmation"
              >
                Confirmation
              </Button>
              <Button
                type="button"
                variant={activeTemplate === "approval" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTemplate("approval")}
                data-testid="button-template-approval"
              >
                Approval
              </Button>
              <Button
                type="button"
                variant={activeTemplate === "rejection" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTemplate("rejection")}
                data-testid="button-template-rejection"
              >
                Rejection
              </Button>
              <Button
                type="button"
                variant={activeTemplate === "cancellation" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTemplate("cancellation")}
                data-testid="button-template-cancellation"
              >
                Cancellation
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{currentTemplate.title}</CardTitle>
            <CardDescription>
              {currentTemplate.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RichTextEmailEditor
              value={currentTemplate.value}
              onChange={currentTemplate.onChange}
              placeholder={currentTemplate.placeholder}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending} data-testid="button-save-email-templates">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save All Templates
          </Button>
        </div>
      </div>
    </form>
  );
}
