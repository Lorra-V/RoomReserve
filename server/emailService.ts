import { storage } from "./storage";
import type { Booking, Room, User } from "@shared/schema";
import nodemailer from "nodemailer";

interface EmailContent {
  to: string;
  subject: string;
  html: string;
}

interface BookingEmailData {
  booking: Booking;
  room: Room;
  user: User;
  centreName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function getBaseTemplate(centreName: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${centreName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #16a34a;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #16a34a;
      margin: 0;
      font-size: 24px;
    }
    .booking-details {
      background: #f8faf8;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .booking-details h3 {
      margin-top: 0;
      color: #16a34a;
    }
    .detail-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #6b7280;
      min-width: 120px;
    }
    .detail-value {
      color: #111827;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 500;
    }
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    .status-approved {
      background: #d1fae5;
      color: #065f46;
    }
    .status-cancelled {
      background: #fee2e2;
      color: #991b1b;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .cta-button {
      display: inline-block;
      background: #16a34a;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
</body>
</html>
`;
}

export function generateBookingConfirmationEmail(data: BookingEmailData): EmailContent {
  const { booking, room, user, centreName, contactEmail, contactPhone } = data;
  
  const content = `
    <div class="header">
      <h1>${centreName}</h1>
    </div>
    
    <p>Dear ${user.firstName || "Valued Guest"},</p>
    
    <p>Thank you for your booking request. We have received your reservation and it is now pending approval.</p>
    
    <div class="booking-details">
      <h3>Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${room.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${formatDate(booking.date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}</span>
      </div>
      ${booking.purpose ? `
      <div class="detail-row">
        <span class="detail-label">Purpose:</span>
        <span class="detail-value">${booking.purpose}</span>
      </div>
      ` : ""}
      ${booking.attendees ? `
      <div class="detail-row">
        <span class="detail-label">Attendees:</span>
        <span class="detail-value">${booking.attendees}</span>
      </div>
      ` : ""}
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-pending">Pending Approval</span></span>
      </div>
    </div>
    
    <p>You will receive another email once your booking has been reviewed by our staff.</p>
    
    <div class="footer">
      <p>If you have any questions, please contact us:</p>
      ${contactEmail ? `<p>Email: ${contactEmail}</p>` : ""}
      ${contactPhone ? `<p>Phone: ${contactPhone}</p>` : ""}
      <p>&copy; ${new Date().getFullYear()} ${centreName}. All rights reserved.</p>
    </div>
  `;

  return {
    to: user.email!,
    subject: `Booking Request Received - ${room.name} on ${formatDate(booking.date)}`,
    html: getBaseTemplate(centreName, content),
  };
}

export function generateBookingApprovalEmail(data: BookingEmailData): EmailContent {
  const { booking, room, user, centreName, contactEmail, contactPhone } = data;
  
  const content = `
    <div class="header">
      <h1>${centreName}</h1>
    </div>
    
    <p>Dear ${user.firstName || "Valued Guest"},</p>
    
    <p>Great news! Your booking request has been <strong>approved</strong>.</p>
    
    <div class="booking-details">
      <h3>Confirmed Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${room.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${formatDate(booking.date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}</span>
      </div>
      ${booking.purpose ? `
      <div class="detail-row">
        <span class="detail-label">Purpose:</span>
        <span class="detail-value">${booking.purpose}</span>
      </div>
      ` : ""}
      ${booking.attendees ? `
      <div class="detail-row">
        <span class="detail-label">Attendees:</span>
        <span class="detail-value">${booking.attendees}</span>
      </div>
      ` : ""}
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-approved">Approved</span></span>
      </div>
    </div>
    
    <p>Please arrive on time for your booking. If you need to cancel or modify your reservation, please contact us as soon as possible.</p>
    
    <div class="footer">
      <p>If you have any questions, please contact us:</p>
      ${contactEmail ? `<p>Email: ${contactEmail}</p>` : ""}
      ${contactPhone ? `<p>Phone: ${contactPhone}</p>` : ""}
      <p>&copy; ${new Date().getFullYear()} ${centreName}. All rights reserved.</p>
    </div>
  `;

  return {
    to: user.email!,
    subject: `Booking Confirmed - ${room.name} on ${formatDate(booking.date)}`,
    html: getBaseTemplate(centreName, content),
  };
}

export function generateBookingRejectionEmail(data: BookingEmailData, reason?: string): EmailContent {
  const { booking, room, user, centreName, contactEmail, contactPhone } = data;
  
  const content = `
    <div class="header">
      <h1>${centreName}</h1>
    </div>
    
    <p>Dear ${user.firstName || "Valued Guest"},</p>
    
    <p>We regret to inform you that your booking request has been <strong>declined</strong>.</p>
    
    <div class="booking-details">
      <h3>Booking Request Details</h3>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${room.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${formatDate(booking.date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-cancelled">Declined</span></span>
      </div>
      ${reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason}</span>
      </div>
      ` : ""}
    </div>
    
    <p>If you believe this was an error or would like to discuss alternative booking options, please don't hesitate to contact us.</p>
    
    <div class="footer">
      <p>If you have any questions, please contact us:</p>
      ${contactEmail ? `<p>Email: ${contactEmail}</p>` : ""}
      ${contactPhone ? `<p>Phone: ${contactPhone}</p>` : ""}
      <p>&copy; ${new Date().getFullYear()} ${centreName}. All rights reserved.</p>
    </div>
  `;

  return {
    to: user.email!,
    subject: `Booking Request Declined - ${room.name} on ${formatDate(booking.date)}`,
    html: getBaseTemplate(centreName, content),
  };
}

export function generateBookingCancellationEmail(data: BookingEmailData): EmailContent {
  const { booking, room, user, centreName, contactEmail, contactPhone } = data;
  
  const content = `
    <div class="header">
      <h1>${centreName}</h1>
    </div>
    
    <p>Dear ${user.firstName || "Valued Guest"},</p>
    
    <p>This email confirms that your booking has been <strong>cancelled</strong>.</p>
    
    <div class="booking-details">
      <h3>Cancelled Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${room.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${formatDate(booking.date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-cancelled">Cancelled</span></span>
      </div>
    </div>
    
    <p>If you would like to make a new booking, please visit our website.</p>
    
    <div class="footer">
      <p>If you have any questions, please contact us:</p>
      ${contactEmail ? `<p>Email: ${contactEmail}</p>` : ""}
      ${contactPhone ? `<p>Phone: ${contactPhone}</p>` : ""}
      <p>&copy; ${new Date().getFullYear()} ${centreName}. All rights reserved.</p>
    </div>
  `;

  return {
    to: user.email!,
    subject: `Booking Cancelled - ${room.name} on ${formatDate(booking.date)}`,
    html: getBaseTemplate(centreName, content),
  };
}

export function generateAdminNewBookingEmail(data: BookingEmailData, adminEmail: string): EmailContent {
  const { booking, room, user, centreName } = data;
  
  const content = `
    <div class="header">
      <h1>${centreName} - Admin Notification</h1>
    </div>
    
    <p>A new booking request has been submitted and requires your attention.</p>
    
    <div class="booking-details">
      <h3>New Booking Request</h3>
      <div class="detail-row">
        <span class="detail-label">Guest:</span>
        <span class="detail-value">${user.firstName || ""} ${user.lastName || ""} (${user.email})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${room.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${formatDate(booking.date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}</span>
      </div>
      ${booking.purpose ? `
      <div class="detail-row">
        <span class="detail-label">Purpose:</span>
        <span class="detail-value">${booking.purpose}</span>
      </div>
      ` : ""}
      ${booking.attendees ? `
      <div class="detail-row">
        <span class="detail-label">Attendees:</span>
        <span class="detail-value">${booking.attendees}</span>
      </div>
      ` : ""}
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-pending">Pending Approval</span></span>
      </div>
    </div>
    
    <p>Please log in to the admin dashboard to review and process this booking request.</p>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${centreName}. All rights reserved.</p>
    </div>
  `;

  return {
    to: adminEmail,
    subject: `New Booking Request - ${room.name} on ${formatDate(booking.date)}`,
    html: getBaseTemplate(centreName, content),
  };
}

async function sendWithSendGrid(apiKey: string, from: string, email: EmailContent): Promise<boolean> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: email.to }] }],
        from: { email: from },
        subject: email.subject,
        content: [{ type: "text/html", value: email.html }],
      }),
    });
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`Email sent successfully to ${email.to}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`SendGrid error: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error("SendGrid error:", error);
    return false;
  }
}

