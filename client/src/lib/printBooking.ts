import type { BookingWithMeta } from "@shared/schema";

interface PrintBookingOptions {
  booking: BookingWithMeta;
  allBookings: BookingWithMeta[];
  formatDate: (date: Date | string | number | null | undefined) => string;
  roomName?: string;
}

export function printBooking({ booking, allBookings, formatDate, roomName }: PrintBookingOptions) {
  const seriesBookings = booking.bookingGroupId
    ? allBookings
        .filter(b => b.bookingGroupId === booking.bookingGroupId)
        .sort((a, b) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          return da !== db ? da - db : a.startTime.localeCompare(b.startTime);
        })
    : [];

  const uniqueDates = booking.bookingGroupId
    ? new Set(seriesBookings.map(b => formatDate(b.date))).size
    : 0;
  const isRecurringSeries = uniqueDates > 1 && seriesBookings.length > 1;

  const displayRoomName = roomName || booking.roomName;

  const seriesRowsHtml = isRecurringSeries
    ? seriesBookings
        .map(
          (b, i) =>
            `<tr>
              <td style="padding:6px 12px;border:1px solid #ddd;text-align:center">${i + 1}</td>
              <td style="padding:6px 12px;border:1px solid #ddd">${formatDate(b.date) || "\u2014"}</td>
              <td style="padding:6px 12px;border:1px solid #ddd">${b.startTime} - ${b.endTime}</td>
              <td style="padding:6px 12px;border:1px solid #ddd">${b.roomName}</td>
              <td style="padding:6px 12px;border:1px solid #ddd;text-transform:capitalize">${b.status}</td>
            </tr>`
        )
        .join("")
    : "";

  const printHtml = `<!DOCTYPE html>
<html><head>
<title>Booking - ${booking.userName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding:40px; color:#1a1a1a; font-size:14px; }
  h1 { font-size:22px; margin-bottom:4px; }
  .subtitle { color:#666; font-size:13px; margin-bottom:24px; }
  .section { margin-bottom:24px; }
  .section-title { font-size:15px; font-weight:600; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #e5e5e5; }
  .detail-grid { display:grid; grid-template-columns:160px 1fr; gap:6px 16px; }
  .detail-label { color:#666; font-size:13px; }
  .detail-value { font-size:13px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { background:#f5f5f5; padding:8px 12px; border:1px solid #ddd; text-align:left; font-weight:600; }
  td { padding:6px 12px; border:1px solid #ddd; }
  .badge { display:inline-block; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:500; }
  .badge-confirmed { background:#dcfce7; color:#166534; }
  .badge-pending { background:#fef9c3; color:#854d0e; }
  .badge-cancelled { background:#fee2e2; color:#991b1b; }
  .notes { background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px 14px; font-size:13px; white-space:pre-wrap; }
  @media print {
    body { padding:20px; }
    @page { margin:15mm; }
  }
</style>
</head><body>
<h1>Booking Confirmation</h1>
<p class="subtitle">Printed on ${formatDate(new Date())}</p>

<div class="section">
  <div class="section-title">Customer Details</div>
  <div class="detail-grid">
    <span class="detail-label">Name</span>
    <span class="detail-value">${booking.userName}</span>
    <span class="detail-label">Email</span>
    <span class="detail-value">${booking.userEmail || "\u2014"}</span>
    <span class="detail-label">Phone</span>
    <span class="detail-value">${booking.userPhone || "\u2014"}</span>
    <span class="detail-label">Organization</span>
    <span class="detail-value">${booking.userOrganization || "\u2014"}</span>
  </div>
</div>

<div class="section">
  <div class="section-title">Booking Details</div>
  <div class="detail-grid">
    <span class="detail-label">Room</span>
    <span class="detail-value">${displayRoomName}</span>
    ${booking.eventName ? `<span class="detail-label">Event Name</span><span class="detail-value">${booking.eventName}</span>` : ""}
    <span class="detail-label">Purpose</span>
    <span class="detail-value">${booking.purpose}</span>
    ${!isRecurringSeries ? `<span class="detail-label">Date</span><span class="detail-value">${formatDate(booking.date) || "\u2014"}</span>` : ""}
    <span class="detail-label">Time</span>
    <span class="detail-value">${booking.startTime} - ${booking.endTime}</span>
    <span class="detail-label">Attendees</span>
    <span class="detail-value">${booking.attendees}</span>
    <span class="detail-label">Status</span>
    <span class="detail-value"><span class="badge badge-${booking.status}">${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</span></span>
    <span class="detail-label">Visibility</span>
    <span class="detail-value">${(booking.visibility || "private").charAt(0).toUpperCase() + (booking.visibility || "private").slice(1)}</span>
    ${booking.selectedItems && booking.selectedItems.length > 0 ? `<span class="detail-label">Additional Items</span><span class="detail-value">${booking.selectedItems.join(", ")}</span>` : ""}
  </div>
</div>

${isRecurringSeries ? `
<div class="section">
  <div class="section-title">Recurring Booking Dates (${seriesBookings.length} bookings)</div>
  <table>
    <thead>
      <tr>
        <th style="width:50px;text-align:center">#</th>
        <th>Date</th>
        <th>Time</th>
        <th>Room</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${seriesRowsHtml}</tbody>
  </table>
</div>
` : ""}

${booking.adminNotes?.trim() ? `
<div class="section">
  <div class="section-title">Admin Notes</div>
  <div class="notes">${booking.adminNotes}</div>
</div>
` : ""}

</body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
