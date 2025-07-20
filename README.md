
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
    *   Restricted access to a designated Owner UID via Firebase Authentication.
    *   Manage system-wide lists of Schools, Committees, and **Staff Teams** (add new ones).
    *   Manage staff members (add, view list, link to edit, delete).
    *   Manage administrator accounts (grant/revoke admin role for existing Firebase Auth users by providing their Auth UID).
    *   Manage System Settings (e.g., Default Attendance Status for new participants).
    *   Accessible via direct navigation or a conditional link in the sidebar if logged in as the owner.
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
*   **Firebase**:
    *   **Firestore**: NoSQL database for storing participant data, staff data, system schools, system committees, system staff teams, user roles, and system configuration.
    *   **Firebase Authentication**: For user authentication (admin and superior admin).
*   **Lucide React**: Library for icons.
*   **Genkit (for AI)**: Configured but not actively used in current core features.

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn

### Firebase Setup (CRITICAL for Functionality & Deployment)

1.  **Create a Firebase Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  **Add a Web App**: In your Firebase project, add a new Web application.
3.  **Copy Firebase Config**: During the web app setup, Firebase will provide you with a `firebaseConfig` object.
4.  **Enable Firestore**: In the Firebase Console, go to "Firestore Database" and create a database. Start in **Test Mode** for initial development (allows open read/write for 30 days). **CRITICAL**: You MUST set up proper [Firestore Security Rules](#firestore-security-rules-critical-step-by-step) (see section below) *before* the test mode expires or before deploying to production. If you encounter "Missing or insufficient permissions" errors, it's almost certainly due to your Firestore rules not allowing the operation.
5.  **Enable Firebase Authentication**:
    *   In the Firebase Console, go to "Authentication".
    *   Go to the "Sign-in method" tab.
    *   **Enable the Email/Password provider.** This is required for the current login page.
    *   Go to the "Users" tab and **add at least one user** (e.g., your admin account that will be the Superior Admin). Note the UID of this user. This UID will be used as the `OWNER_UID`. The current `OWNER_UID` is `JZgMG6xdwAYInXsdciaGj6qNAsG2`.
    *   **For other users you intend to make 'admin' via the Superior Admin panel**: These users must *also* exist in Firebase Authentication. The Superior Admin panel grants them an *application role* in Firestore; it does not create their Firebase Authentication account itself.

### Project Setup

1.  **Clone the Repository (or get the code)**.
2.  **Install Dependencies**: `npm install` or `yarn install`.
3.  **Configure Firebase Credentials**:
    *   The file `src/lib/firebase.ts` is currently configured to use **hardcoded Firebase credentials** based on what you last provided. Ensure these match your Firebase project if they ever change.
    *   For production or if credentials change, use `.env.local` as described in `src/lib/firebase.ts`.
4.  **Set Superior Admin UID**:
    *   Open `src/lib/constants.ts`. The `OWNER_UID` (currently `JZgMG6xdwAYInXsdciaGj6qNAsG2`) defines superior admin access.
    *   **If you change this UID, you MUST also update it in the Firestore Security Rules.**

### Running the Application Locally

*   Start server: `npm run dev`.
*   Open your configured port (e.g., `http://localhost:3000` or `http://localhost:9002` if set by environment).

## Firestore Security Rules Critical Step-by-Step

The `OWNER_UID` used in these rules is taken from `src/lib/constants.ts` (currently `JZgMG6xdwAYInXsdciaGj6qNAsG2`). **If your Owner UID in `constants.ts` is different, you MUST update it in these rules before publishing.**

1.  Go to your Firebase Project Console > Firestore Database > Rules tab.
2.  **DELETE ALL EXISTING TEXT** in the rules editor.
3.  **COPY and PASTE the ENTIRE block of rules below:**
    ```
    rules_version = '2';

    service cloud.firestore {
      match /databases/{database}/documents {

        // Helper function to check for admin role
        function isAdmin() {
          return request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
        }

        // Helper function to check if the user is the Owner
        function isOwner() {
          return request.auth != null && request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2"; // Replace with your Owner UID from src/lib/constants.ts
        }

        // Participants Collection
        match /participants/{participantId} {
          allow read: if true; // Public read for list and profiles
          allow create, delete: if isOwner() || isAdmin();
          allow update: if (isOwner() || isAdmin()) || 
                           (request.auth != null && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedAt', 'attended', 'checkInTime']));
        }

        // Staff Members Collection
        match /staff_members/{staffMemberId} {
          allow read, write: if isOwner() || isAdmin();
        }

        // System Schools Collection
        match /system_schools/{schoolId} {
          allow read: if true; // Public read for dropdowns, filters
          allow write: if isOwner(); // Owner only for adding/deleting
        }

        // System Committees Collection
        match /system_committees/{committeeId} {
          allow read: if true; // Public read for dropdowns, filters
          allow write: if isOwner(); // Owner only for adding/deleting
        }

        // System Staff Teams Collection
        match /system_staff_teams/{teamId} {
          allow read: if true; // Public read for dropdowns, filters
          allow write: if isOwner(); // Owner only for adding/deleting
        }

        // System Configuration Collection
        match /system_config/{settingId} {
          // Public read for settings like default attendance status.
          // Write is restricted to Owner.
          allow read: if true; 
          allow write: if isOwner();
        }

        // Users Collection (for managing admin roles)
        match /users/{userId} {
          allow write: if isOwner(); // Owner can write/manage roles
          allow read: if isOwner() || (request.auth != null && request.auth.uid == userId); // Owner can read any, user can read own
        }

        // Allow Owner to list all user documents (for admin management page)
        // This is necessary for the admin-management page to display existing admins.
        match /users {
           allow list: if isOwner(); // Owner only
        }
      }
    }
    ```
4.  **VERIFY** that the UID `JZgMG6xdwAYInXsdciaGj6qNAsG2` (or your specific Owner UID) is exactly correct in all places within the rules, especially in the `isOwner()` function.
5.  Click **PUBLISH**.

## Debugging Firestore Rules with Rules Playground (Develop and Test)

If you are encountering "Missing or insufficient permissions" errors, especially for Owner-specific actions like adding a school, the Firebase Rules Playground is your best tool.

**Example: Test if the Owner (`JZgMG6xdwAYInXsdciaGj6qNAsG2`) can add a new school:**

1.  **Go to your Firebase Project Console.**
2.  Navigate to **Build > Firestore Database**.
3.  Click the **Rules** tab.
4.  On the right side of the rules editor, click **"Rules Playground"** (or **"Develop and Test"**, **"Test rules"**).

5.  **Configure the Simulation**:
    *   **Simulation type / Method**: Select or type `create`.
    *   **Location (Path)**: `/system_schools/someNewSchoolId` (use a new, non-existent ID).
    *   **Authentication**:
        *   Toggle **Authenticated** to **ON**.
        *   **Auth UID**: Enter your Owner UID: `JZgMG6xdwAYInXsdciaGj6qNAsG2`.
    *   **Document Data (for `create`)**: Add a simple field: `{ "name": "Test School From Playground" }`.

6.  **Click "Run"**.

7.  **Analyze Results**:
    *   If **Denied**, it will highlight the rule line causing denial. Check for typos in UIDs or path mismatches.
    *   If **Allowed**, and your app still fails, verify the app's client-side `auth.currentUser.uid` and that it's connecting to the correct Firebase project ID (check `src/lib/firebase.ts` and `.env.local` for `NEXT_PUBLIC_FIREBASE_PROJECT_ID`).

## Troubleshooting Deployment

*   **Permission Denied / "Missing or insufficient permissions"**:
    *   **Almost always a Firestore Security Rules issue.** Use the Rules Playground.
    *   **Verify `NEXT_PUBLIC_FIREBASE_PROJECT_ID`**: Ensure `.env.local` (or hardcoded values in `src/lib/firebase.ts`) correctly points to the Firebase project where your rules and auth are set up. Check browser console for `[Firebase Setup] Attempting to connect to Firebase project ID: ...`.
    *   **Check Vercel Function Logs**: In production on Vercel, detailed server-side errors (like Firestore rule denials for server actions) are often masked in the browser. Check your Vercel deployment's function logs for the true error.
*   **Missing Firestore Indexes**:
    *   If data fetching fails with "The query requires an index...", check the browser console (local dev) or Vercel serverless function logs (production) for a link to create the index. The `getParticipants` and `getStaffMembers` functions are most likely to trigger this if multiple filters are applied.
*   **CSV Import Issues**:
    *   The CSV import adds participants. It does **not** create new schools or committees. Ensure these exist in the system (via Superior Admin panel) before importing. The import dialog will notify of new entities found.
*   **Server Component Render Error (500 on Vercel)**:
    *   Often masks a deeper server-side error. Check Vercel function logs. If related to Firestore, it's likely a missing index or a security rule denial for a server action.

This guide should help you get started, understand the application's structure, and prepare for a more secure deployment!