async function sendWithResend(apiKey: string, from: string, email: EmailContent): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from,
        to: email.to,
        subject: email.subject,
        html: email.html,
      }),
    });
    
    if (response.ok) {
      console.log(`Email sent successfully to ${email.to}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`Resend error: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error("Resend error:", error);
    return false;
  }
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

async function sendWithSmtp(config: SmtpConfig, from: string, email: EmailContent): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    await transporter.sendMail({
      from: from,
      to: email.to,
      subject: email.subject,
      html: email.html,
    });

    console.log(`Email sent successfully to ${email.to} via SMTP`);
    return true;
  } catch (error) {
    console.error("SMTP error:", error);
    return false;
  }
}

export async function sendEmail(email: EmailContent): Promise<boolean> {
  try {
    const settings = await storage.getSiteSettings();
    
    if (!settings || settings.emailProvider === "none") {
      console.log("Email notifications disabled - skipping send");
      return false;
    }
    
    if (!settings.emailFromAddress) {
      console.log("Email not configured - missing from address");
      return false;
    }
    
    if (settings.emailProvider === "smtp") {
      if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
        console.log("SMTP not configured - missing host, user, or password");
        return false;
      }
      return await sendWithSmtp({
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        user: settings.smtpUser,
        password: settings.smtpPassword,
        secure: settings.smtpSecure || false,
      }, settings.emailFromAddress, email);
    } else if (settings.emailProvider === "sendgrid") {
      if (!settings.emailApiKey) {
        console.log("SendGrid not configured - missing API key");
        return false;
      }
      return await sendWithSendGrid(settings.emailApiKey, settings.emailFromAddress, email);
    } else if (settings.emailProvider === "resend") {
      if (!settings.emailApiKey) {
        console.log("Resend not configured - missing API key");
        return false;
      }
      return await sendWithResend(settings.emailApiKey, settings.emailFromAddress, email);
    }
    
    return false;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export async function sendBookingNotification(
  type: "confirmation" | "approval" | "rejection" | "cancellation",
  booking: Booking,
  room: Room,
  user: User,
  reason?: string
): Promise<void> {
  try {
    const settings = await storage.getSiteSettings();
    if (!settings) return;
    
    const emailData: BookingEmailData = {
      booking,
      room,
      user,
      centreName: settings.centreName,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
    };
    
    let email: EmailContent;
    let shouldNotify = false;
    
    switch (type) {
      case "confirmation":
        email = generateBookingConfirmationEmail(emailData);
        shouldNotify = settings.notifyOnNewBooking ?? true;
        break;
      case "approval":
        email = generateBookingApprovalEmail(emailData);
        shouldNotify = settings.notifyOnApproval ?? true;
        break;
      case "rejection":
        email = generateBookingRejectionEmail(emailData, reason);
        shouldNotify = settings.notifyOnApproval ?? true;
        break;
      case "cancellation":
        email = generateBookingCancellationEmail(emailData);
        shouldNotify = settings.notifyOnCancellation ?? true;
        break;
    }
    
    if (shouldNotify && user.email) {
      await sendEmail(email);
    }
    
    if (type === "confirmation" && settings.notifyOnNewBooking && settings.contactEmail) {
      const adminEmail = generateAdminNewBookingEmail(emailData, settings.contactEmail);
      await sendEmail(adminEmail);
    }
  } catch (error) {
    console.error(`Error sending ${type} notification:`, error);
  }
}
