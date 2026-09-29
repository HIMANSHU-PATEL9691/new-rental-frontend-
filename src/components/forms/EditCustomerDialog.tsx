import { useState, useEffect, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/data/store";
import type { Customer } from "@/data/mock";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Invalid email",
    }),
  phone: z.string().trim().min(4, "Phone number required").max(40),
  secondaryPhone: z.string().trim().max(40).optional(),
  tier: z.enum(["Standard", "Gold", "Platinum"]),
});

export function EditCustomerDialog({
  customer,
  trigger,
  open,
  onOpenChange,
  onUpdated,
}: {
  customer: Customer;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUpdated?: (customer: Customer) => void;
}) {
  const { updateCustomer } = useStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [form, setForm] = useState({
    name: customer.name || "",
    email: customer.email || "",
    phone: customer.phone || "",
    secondaryPhone: customer.secondaryPhone || "",
    tier: customer.tier || ("Standard" as "Standard" | "Gold" | "Platinum"),
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        secondaryPhone: customer.secondaryPhone || "",
        tier: customer.tier || "Standard",
      });
    }
  }, [customer, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      const payload: Partial<Customer> = {
        name: parsed.data.name,
        email: parsed.data.email ? parsed.data.email : undefined,
        phone: parsed.data.phone,
        secondaryPhone: parsed.data.secondaryPhone ? parsed.data.secondaryPhone : undefined,
        tier: parsed.data.tier,
      };
      const updated = await updateCustomer(customer.id, payload);
      toast.success(`Client ${updated.name} updated successfully`);
      setOpen(false);
      onUpdated?.(updated);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to update client");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit Client</DialogTitle>
          <DialogDescription>
            Update profile details for {customer.name} ({customer.id}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-cname">Full Name</Label>
            <Input
              id="edit-cname"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Client Name"
              maxLength={100}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-cphone">Primary Phone Number</Label>
            <Input
              id="edit-cphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 9876543210"
              maxLength={40}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-csecondaryphone">Secondary Phone (Optional)</Label>
            <Input
              id="edit-csecondaryphone"
              value={form.secondaryPhone}
              onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
              placeholder="e.g. 9123456780"
              maxLength={40}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-cemail">Email Address (Optional)</Label>
            <Input
              id="edit-cemail"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="client@example.com"
              maxLength={255}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-ctier">Membership Tier</Label>
            <Select
              value={form.tier}
              onValueChange={(v: "Standard" | "Gold" | "Platinum") =>
                setForm({ ...form, tier: v })
              }
            >
              <SelectTrigger id="edit-ctier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Gold">Gold</SelectItem>
                <SelectItem value="Platinum">Platinum</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
