import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Pencil, Trash2, StickyNote, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import BookingEditDialog from "./BookingEditDialog";
import { useAuth } from "@/hooks/useAuth";
import type { BookingWithMeta } from "@shared/schema";

interface BookingTableProps {
  bookings: BookingWithMeta[];
  showActions?: boolean;
  showEditButton?: boolean;
  showBulkActions?: boolean;
  onApprove?: (id: string, updateGroup?: boolean) => void;
  onReject?: (id: string, updateGroup?: boolean) => void;
  onDelete?: (id: string) => void;
  onBulkApprove?: (ids: string[]) => Promise<void>;
  onBulkReject?: (ids: string[]) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
}

export default function BookingTable({ bookings, showActions, showEditButton = true, showBulkActions = false, onApprove, onReject, onDelete, onBulkApprove, onBulkReject, onBulkDelete }: BookingTableProps) {
  const [editingBooking, setEditingBooking] = useState<BookingWithMeta | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { isSuperAdmin } = useAuth();

  const statusColors = {
    pending: "secondary",
    confirmed: "default",
    cancelled: "destructive",
  } as const;

  const handleEditClick = (booking: BookingWithMeta) => {
    setEditingBooking(booking);
    setEditDialogOpen(true);
  };

  const toggleBookingSelection = (bookingId: string) => {
    setSelectedBookings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  const toggleAllBookings = () => {
    if (selectedBookings.size === bookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(bookings.map(b => b.id)));
    }
  };

  const handleBulkAction = async () => {
    if (selectedBookings.size === 0 || !bulkAction || isProcessing) return;
    
    const selectedIds = Array.from(selectedBookings);
    
    try {
      setIsProcessing(true);
      
      if (bulkAction === "approve" && onBulkApprove) {
        await onBulkApprove(selectedIds);
      } else if (bulkAction === "reject" && onBulkReject) {
        await onBulkReject(selectedIds);
      } else if (bulkAction === "delete" && onBulkDelete && isSuperAdmin) {
        if (confirm(`Are you sure you want to permanently delete ${selectedIds.length} booking(s)? This action cannot be undone.`)) {
          await onBulkDelete(selectedIds);
        }
      }
      
      setSelectedBookings(new Set());
      setBulkAction("");
    } catch (error) {
      console.error("Bulk action error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Group bookings by bookingGroupId for hierarchical display
  const groupedBookings = useMemo(() => {
    const groups = new Map<string, BookingWithMeta[]>();
    const standalone: BookingWithMeta[] = [];

    bookings.forEach(booking => {
      if (booking.bookingGroupId) {
        if (!groups.has(booking.bookingGroupId)) {
          groups.set(booking.bookingGroupId, []);
        }
        groups.get(booking.bookingGroupId)!.push(booking);
      } else {
        standalone.push(booking);
      }
    });

    // Sort bookings within each group (parent first, then children by date)
    groups.forEach((groupBookings, groupId) => {
      groupBookings.sort((a, b) => {
        // Parent booking (no parentBookingId) comes first
        if (!a.parentBookingId && b.parentBookingId) return -1;
        if (a.parentBookingId && !b.parentBookingId) return 1;
        
        // Then sort by date
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        return a.startTime.localeCompare(b.startTime);
      });
    });

    return { groups, standalone };
  }, [bookings]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const renderBookingRow = (booking: BookingWithMeta, isChild: boolean = false, groupId?: string) => {
    const isExpanded = groupId ? expandedGroups.has(groupId) : false;
    const groupBookings = groupId ? groupedBookings.groups.get(groupId) || [] : [];
    // Only find children if this is a parent booking (not a child)
    const childBookings = (!isChild && groupId) 
      ? groupBookings.filter(b => b.id !== booking.id && b.parentBookingId === booking.id)
      : [];
    
    return (
      <>
        <TableRow 
          key={booking.id} 
          className={`cursor-pointer hover-elevate ${isChild ? 'bg-muted/30' : ''}`}
          onClick={() => handleEditClick(booking)}
        >
          {showBulkActions && (
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedBookings.has(booking.id)}
                onCheckedChange={() => toggleBookingSelection(booking.id)}
                data-testid={`checkbox-booking-${booking.id}`}
              />
            </TableCell>
          )}
          <TableCell className="font-mono text-sm">
            <div className="flex items-center gap-2">
              {groupId && !isChild && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(groupId);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              )}
              {isChild && <div className="w-8" />}
              {format(booking.date instanceof Date ? booking.date : new Date(booking.date.split('T')[0] + 'T12:00:00'), 'dd-MM-yyyy')}
            </div>
          </TableCell>
          <TableCell className="font-mono text-sm">
            {booking.startTime} - {booking.endTime}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              {booking.roomName}
              {groupId && !isChild && (
                <Badge variant="outline" className="text-xs">
                  {groupBookings.length} in series
                </Badge>
              )}
              {isChild && (
                <Badge variant="outline" className="text-xs">Child</Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <span>{booking.eventName || "—"}</span>
              {booking.adminNotes && (
                <StickyNote className="w-4 h-4 text-yellow-500" title="Has admin notes" />
              )}
            </div>
          </TableCell>
          <TableCell>{booking.userName}</TableCell>
          <TableCell>
            <Badge variant={statusColors[booking.status]} data-testid={`badge-status-${booking.id}`}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </TableCell>
          {(showActions || showEditButton || isSuperAdmin) && (
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                {showEditButton && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEditClick(booking)}
                    data-testid={`button-edit-${booking.id}`}
                    title="Edit booking"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {isSuperAdmin && onDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(booking.id)}
                    data-testid={`button-delete-${booking.id}`}
                    title="Delete booking"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                {showActions && booking.status === "pending" && (
                  <>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => onApprove?.(booking.id)}
                      data-testid={`button-approve-${booking.id}`}
                      title="Confirm booking"
                    >
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => onReject?.(booking.id)}
                      data-testid={`button-reject-${booking.id}`}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          )}
        </TableRow>
        {groupId && !isChild && isExpanded && childBookings.map(childBooking => 
          renderBookingRow(childBooking, true, groupId)
        )}
      </>
    );
  };

  const allSelected = bookings.length > 0 && selectedBookings.size === bookings.length;
  const someSelected = selectedBookings.size > 0 && selectedBookings.size < bookings.length;

  return (
    <>
      {showBulkActions && bookings.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  (el as any).indeterminate = someSelected;
                }
              }}
              onCheckedChange={toggleAllBookings}
              data-testid="checkbox-select-all"
            />
            <span className="text-sm text-muted-foreground">
              {selectedBookings.size > 0 ? `${selectedBookings.size} selected` : 'Select all'}
            </span>
          </div>
          
          {selectedBookings.size > 0 && (
            <div className="flex items-center gap-2">
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger className="w-[180px]" data-testid="select-bulk-action">
                  <SelectValue placeholder="Bulk actions..." />
                </SelectTrigger>
                <SelectContent>
                  {onApprove && <SelectItem value="approve">Confirm selected</SelectItem>}
                  {onReject && <SelectItem value="reject">Cancel selected</SelectItem>}
                  {isSuperAdmin && onDelete && <SelectItem value="delete">Delete selected</SelectItem>}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleBulkAction} 
                disabled={!bulkAction || isProcessing}
                data-testid="button-apply-bulk-action"
              >
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isProcessing ? 'Processing...' : 'Apply'}
              </Button>
            </div>
          )}
        </div>
      )}
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {showBulkActions && <TableHead className="w-12"></TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Event Name</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              {(showActions || showEditButton) && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(showActions || showEditButton ? 7 : 6) + (showBulkActions ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              <>
                {/* Render standalone bookings (no bookingGroupId) */}
                {groupedBookings.standalone.map((booking) => 
                  renderBookingRow(booking, false)
                )}
                
                {/* Render grouped bookings (parent first, then children if expanded) */}
                {Array.from(groupedBookings.groups.entries()).map(([groupId, groupBookings]) => {
                  const parentBooking = groupBookings.find(b => !b.parentBookingId) || groupBookings[0];
                  return renderBookingRow(parentBooking, false, groupId);
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      
      <BookingEditDialog 
        booking={editingBooking} 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />
    </>
  );
}
