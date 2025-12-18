import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { PlusCircle, Save, Trash2, AlertCircle, X, Upload, Image } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Room, InsertRoom, Amenity } from "@shared/schema";

interface RoomFormData {
  name: string;
  capacity: number;
  description: string;
  amenities: string[];
  isActive: boolean;
  pricingType: "hourly" | "fixed";
  hourlyRate: string;
  fixedRate: string;
  imageUrls: string[];
  color: string;
}

interface PublicSettings {
  currency?: string;
}

const MAX_ROOMS = 6;

const CURRENCY_SYMBOLS: Record<string, string> = {
  TTD: "TT$",
  USD: "$",
  JMD: "J$",
  BBD: "Bds$",
  XCD: "EC$",
};

export default function AdminRooms() {
  const { toast } = useToast();
  const [editingRooms, setEditingRooms] = useState<Record<string, RoomFormData>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [roomImageInputs, setRoomImageInputs] = useState<Record<string, string>>({});
  const [newRoomData, setNewRoomData] = useState<RoomFormData>({
    name: "",
    capacity: 1,
    description: "",
    amenities: [],
    isActive: true,
    pricingType: "hourly",
    hourlyRate: "0",
    fixedRate: "0",
    imageUrls: [],
    color: "#3b82f6",
  });

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const { data: settings } = useQuery<PublicSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: amenitiesList = [] } = useQuery<Amenity[]>({
    queryKey: ["/api/amenities"],
  });

  const canAddRoom = rooms.length < MAX_ROOMS;

  const getCurrencySymbol = () => {
    const currency = settings?.currency || "USD";
    return CURRENCY_SYMBOLS[currency] || "$";
  };

  const handleOpenAddDialog = () => {
    if (!canAddRoom) {
      toast({
        title: "Room limit reached",
        description: `Maximum of ${MAX_ROOMS} rooms allowed. Delete an existing room to add a new one.`,
        variant: "destructive",
      });
      return;
    }
    setIsAddDialogOpen(true);
  };

  const parseRate = (value: string): string => {
    const parsed = parseFloat(value);
    return isNaN(parsed) || parsed < 0 ? "0" : parsed.toString();
  };

  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Room> }) => {
      await apiRequest("PATCH", `/api/rooms/${id}`, data);
      return id;
    },
    onSuccess: (roomId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "Room updated",
        description: "The room has been updated successfully.",
      });
      const { [roomId]: _, ...remainingEdits } = editingRooms;
      setEditingRooms(remainingEdits);
      const { [roomId]: __, ...remainingInputs } = roomImageInputs;
      setRoomImageInputs(remainingInputs);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to continue.",
          variant: "destructive",
        });
      } else if (error.message.includes("403")) {
        toast({
          title: "Forbidden",
          description: "You do not have permission to update rooms.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update room. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rooms/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "Room deleted",
        description: "The room has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to continue.",
          variant: "destructive",
        });
      } else if (error.message.includes("403")) {
        toast({
          title: "Forbidden",
          description: "You do not have permission to delete rooms.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete room. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: InsertRoom) => {
      await apiRequest("POST", "/api/rooms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "Room created",
        description: "The room has been created successfully.",
      });
      setIsAddDialogOpen(false);
      setNewRoomData({
        name: "",
        capacity: 1,
        description: "",
        amenities: [],
        isActive: true,
        pricingType: "hourly",
        hourlyRate: "0",
        fixedRate: "0",
        imageUrls: [],
        color: "#3b82f6",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to continue.",
          variant: "destructive",
        });
      } else if (error.message.includes("403")) {
        toast({
          title: "Forbidden",
          description: "You do not have permission to create rooms.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to create room. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const getRoomFormData = (room: Room): RoomFormData => {
    return editingRooms[room.id] || {
      name: room.name,
      capacity: room.capacity,
      description: room.description || "",
      amenities: room.amenities || [],
      isActive: room.isActive,
      pricingType: room.pricingType || "hourly",
      hourlyRate: room.hourlyRate || "0",
      fixedRate: room.fixedRate || "0",
      imageUrls: room.imageUrls || [],
      color: room.color || "#3b82f6",
    };
  };

  const updateEditingRoom = (id: string, field: keyof RoomFormData, value: string | number | boolean | string[]) => {
    const room = rooms.find((r) => r.id === id);
    if (!room) return;

    const currentData = getRoomFormData(room);
    setEditingRooms({
      ...editingRooms,
      [id]: {
        ...currentData,
        [field]: value,
      },
    });
  };

  const handleImageUpload = (roomId: string, file: File) => {
    if (file.size > 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image file must be less than 1MB",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      const currentData = getRoomFormData(room);
      updateEditingRoom(roomId, "imageUrls", [...currentData.imageUrls, base64]);
    };
    reader.readAsDataURL(file);
  };

  const handleNewRoomImageUpload = (file: File) => {
    if (file.size > 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image file must be less than 1MB",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setNewRoomData({
        ...newRoomData,
        imageUrls: [...newRoomData.imageUrls, base64],
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImageFromRoom = (roomId: string, index: number) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    const currentData = getRoomFormData(room);
    const newImageUrls = currentData.imageUrls.filter((_, i) => i !== index);
    updateEditingRoom(roomId, "imageUrls", newImageUrls);
  };

  const handleSaveRoom = (room: Room) => {
    const formData = getRoomFormData(room);

    updateRoomMutation.mutate({
      id: room.id,
      data: {
        name: formData.name,
        capacity: formData.capacity,
        description: formData.description,
        amenities: formData.amenities,
        isActive: formData.isActive,
        pricingType: formData.pricingType,
        hourlyRate: parseRate(formData.hourlyRate),
        fixedRate: parseRate(formData.fixedRate),
        imageUrls: formData.imageUrls,
        color: formData.color,
      },
    });
  };

  const handleDeleteRoom = (id: string) => {
    if (confirm("Are you sure you want to delete this room?")) {
      deleteRoomMutation.mutate(id);
    }
  };

  const handleAddRoom = () => {
    createRoomMutation.mutate({
      name: newRoomData.name,
      capacity: newRoomData.capacity,
      description: newRoomData.description || null,
      amenities: newRoomData.amenities,
      isActive: newRoomData.isActive,
      imageUrl: null,
      imageUrls: newRoomData.imageUrls,
      pricingType: newRoomData.pricingType,
      hourlyRate: parseRate(newRoomData.hourlyRate),
      fixedRate: parseRate(newRoomData.fixedRate),
      color: newRoomData.color,
    });
  };

  const removeNewRoomImage = (index: number) => {
    setNewRoomData({
      ...newRoomData,
      imageUrls: newRoomData.imageUrls.filter((_, i) => i !== index),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Room Management</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Room Management</h1>
          <p className="text-muted-foreground">
            Manage available rooms and their settings ({rooms.length}/{MAX_ROOMS} rooms)
          </p>
        </div>
        <Button 
          onClick={handleOpenAddDialog} 
          disabled={!canAddRoom}
          data-testid="button-add-room"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Room
        </Button>
      </div>

      {!canAddRoom && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Maximum of {MAX_ROOMS} rooms reached. Delete an existing room to add a new one.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rooms.map((room) => {
          const formData = getRoomFormData(room);
          return (
            <Card key={room.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-3">
                  {(formData.imageUrls.length > 0 || room.imageUrl) && (
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img 
                        src={formData.imageUrls[0] || room.imageUrl || ""} 
                        alt={room.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">{room.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={formData.isActive ? "default" : "secondary"} data-testid={`badge-status-${room.id}`}>
                        {formData.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {formData.imageUrls.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {formData.imageUrls.length} image{formData.imageUrls.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`capacity-${room.id}`} className="text-sm">Capacity</Label>
                  <Input
                    id={`capacity-${room.id}`}
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => updateEditingRoom(room.id, "capacity", parseInt(e.target.value) || 1)}
                    data-testid={`input-capacity-${room.id}`}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`description-${room.id}`} className="text-sm">Description</Label>
                  <Textarea
                    id={`description-${room.id}`}
                    value={formData.description}
                    onChange={(e) => updateEditingRoom(room.id, "description", e.target.value)}
                    placeholder="Brief description of the room..."
                    rows={3}
                    data-testid={`textarea-description-${room.id}`}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Amenities</Label>
                  <div className="space-y-2 pl-1">
                    {amenitiesList.map((amenity) => (
                      <div key={amenity.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`amenity-${room.id}-${amenity.id}`}
                          checked={formData.amenities.includes(amenity.name)}
                          onCheckedChange={(checked) => {
                            const newAmenities = checked
                              ? [...formData.amenities, amenity.name]
                              : formData.amenities.filter((a) => a !== amenity.name);
                            updateEditingRoom(room.id, "amenities", newAmenities);
                          }}
                          data-testid={`checkbox-amenity-${room.id}-${amenity.id}`}
                        />
                        <Label
                          htmlFor={`amenity-${room.id}-${amenity.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {amenity.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <ColorPicker
                    id={`color-${room.id}`}
                    label="Room Color"
                    value={formData.color}
                    onChange={(color) => updateEditingRoom(room.id, "color", color)}
                  />
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-3 block">Pricing</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`pricingType-${room.id}`} className="text-xs text-muted-foreground">Type</Label>
                      <Select
                        value={formData.pricingType}
                        onValueChange={(value) => updateEditingRoom(room.id, "pricingType", value)}
                      >
                        <SelectTrigger data-testid={`select-pricing-type-${room.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="fixed">Fixed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`hourlyRate-${room.id}`} className="text-xs text-muted-foreground">
                        Hourly ({getCurrencySymbol()})
                      </Label>
                      <Input
                        id={`hourlyRate-${room.id}`}
                        type="number"
                        step="0.01"
                        value={formData.hourlyRate}
                        onChange={(e) => updateEditingRoom(room.id, "hourlyRate", e.target.value)}
                        disabled={formData.pricingType !== "hourly"}
                        data-testid={`input-hourly-rate-${room.id}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`fixedRate-${room.id}`} className="text-xs text-muted-foreground">
                        Fixed ({getCurrencySymbol()})
                      </Label>
                      <Input
                        id={`fixedRate-${room.id}`}
                        type="number"
                        step="0.01"
                        value={formData.fixedRate}
                        onChange={(e) => updateEditingRoom(room.id, "fixedRate", e.target.value)}
                        disabled={formData.pricingType !== "fixed"}
                        data-testid={`input-fixed-rate-${room.id}`}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-3 block">
                    <Image className="w-4 h-4 inline mr-2" />
                    Room Images ({formData.imageUrls.length})
                  </Label>
                  {formData.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.imageUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Room image ${index + 1}`}
                            className="w-16 h-16 rounded-md object-cover border"
                          />
                          <button
                            type="button"
                            onClick={() => removeImageFromRoom(room.id, index)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-remove-image-${room.id}-${index}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(room.id, file);
                          e.target.value = "";
                        }
                      }}
                      className="flex-1 cursor-pointer"
                      data-testid={`input-image-upload-${room.id}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, GIF or WebP. Max 1MB per image.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor={`active-${room.id}`}>Available for booking</Label>
                  <Switch
                    id={`active-${room.id}`}
                    checked={formData.isActive}
                    onCheckedChange={(checked) => updateEditingRoom(room.id, "isActive", checked)}
                    data-testid={`switch-active-${room.id}`}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteRoom(room.id)}
                  disabled={deleteRoomMutation.isPending}
                  data-testid={`button-delete-${room.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveRoom(room)}
                  disabled={updateRoomMutation.isPending}
                  data-testid={`button-save-${room.id}`}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-room-name">Room Name</Label>
              <Input
                id="new-room-name"
                value={newRoomData.name}
                onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                data-testid="input-new-room-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-room-capacity">Capacity</Label>
              <Input
                id="new-room-capacity"
                type="number"
                value={newRoomData.capacity}
                onChange={(e) => setNewRoomData({ ...newRoomData, capacity: parseInt(e.target.value) || 1 })}
                data-testid="input-new-room-capacity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-room-description">Description</Label>
              <Textarea
                id="new-room-description"
                value={newRoomData.description}
                onChange={(e) => setNewRoomData({ ...newRoomData, description: e.target.value })}
                placeholder="Brief description of the room..."
                rows={3}
                data-testid="textarea-new-room-description"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Amenities</Label>
              <div className="space-y-2 pl-1 max-h-40 overflow-y-auto">
                {amenitiesList.map((amenity) => (
                  <div key={amenity.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`new-amenity-${amenity.id}`}
                      checked={newRoomData.amenities.includes(amenity.name)}
                      onCheckedChange={(checked) => {
                        const newAmenities = checked
                          ? [...newRoomData.amenities, amenity.name]
                          : newRoomData.amenities.filter((a) => a !== amenity.name);
                        setNewRoomData({ ...newRoomData, amenities: newAmenities });
                      }}
                      data-testid={`checkbox-new-amenity-${amenity.id}`}
                    />
                    <Label
                      htmlFor={`new-amenity-${amenity.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {amenity.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <ColorPicker
                id="new-room-color"
                label="Room Color"
                value={newRoomData.color}
                onChange={(color) => setNewRoomData({ ...newRoomData, color })}
              />
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">Pricing</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select
                    value={newRoomData.pricingType}
                    onValueChange={(value) => setNewRoomData({ ...newRoomData, pricingType: value as "hourly" | "fixed" })}
                  >
                    <SelectTrigger data-testid="select-new-room-pricing-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Hourly ({getCurrencySymbol()})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newRoomData.hourlyRate}
                    onChange={(e) => setNewRoomData({ ...newRoomData, hourlyRate: e.target.value })}
                    disabled={newRoomData.pricingType !== "hourly"}
                    data-testid="input-new-room-hourly-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Fixed ({getCurrencySymbol()})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newRoomData.fixedRate}
                    onChange={(e) => setNewRoomData({ ...newRoomData, fixedRate: e.target.value })}
                    disabled={newRoomData.pricingType !== "fixed"}
                    data-testid="input-new-room-fixed-rate"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">
                <Image className="w-4 h-4 inline mr-2" />
                Room Images ({newRoomData.imageUrls.length})
              </Label>
              {newRoomData.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {newRoomData.imageUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Room image ${index + 1}`}
                        className="w-14 h-14 rounded-md object-cover border"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewRoomImage(index)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-new-image-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleNewRoomImageUpload(file);
                      e.target.value = "";
                    }
                  }}
                  className="flex-1 cursor-pointer"
                  data-testid="input-new-room-image-upload"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, GIF or WebP. Max 1MB per image.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="new-room-active">Available for booking</Label>
              <Switch
                id="new-room-active"
                checked={newRoomData.isActive}
                onCheckedChange={(checked) => setNewRoomData({ ...newRoomData, isActive: checked })}
                data-testid="switch-new-room-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddRoom}
              disabled={!newRoomData.name || createRoomMutation.isPending}
              data-testid="button-create-room"
            >
              Create Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
