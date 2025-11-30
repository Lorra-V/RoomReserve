import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

interface AdminCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: User | null;
}

export default function AdminCustomerDialog({
  open,
  onOpenChange,
  customer,
}: AdminCustomerDialogProps) {
  const { toast } = useToast();
  const isEditing = !!customer;

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");

  useEffect(() => {
    if (open) {
      if (customer) {
        setEmail(customer.email || "");
        setFirstName(customer.firstName || "");
        setLastName(customer.lastName || "");
        setPhone(customer.phone || "");
        setOrganization(customer.organization || "");
      } else {
        setEmail("");
        setFirstName("");
        setLastName("");
        setPhone("");
        setOrganization("");
      }
    }
  }, [open, customer]);

  const createCustomerMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      organization?: string;
    }) => {
      const response = await apiRequest("POST", "/api/admin/customers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({
        title: "Customer created",
        description: "The customer has been created successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      organization?: string;
    }) => {
      const response = await apiRequest("PATCH", `/api/admin/customers/${customer?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({
        title: "Customer updated",
        description: "The customer has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !firstName || !lastName) {
      toast({
        title: "Validation error",
        description: "Email, first name, and last name are required.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      email,
      firstName,
      lastName,
      phone: phone.trim() || undefined,
      organization: organization.trim() || undefined,
    };

    if (isEditing) {
      updateCustomerMutation.mutate(data);
    } else {
      createCustomerMutation.mutate(data);
    }
  };

  const isLoading = createCustomerMutation.isPending || updateCustomerMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Customer" : "Create Customer"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update customer information below."
              : "Create a new customer account. They will be able to book rooms."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-customer-email"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-customer-first-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-customer-last-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
                data-testid="input-customer-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                placeholder="Company Name"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                disabled={isLoading}
                data-testid="input-customer-organization"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !email || !firstName || !lastName}
              data-testid="button-submit"
            >
              {isLoading
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                ? "Update Customer"
                : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

