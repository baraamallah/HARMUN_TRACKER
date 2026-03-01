
# MUN Attendance Tracker

The MUN Attendance Tracker is a Next.js application designed to help manage and track participant and staff attendance for Model United Nations conferences. It features an admin dashboard for managing participants, a separate dashboard for staff, a public view for general participant attendance information, and a superior admin panel for system-wide control.

## Features

*   **Admin Dashboard - Participants (`/`)**:
    *   Requires login (Email/Password via Firebase Authentication).
    *   View, add, edit, and delete participants.
    *   Mark participant attendance status (Present, Absent, In Break, Restroom Break, Technical Issue, Stepped Out, Present On Account).
    *   **Bulk update attendance status** for selected participants.
    *   **Import participants from a CSV file.**
        *   Columns must be: `Name`, `School`, `Committee`.
        *   Participants from the CSV will be added to the system.
        *   **Important:** Schools and committees listed in the CSV file **must already exist** in the system (added via the Superior Admin panel). The import process will detect new schools/committees but will **not** automatically create them in the system lists. The user will be notified of any such new entities found.
    *   Export participant data to a CSV file.
    *   Filter participants by school, committee, status (All, Present, Absent), or search term.
    *   Toggle visibility of table columns (Avatar, Name, School, Committee, Status, Actions).
    *   Link to individual participant profile pages.
*   **Admin Dashboard - Staff (`/staff`)**:
    *   Requires login (Email/Password via Firebase Authentication).
    *   View, add, edit, and delete staff members.
    *   Mark staff member status (e.g., On Duty, Off Duty, On Break, Away).
    *   Filter staff members by status, team, or search term.
    *   Toggle visibility of table columns (Avatar, Name, Role, Department, Team, Contact Info, Status, Actions).
    *   Link to individual staff member profile pages.
*   **Participant Profile Page (`/participants/[id]`)**:
    *   View detailed participant information (Name, School, Committee, Status, Class/Grade, Notes, Additional Details).
    *   Edit participant details.
    *   Change participant attendance status.
*   **Staff Member Profile Page (`/staff/[id]`)**:
    *   View detailed staff member information (Name, Role, Department, Team, Contact Info, Status, Notes).
    *   Edit staff member details.
    *   Change staff member status.
*   **Login Page (`/auth/login`)**:
    *   Allows administrators to log in using Firebase Authentication (Email/Password).
*   **Public View (`/public`)**:
    *   Read-only list of participants.
    *   Filter participants by school, committee, status (All, Present, Absent), or search term.
    *   Toggle visibility of table columns.
    *   Links to participant profile pages (profile pages themselves are not inherently public/private; access control to data within them would be a further step if required beyond general public read of basic list).
    *   Does not require login.
*   **Superior Admin Panel (`/superior-admin`)**:
    *   Restricted access to the designated Owner UID or other designated admins via Firebase Authentication.
    *   Manage system-wide lists of Schools, Committees, and **Staff Teams** (add new ones).
    *   Manage staff members (add, view list, link to edit, delete).
    *   Manage administrator accounts (grant/revoke admin role for existing Firebase Auth users by providing their Auth UID, and grant/revoke superior admin access).
    *   Manage System Settings (e.g., Default Attendance Status for new participants).
    *   Accessible via direct navigation or a conditional link in the sidebar if logged in as the owner or a superior admin.
*   **Theme Toggling**:
    *   User-selectable Light, Dark, or System theme preference.
*   **Responsive Design**:
    *   Adapts to different screen sizes.

## Tech Stack

*   **Next.js (App Router)**: React framework for server-side rendering and static site generation.
*   **React**: JavaScript library for building user interfaces.
*   **TypeScript**: Superset of JavaScript that adds static typing.
*   **ShadCN UI Components**: Re-usable UI components.
*   **Tailwind CSS**: Utility-first CSS framework for styling.
*   **Supabase**:
    *   **PostgreSQL**: Relational database for storing participant data, staff data, system schools, system committees, system staff teams, user profiles, and system configuration.
    *   **Supabase Auth**: For user authentication (admin and superior admin).
*   **Lucide React**: Library for icons.
*   **Genkit (for AI)**: Configured but not actively used in current core features.

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn

### Supabase Setup (CRITICAL for Functionality & Deployment)

1.  **Create a Supabase Project**: Go to the [Supabase Dashboard](https://app.supabase.com/) and create a new project.
2.  **Run Migration Script**: In the SQL Editor of your Supabase project, run the contents of `docs/supabase_schema.sql` to create the necessary tables, indexes, and RLS policies.
3.  **Get Supabase Credentials**: In your Supabase project settings, go to "API" and copy the "Project URL" and "anon public" key.
4.  **Configure Authentication**:
    *   Enable Email/Password provider in "Authentication" > "Providers".
    *   Create at least one user in "Authentication" > "Users". Note the ID (UUID) of this user.

### Project Setup

1.  **Clone the Repository (or get the code)**.
2.  **Install Dependencies**: `npm install` or `yarn install`.
3.  **Configure Environment Variables**:
    *   Create a `.env.local` file in the root directory.
    *   Add your Supabase credentials (see `.env.example`):
      ```
      NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
      NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
      ```
4.  **Set Superior Admin UID**:
    *   Open `src/lib/constants.ts`. Set `OWNER_UID` to the UUID of your admin user from Supabase Auth.

### Running the Application Locally

*   Start server: `npm run dev`.
*   Open your configured port (e.g., `http://localhost:3000` or `http://localhost:9002` if set by environment).

## Row Level Security (RLS)

Access control is handled via Supabase Row Level Security. The policies are defined in `docs/supabase_schema.sql`.

## Troubleshooting Deployment

*   **Permission Denied**:
    *   **Check RLS Policies**: Ensure the RLS policies in Supabase allow the operation.
    *   **Verify Environment Variables**: Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correctly set in your hosting provider (e.g., Vercel).
*   **Realtime Updates not working**:
    *   Ensure "Realtime" is enabled for the `participants` and `staff_members` tables in the Supabase Dashboard.

This guide should help you get started, understand the application's structure, and prepare for a more secure deployment!
