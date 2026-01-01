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

function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return "";
  const str = String(text);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  <title>${escapeHtml(centreName)}</title>
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
    p {
      margin: 6px 0;
      line-height: 1.5;
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
    .status-confirmed {
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

interface ExtendedBookingEmailData extends BookingEmailData {
  address?: string | null;
  paymentAmount?: number | null;
  currency?: string | null;
}

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined): string {
  if (!amount) return "N/A";
  const currencySymbol = currency === "USD" ? "$" : currency === "TTD" ? "TT$" : currency || "$";
  return `${currencySymbol}${amount.toFixed(2)}`;
}

function replaceTemplateVariables(
  template: string,
  data: ExtendedBookingEmailData,
  reason?: string
): string {
  return template
    .replace(/\{\{customerName\}\}/g, escapeHtml(data.user.firstName || "Valued Guest"))
    .replace(/\{\{customerEmail\}\}/g, escapeHtml(data.user.email || ""))
    .replace(/\{\{roomName\}\}/g, escapeHtml(data.room.name))
    .replace(/\{\{bookingDate\}\}/g, escapeHtml(formatDate(data.booking.date)))
    .replace(/\{\{startTime\}\}/g, escapeHtml(formatTime(data.booking.startTime)))
    .replace(/\{\{endTime\}\}/g, escapeHtml(formatTime(data.booking.endTime)))
    .replace(/\{\{centreName\}\}/g, escapeHtml(data.centreName))
    .replace(/\{\{centreAddress\}\}/g, escapeHtml(data.address || ""))
    .replace(/\{\{centrePhone\}\}/g, escapeHtml(data.contactPhone || ""))
    .replace(/\{\{centreEmail\}\}/g, escapeHtml(data.contactEmail || ""))
    .replace(/\{\{paymentAmount\}\}/g, escapeHtml(formatCurrency(data.paymentAmount, data.currency)))
    .replace(/\{\{bookingStatus\}\}/g, escapeHtml(data.booking.status.charAt(0).toUpperCase() + data.booking.status.slice(1)))
    .replace(/\{\{rejectionReason\}\}/g, escapeHtml(reason || "No reason provided"))
    .replace(/\{\{eventName\}\}/g, escapeHtml(data.booking.eventName || data.booking.purpose || ""))
    .replace(/\{\{attendees\}\}/g, escapeHtml(data.booking.attendees?.toString() || ""));
}

export function generateBookingConfirmationEmail(data: BookingEmailData | ExtendedBookingEmailData, customTemplate?: string | null): EmailContent {
  const { booking, room, user, centreName, contactEmail, contactPhone } = data;
  
  let messageContent = "";
  const hasCustom = !!(customTemplate && customTemplate.trim());
  if (customTemplate && customTemplate.trim()) {
    const isHtml = customTemplate.includes("<") && customTemplate.includes(">");
    if (isHtml) {
      messageContent = replaceTemplateVariables(customTemplate, data as ExtendedBookingEmailData);
    } else {
      messageContent = `<p>${replaceTemplateVariables(customTemplate, data as ExtendedBookingEmailData).replace(/\n/g, "</p><p>")}</p>`;
    }
  } else {
    messageContent = `
    <p>Thank you for your booking request. We have received your reservation and it is now pending approval.</p>
    `;
  }
  
  const content = `
    <div class="header">
      <h1>${escapeHtml(centreName)}</h1>
    </div>
    
    ${!hasCustom ? `<p>Dear ${escapeHtml(user.firstName || "Valued Guest")},</p>` : ""}

    ${messageContent}
    
    <div class="booking-details">
      <h3>Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${escapeHtml(room.name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${escapeHtml(formatDate(booking.date))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${escapeHtml(formatTime(booking.startTime))} - ${escapeHtml(formatTime(booking.endTime))}</span>
      </div>
      ${booking.purpose ? `
      <div class="detail-row">
        <span class="detail-label">Purpose:</span>
        <span class="detail-value">${escapeHtml(booking.purpose)}</span>
      </div>
      ` : ""}
      ${booking.attendees ? `
      <div class="detail-row">
        <span class="detail-label">Attendees:</span>
        <span class="detail-value">${escapeHtml(booking.attendees.toString())}</span>
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
      ${contactEmail ? `<p>Email: ${escapeHtml(contactEmail)}</p>` : ""}
      ${contactPhone ? `<p>Phone: ${escapeHtml(contactPhone)}</p>` : ""}
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(centreName)}. All rights reserved.</p>
    </div>
  `;

  return {
    to: user.email!,
    subject: `Booking Request Received - ${room.name} on ${formatDate(booking.date)}`,
    html: getBaseTemplate(centreName, content),
  };
}

export function generateBookingApprovalEmail(data: BookingEmailData | ExtendedBookingEmailData, customTemplate?: string | null): EmailContent {
  const { booking, room, user, centreName, contactEmail, contactPhone } = data;
  
  let messageContent = "";
  const hasCustom = !!(customTemplate && customTemplate.trim());
  if (customTemplate && customTemplate.trim()) {
    const isHtml = customTemplate.includes("<") && customTemplate.includes(">");
    if (isHtml) {
      messageContent = replaceTemplateVariables(customTemplate, data as ExtendedBookingEmailData);
    } else {
      messageContent = `<p>${replaceTemplateVariables(customTemplate, data as ExtendedBookingEmailData).replace(/\n/g, "</p><p>")}</p>`;
    }
  } else {
    messageContent = `<p>Great news! Your booking request has been <strong>confirmed</strong>.</p>`;
  }
  
  const content = `
    <div class="header">
      <h1>${escapeHtml(centreName)}</h1>
    </div>
    
    ${!hasCustom ? `<p>Dear ${escapeHtml(user.firstName || "Valued Guest")},</p>` : ""}
    
    ${messageContent}
    
    <div class="booking-details">
      <h3>Confirmed Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${escapeHtml(room.name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${escapeHtml(formatDate(booking.date))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${escapeHtml(formatTime(booking.startTime))} - ${escapeHtml(formatTime(booking.endTime))}</span>
      </div>
      ${booking.purpose ? `
      <div class="detail-row">
        <span class="detail-label">Purpose:</span>
        <span class="detail-value">${escapeHtml(booking.purpose)}</span>
      </div>
      ` : ""}
      ${booking.attendees ? `
      <div class="detail-row">
        <span class="detail-label">Attendees:</span>
        <span class="detail-value">${escapeHtml(booking.attendees.toString())}</span>
      </div>
      ` : ""}
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-confirmed">Confirmed</span></span>
      </div>
    </div>
    
    <p>Please arrive on time for your booking. If you need to cancel or modify your reservation, please contact us as soon as possible.</p>
    
    <div class="footer">
      <p>If you have any questions, please contact us:</p>
      ${contactEmail ? `<p>Email: ${escapeHtml(contactEmail)}</p>` : ""}
      ${contactPhone ? `<p>Phone: ${escapeHtml(contactPhone)}</p>` : ""}
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(centreName)}. All rights reserved.</p>
    </div>
  `;

  return {
    to: user.email!,
    subject: `Booking Confirmed - ${room.name} on ${formatDate(booking.date)}`,
    html: getBaseTemplate(centreName, content),
  };
}

export function generateBookingRejectionEmail(data: BookingEmailData | ExtendedBookingEmailData, reason?: string, customTemplate?: string | null): EmailContent {
  const { booking, room, user, centreName, contactEmail, contactPhone } = data;
  
  let messageContent = "";
  const hasCustom = !!(customTemplate && customTemplate.trim());
  if (customTemplate && customTemplate.trim()) {
    const isHtml = customTemplate.includes("<") && customTemplate.includes(">");
    if (isHtml) {
      messageContent = replaceTemplateVariables(customTemplate, data as ExtendedBookingEmailData, reason);
    } else {
      messageContent = `<p>${replaceTemplateVariables(customTemplate, data as ExtendedBookingEmailData, reason).replace(/\n/g, "</p><p>")}</p>`;
    }
  } else {
    messageContent = `<p>We regret to inform you that your booking request has been <strong>declined</strong>.</p>`;
  }
  
  const content = `
    <div class="header">
      <h1>${escapeHtml(centreName)}</h1>
    </div>
    
    ${!hasCustom ? `<p>Dear ${escapeHtml(user.firstName || "Valued Guest")},</p>` : ""}
    
    ${messageContent}
    
    <div class="booking-details">
      <h3>Booking Request Details</h3>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${escapeHtml(room.name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${escapeHtml(formatDate(booking.date))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${escapeHtml(formatTime(booking.startTime))} - ${escapeHtml(formatTime(booking.endTime))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-cancelled">Declined</span></span>
      </div>
      ${reason ? `
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${escapeHtml(reason)}</span>
      </div>
      ` : ""}
    </div>
    
    <p>If you believe this was an error or would like to discuss alternative booking options, please don't hesitate to contact us.</p>
    
    <div class="footer">
      <p>If you have any questions, please contact us:</p>
      ${contactEmail ? `<p>Email: ${escapeHtml(contactEmail)}</p>` : ""}
      ${contactPhone ? `<p>Phone: ${escapeHtml(contactPhone)}</p>` : ""}
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(centreName)}. All rights reserved.</p>
    </div>
  `;

  return {
    to: user.email!,
    subject: `Booking Request Declined - ${room.name} on ${formatDate(booking.date)}`,
    html: getBaseTemplate(centreName, content),
  };
}

export function generateBookingCancellationEmail(data: BookingEmailData | ExtendedBookingEmailData, customTemplate?: string | null): EmailContent {
  const { booking, room, user, centreName, contactEmail, contactPhone } = data;
  
  let messageContent = "";
  const hasCustom = !!(customTemplate && customTemplate.trim());
  if (customTemplate && customTemplate.trim()) {
    const isHtml = customTemplate.includes("<") && customTemplate.includes(">");
    if (isHtml) {
      messageContent = replaceTemplateVariables(customTemplate, data as ExtendedBookingEmailData);
    } else {
      messageContent = `<p>${replaceTemplateVariables(customTemplate, data as ExtendedBookingEmailData).replace(/\n/g, "</p><p>")}</p>`;
    }
  } else {
    messageContent = `<p>This email confirms that your booking has been <strong>cancelled</strong>.</p>`;
  }
  
  const content = `
    <div class="header">
      <h1>${escapeHtml(centreName)}</h1>
    </div>
    
    ${!hasCustom ? `<p>Dear ${escapeHtml(user.firstName || "Valued Guest")},</p>` : ""}
    
    ${messageContent}
    
    <div class="booking-details">
      <h3>Cancelled Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${escapeHtml(room.name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${escapeHtml(formatDate(booking.date))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${escapeHtml(formatTime(booking.startTime))} - ${escapeHtml(formatTime(booking.endTime))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-cancelled">Cancelled</span></span>
      </div>
    </div>
    
    <p>If you would like to make a new booking, please visit our website.</p>
    
    <div class="footer">
      <p>If you have any questions, please contact us:</p>
      ${contactEmail ? `<p>Email: ${escapeHtml(contactEmail)}</p>` : ""}
      ${contactPhone ? `<p>Phone: ${escapeHtml(contactPhone)}</p>` : ""}
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(centreName)}. All rights reserved.</p>
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
      <h1>${escapeHtml(centreName)} - Admin Notification</h1>
    </div>
    
    <p>A new booking request has been submitted and requires your attention.</p>
    
    <div class="booking-details">
      <h3>New Booking Request</h3>
      <div class="detail-row">
        <span class="detail-label">Guest:</span>
        <span class="detail-value">${escapeHtml([user.firstName, user.lastName].filter(Boolean).join(" "))} (${escapeHtml(user.email || "")})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Room:</span>
        <span class="detail-value">${escapeHtml(room.name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${escapeHtml(formatDate(booking.date))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${escapeHtml(formatTime(booking.startTime))} - ${escapeHtml(formatTime(booking.endTime))}</span>
      </div>
      ${booking.purpose ? `
      <div class="detail-row">
        <span class="detail-label">Purpose:</span>
        <span class="detail-value">${escapeHtml(booking.purpose)}</span>
      </div>
      ` : ""}
      ${booking.attendees ? `
      <div class="detail-row">
        <span class="detail-label">Attendees:</span>
        <span class="detail-value">${escapeHtml(booking.attendees.toString())}</span>
      </div>
      ` : ""}
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value"><span class="status-badge status-pending">Pending Approval</span></span>
      </div>
    </div>
    
    <p>Please log in to the admin dashboard to review and process this booking request.</p>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${escapeHtml(centreName)}. All rights reserved.</p>
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
      console.log(`✓ SendGrid: Email sent successfully to ${email.to}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`✗ SendGrid error (${response.status}): ${errorText}`);
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors) {
          console.error(`   Details:`, JSON.stringify(errorJson.errors, null, 2));
        }
      } catch {
        // If parsing fails, just use the text
      }
      return false;
    }
  } catch (error) {
    console.error("✗ SendGrid error:", error);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    return false;
  }
}

async function sendWithResend(apiKey: string, from: string, email: EmailContent, replyTo?: string): Promise<boolean> {
  try {
    const payload: any = {
      from: from,
      to: email.to,
      subject: email.subject,
      html: email.html,
    };
    
    if (replyTo) {
      payload.reply_to = replyTo;
    }
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✓ Resend: Email sent successfully to ${email.to}, id: ${result.id}`);
      return true;
    } else {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = `Failed to read error response: ${e instanceof Error ? e.message : String(e)}`;
      }
      console.error(`✗ Resend error (${response.status}): ${errorText}`);
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          console.error(`   Message: ${errorJson.message}`);
        }
      } catch {
        // If parsing fails, just use the text
      }
      return false;
    }
  } catch (error) {
    console.error("✗ Resend error:", error);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
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

    console.log(`✓ SMTP: Email sent successfully to ${email.to}`);
    return true;
  } catch (error) {
    console.error("✗ SMTP error:", error);
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      if (error.message.includes("Invalid login")) {
        console.error("   → Check SMTP username and password");
      } else if (error.message.includes("ECONNREFUSED") || error.message.includes("ETIMEDOUT")) {
        console.error("   → Check SMTP host and port settings");
      } else if (error.message.includes("certificate")) {
        console.error("   → Try enabling/disabling 'SMTP Secure' option");
      }
    }
    return false;
  }
}

export async function sendEmail(email: EmailContent): Promise<boolean> {
  try {
    console.log(`[Email Service] Attempting to send email to: ${email.to}`);
    console.log(`[Email Service] Subject: ${email.subject}`);
    
    const settings = await storage.getSiteSettings();
    
    if (!settings) {
      console.error("✗ Email not sent: Site settings not found");
      return false;
    }
    
    console.log(`[Email Service] Email provider configured: ${settings.emailProvider}`);
    console.log(`[Email Service] Email from address: ${settings.emailFromAddress || "NOT SET"}`);
    console.log(`[Email Service] Notify on new booking: ${settings.notifyOnNewBooking ?? true}`);
    
    if (settings.emailProvider === "none") {
      console.log("⚠ Email notifications disabled - email provider set to 'none'");
      console.log("   To enable emails, go to Admin Settings > Notifications and configure an email provider");
      return false;
    }
    
    const replyToEmail = settings.contactEmail || undefined;
    
    if (settings.emailProvider === "smtp") {
      if (!settings.emailFromAddress) {
        console.error("✗ SMTP email not sent - missing 'from' address");
        console.error("   Configure 'Email From Address' in Admin Settings > Notifications");
        return false;
      }
      if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
        console.error("✗ SMTP email not sent - missing configuration");
        console.error("   Required: SMTP Host, SMTP User, SMTP Password");
        console.error(`   Current config: Host=${!!settings.smtpHost}, User=${!!settings.smtpUser}, Password=${!!settings.smtpPassword}`);
        console.error("   Configure in Admin Settings > Notifications");
        return false;
      }
      console.log(`[Email Service] Attempting to send email via SMTP to ${email.to}...`);
      console.log(`[Email Service] SMTP Host: ${settings.smtpHost}, Port: ${settings.smtpPort || 587}`);
      const result = await sendWithSmtp({
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        user: settings.smtpUser,
        password: settings.smtpPassword,
        secure: settings.smtpSecure || false,
      }, settings.emailFromAddress, email);
      if (!result) {
        console.error(`[Email Service] SMTP send failed for ${email.to}`);
      }
      return result;
    } else if (settings.emailProvider === "sendgrid") {
      if (!settings.emailFromAddress) {
        console.error("✗ SendGrid email not sent - missing 'from' address");
        console.error("   Configure 'Email From Address' in Admin Settings > Notifications");
        return false;
      }
      if (!settings.emailApiKey) {
        console.error("✗ SendGrid email not sent - missing API key");
        console.error("   Configure 'Email API Key' in Admin Settings > Integrations");
        return false;
      }
      console.log(`[Email Service] Attempting to send email via SendGrid to ${email.to}...`);
      const result = await sendWithSendGrid(settings.emailApiKey, settings.emailFromAddress, email);
      if (!result) {
        console.error(`[Email Service] SendGrid send failed for ${email.to}`);
      }
      return result;
    } else if (settings.emailProvider === "resend") {
      const apiKey = process.env.RESEND_API_KEY || settings.emailApiKey;
      if (!apiKey) {
        console.error("✗ Resend email not sent - missing API key");
        console.error(`   RESEND_API_KEY env var: ${!!process.env.RESEND_API_KEY}`);
        console.error(`   Settings emailApiKey: ${!!settings.emailApiKey}`);
        console.error("   Set RESEND_API_KEY environment variable or configure in Admin Settings > Integrations");
        return false;
      }
      const fromAddress = settings.emailFromAddress || "onboarding@resend.dev";
      console.log(`[Email Service] Attempting to send email via Resend to ${email.to}...`);
      console.log(`[Email Service] From address: ${fromAddress}`);
      const result = await sendWithResend(apiKey, fromAddress, email, replyToEmail);
      if (!result) {
        console.error(`[Email Service] Resend send failed for ${email.to}`);
      }
      return result;
    }
    
    console.error(`✗ Email not sent - unknown email provider: ${settings.emailProvider}`);
    return false;
  } catch (error) {
    console.error("✗ Error sending email:", error);
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      console.error(`   Stack trace: ${error.stack}`);
    }
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
    console.log(`[Email Notification] Starting ${type} notification for booking ${booking.id}`);
    console.log(`[Email Notification] User: ${user.email || "NO EMAIL"} (ID: ${user.id})`);
    
    const settings = await storage.getSiteSettings();
    if (!settings) {
      console.error(`[Email Notification] Cannot send ${type} email: Site settings not found`);
      return;
    }
    
    const rate = room.fixedRate || room.hourlyRate;
    const emailData: ExtendedBookingEmailData = {
      booking,
      room,
      user,
      centreName: settings.centreName,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      address: settings.address,
      paymentAmount: rate ? parseFloat(rate) : null,
      currency: settings.currency,
    };
    
    let email: EmailContent;
    let shouldNotify = false;
    
    switch (type) {
      case "confirmation":
        email = generateBookingConfirmationEmail(emailData, settings.emailConfirmationTemplate);
        shouldNotify = settings.notifyOnNewBooking ?? true;
        console.log(`[Email Notification] Confirmation notification enabled: ${shouldNotify}`);
        break;
      case "approval":
        email = generateBookingApprovalEmail(emailData, settings.emailApprovalTemplate);
        shouldNotify = settings.notifyOnApproval ?? true;
        console.log(`[Email Notification] Approval notification enabled: ${shouldNotify}`);
        break;
      case "rejection":
        email = generateBookingRejectionEmail(emailData, reason, settings.emailRejectionTemplate);
        shouldNotify = settings.notifyOnApproval ?? true;
        console.log(`[Email Notification] Rejection notification enabled: ${shouldNotify}`);
        break;
      case "cancellation":
        email = generateBookingCancellationEmail(emailData, settings.emailCancellationTemplate);
        shouldNotify = settings.notifyOnCancellation ?? true;
        console.log(`[Email Notification] Cancellation notification enabled: ${shouldNotify}`);
        break;
    }
    
    if (shouldNotify && user.email) {
      console.log(`[Email Notification] Sending ${type} email to ${user.email}...`);
      const emailSent = await sendEmail(email);
      if (emailSent) {
        console.log(`✓ ${type} email sent successfully to ${user.email}`);
      } else {
        console.error(`✗ Failed to send ${type} email to ${user.email}. Check email configuration.`);
        console.error(`   Please check the server logs above for detailed error messages.`);
      }
    } else {
      if (!shouldNotify) {
        console.log(`⚠ ${type} email not sent: notifications disabled for this type in settings`);
      } else if (!user.email) {
        console.log(`⚠ ${type} email not sent: user ${user.id} has no email address`);
      }
    }
    
    if (type === "confirmation" && settings.notifyOnNewBooking) {
      const adminRecipient = settings.contactEmail || settings.emailFromAddress;
      if (!adminRecipient) {
        console.log(`⚠ Admin notification skipped: no contactEmail or emailFromAddress configured`);
        return;
      }
      console.log(`[Email Notification] Sending admin notification to ${adminRecipient}...`);
      const adminEmail = generateAdminNewBookingEmail(emailData, adminRecipient);
      const adminEmailSent = await sendEmail(adminEmail);
      if (adminEmailSent) {
        console.log(`✓ Admin notification email sent successfully to ${settings.contactEmail}`);
      } else {
        console.error(`✗ Failed to send admin notification email to ${settings.contactEmail}`);
      }
    }
  } catch (error) {
    console.error(`[Email Notification] Error sending ${type} notification:`, error);
    if (error instanceof Error) {
      console.error(`   Error details: ${error.message}`);
      console.error(`   Stack trace: ${error.stack}`);
    }
  }
}
