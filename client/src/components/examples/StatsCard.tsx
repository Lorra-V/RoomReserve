import StatsCard from '../StatsCard';
import { Calendar, CheckCircle, Clock, TrendingUp } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Total Bookings"
        value="142"
        icon={Calendar}
        description="All time bookings"
      />
      <StatsCard
        title="Pending Approvals"
        value="8"
        icon={Clock}
        description="Requires review"
      />
      <StatsCard
        title="Active Rooms"
        value="12"
        icon={CheckCircle}
        description="Currently available"
      />
      <StatsCard
        title="Utilization Rate"
        value="67%"
        icon={TrendingUp}
        description="This month"
      />
    </div>
  );
}
