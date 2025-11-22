import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Save, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Room, InsertRoom } from "@shared/schema";

interface RoomFormData {
  name: string;
  capacity: number;
  amenities: string;
  isActive: boolean;
}

export default function AdminRooms() {
  const { toast } = useToast();
  const [editingRooms, setEditingRooms] = useState<Record<string, RoomFormData>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRoomData, setNewRoomData] = useState<RoomFormData>({
    name: "",
    capacity: 1,
    amenities: "",
    isActive: true,
  });

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Room> }) => {
      await apiRequest("PATCH", `/api/rooms/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "Room updated",
        description: "The room has been updated successfully.",
      });
      setEditingRooms({});
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
        amenities: "",
        isActive: true,
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
      amenities: room.amenities.join(", "),
      isActive: room.isActive,
    };
  };

  const updateEditingRoom = (id: string, field: keyof RoomFormData, value: string | number | boolean) => {
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

  const handleSaveRoom = (room: Room) => {
    const formData = getRoomFormData(room);
    const amenitiesArray = formData.amenities
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    updateRoomMutation.mutate({
      id: room.id,
      data: {
        name: formData.name,
        capacity: formData.capacity,
        amenities: amenitiesArray,
        isActive: formData.isActive,
      },
    });
  };

  const handleDeleteRoom = (id: string) => {
    if (confirm("Are you sure you want to delete this room?")) {
      deleteRoomMutation.mutate(id);
    }
  };

  const handleAddRoom = () => {
    const amenitiesArray = newRoomData.amenities
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    createRoomMutation.mutate({
      name: newRoomData.name,
      capacity: newRoomData.capacity,
      amenities: amenitiesArray,
      isActive: newRoomData.isActive,
      imageUrl: null,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Room Management</h1>
          <p className="text-muted-foreground">Manage available rooms and their settings</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-room">
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rooms.map((room) => {
          const formData = getRoomFormData(room);
          return (
            <Card key={room.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-3">
                  {room.imageUrl && (
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">{room.name}</h3>
                    <Badge variant={formData.isActive ? "default" : "secondary"} data-testid={`badge-status-${room.id}`}>
                      {formData.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor={`amenities-${room.id}`} className="text-sm">Amenities</Label>
                    <Input
                      id={`amenities-${room.id}`}
                      value={formData.amenities}
                      onChange={(e) => updateEditingRoom(room.id, "amenities", e.target.value)}
                      data-testid={`input-amenities-${room.id}`}
                    />
                  </div>
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
        <DialogContent>
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
              <Label htmlFor="new-room-amenities">Amenities (comma-separated)</Label>
              <Input
                id="new-room-amenities"
                value={newRoomData.amenities}
                onChange={(e) => setNewRoomData({ ...newRoomData, amenities: e.target.value })}
                data-testid="input-new-room-amenities"
              />
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
