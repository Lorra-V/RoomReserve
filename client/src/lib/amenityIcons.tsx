import { 
  Wifi, 
  Monitor, 
  Coffee, 
  Table, 
  Armchair, 
  Projector, 
  Music, 
  Video, 
  Mic, 
  Star,
  Tv,
  Speaker,
  Phone,
  Printer,
  AirVent,
  Snowflake,
  Lightbulb,
  DoorOpen,
  SquareStack,
  CircleDot,
  Car,
  ParkingCircle,
  type LucideIcon
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  // WiFi variants
  Wifi,
  "Wi-Fi": Wifi,
  wifi: Wifi,
  
  // Display variants
  Monitor,
  Projector,
  projector: Projector,
  monitor: Monitor,
  Tv,
  Screen: Monitor,
  screen: Monitor,
  
  // Furniture
  Table: SquareStack,
  table: SquareStack,
  Tables: SquareStack,
  tables: SquareStack,
  Chairs: CircleDot,
  chairs: CircleDot,
  chair: CircleDot,
  Armchair: CircleDot,
  
  // Refreshments
  Coffee,
  coffee: Coffee,
  
  // Audio/Video
  Music,
  music: Music,
  Video,
  video: Video,
  Mic,
  mic: Mic,
  microphone: Mic,
  Speaker,
  speaker: Speaker,
  audio: Speaker,
  
  // Office equipment
  Phone,
  phone: Phone,
  Printer,
  printer: Printer,
  
  // Climate control
  AirVent,
  "Air Conditioning": AirVent,
  "air conditioning": AirVent,
  AC: AirVent,
  ac: AirVent,
  Snowflake,
  
  // Lighting
  Lightbulb,
  lighting: Lightbulb,
  
  // Access
  DoorOpen,
  
  // Parking
  Parking: ParkingCircle,
  parking: ParkingCircle,
  Car,
  car: Car,
  
  // Default
  Star,
  star: Star,
};

export function getAmenityIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Star;
}

export function getAmenityIconByName(amenityName: string): LucideIcon {
  // Try exact match first
  if (iconMap[amenityName]) {
    return iconMap[amenityName];
  }
  
  // Try lowercase match
  const lowerName = amenityName.toLowerCase();
  if (iconMap[lowerName]) {
    return iconMap[lowerName];
  }
  
  // Try partial matches
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return icon;
    }
  }
  
  return Star;
}

export const availableIcons = [
  { name: "Star", icon: "Star" },
  { name: "Wi-Fi", icon: "Wifi" },
  { name: "Monitor", icon: "Monitor" },
  { name: "Projector", icon: "Projector" },
  { name: "TV", icon: "Tv" },
  { name: "Table", icon: "Table" },
  { name: "Chairs", icon: "Armchair" },
  { name: "Coffee", icon: "Coffee" },
  { name: "Music", icon: "Music" },
  { name: "Video", icon: "Video" },
  { name: "Microphone", icon: "Mic" },
  { name: "Speaker", icon: "Speaker" },
  { name: "Phone", icon: "Phone" },
  { name: "Printer", icon: "Printer" },
  { name: "Air Conditioning", icon: "AirVent" },
  { name: "Lighting", icon: "Lightbulb" },
];

