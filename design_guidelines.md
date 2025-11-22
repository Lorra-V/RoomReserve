# Arima Community Centre Room Booking App - Design Guidelines

## Design Approach
**Selected System:** Clean, nature-inspired design with green accents reflecting community growth
**Rationale:** This booking system prioritizes clarity, efficiency, and data visibility while embodying Arima Community Centre's values of Community, Growth, Peace, and History through a warm, welcoming green color palette.

## Core Design Principles
1. **Information Clarity** - Booking data, availability, and status must be instantly scannable
2. **Efficient Workflows** - Minimize clicks from browsing to confirmed booking
3. **Role-Based Hierarchy** - Clear visual distinction between user and admin experiences
4. **Calendar-First Design** - The calendar view is the hero element, not decorative imagery

## Typography System
- **Primary Font:** Inter (Google Fonts) - Modern, highly legible for UI and data
- **Headings:** 
  - Page titles: text-3xl font-semibold
  - Section headers: text-xl font-medium
  - Card titles: text-lg font-medium
- **Body Text:** text-base with text-sm for secondary information
- **Data/Metrics:** font-mono for booking times, room numbers, dates

## Layout & Spacing System
**Spacing Scale:** Tailwind units of 2, 4, 6, and 8 for consistency
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4
- Page margins: px-6 py-8 on mobile, px-8 py-12 on desktop

**Container Strategy:**
- Max-width: max-w-7xl for main content areas
- Full-width calendar views with inner constraints
- Sidebar navigation: fixed width 64 (w-64) on desktop, collapsible on mobile

## Page Layouts

### User-Facing Pages

**Landing/Login Page:**
- Split layout: Left 50% features clean login form, right 50% showcases simplified calendar preview or room grid
- Minimal hero: text-4xl heading "Book Your Space" with text-lg subtitle
- Direct CTA: "Sign In with Replit" button prominently placed
- Small trust indicators: "Used by [X] community members" below login

**Browse Rooms Page:**
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Room cards with: Image placeholder at top, room name, capacity badge, amenity icons row, "View Calendar" CTA
- Filters sidebar (collapsible on mobile): Capacity range, amenities checkboxes, availability date picker

**Room Calendar View:**
- Full-width calendar component (primary focus)
- Week/month toggle in top-right
- Time slots displayed in 30-minute or 1-hour increments
- Booking status: Visual blocks showing booked (solid), available (outlined), pending (dashed border)
- Quick booking panel slides in from right when time slot selected

**User Dashboard:**
- Two-column layout on desktop: Upcoming bookings (left 60%), Quick actions sidebar (right 40%)
- Booking cards with: Room image thumbnail, date/time range, status badge, "Cancel" action
- Empty state: "No upcoming bookings" with CTA to browse rooms

### Admin Dashboard

**Admin Overview:**
- Stats grid at top: grid-cols-2 lg:grid-cols-4 showing total bookings, pending approvals, active rooms, utilization rate
- Main content: Tabs for "All Bookings", "Pending Approvals", "Room Management"
- Data table with sortable columns: Date, Time, Room, User, Status, Actions
- Approve/Reject buttons as icon buttons in action column

**Room Management:**
- Editable room list with inline editing capability
- Add room button fixed to top-right
- Room entries show: Name field, capacity input, amenities multi-select, availability toggle, "Save" action

## Component Library

**Navigation:**
- Top bar with app logo/name left, user profile menu right
- Admin: Additional left sidebar with icons + labels for Dashboard, Bookings, Rooms, Settings
- User: Simplified top nav with "Browse Rooms", "My Bookings", profile dropdown

**Calendar Component:**
- Grid-based layout with clear headers for dates
- Hover states on available slots
- Click to select, shift-click for range selection
- Legend showing status colors positioned above calendar

**Booking Cards:**
- Contained cards with subtle border
- Header: Room name + status badge aligned
- Body: Two-column grid for date/time details
- Footer: Action buttons right-aligned

**Forms:**
- Single-column form layouts with generous field spacing (space-y-4)
- Labels above inputs with text-sm font-medium
- Input fields with defined height (h-10 to h-12)
- Required field indicators with asterisk
- Submit buttons full-width on mobile, auto-width on desktop

**Status Badges:**
- Pill-shaped with rounded-full
- Small text: text-xs font-medium
- Padding: px-3 py-1
- Positioned consistently in card headers

**Data Tables:**
- Striped rows for easier scanning
- Sticky header row
- Action column always right-most
- Responsive: Stack to cards on mobile with key info visible

**Modals/Dialogs:**
- Centered overlay with backdrop blur
- Max-width: max-w-lg for forms, max-w-2xl for detail views
- Header with title and close button
- Footer with action buttons right-aligned

## Responsive Breakpoints
- Mobile (base): Single column, stacked navigation, full-width components
- Tablet (md: 768px): Two-column grids, sidebar appears
- Desktop (lg: 1024px): Full multi-column layouts, persistent navigation

## Images
**Room Images:**
- Aspect ratio: 4:3 for consistency across grid
- Placement: Top of room cards, thumbnail in booking details
- Quality: Professional photos showing room setup, capacity, ambiance
- Fallback: Icon-based placeholder for rooms without images

**No Hero Image:** This is a utility app - jump directly to functionality rather than decorative hero sections.

## Accessibility
- All interactive elements with focus states using ring utility
- Calendar keyboard navigation (arrow keys for date selection)
- ARIA labels for icon-only buttons
- Form validation with clear error messages below fields
- Sufficient contrast for status indicators