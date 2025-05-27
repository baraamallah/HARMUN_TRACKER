
# MUN Attendance Tracker

The MUN Attendance Tracker is a Next.js application designed to help manage and track participant attendance for Model United Nations conferences. It features an admin dashboard for managing participants, a public view for general attendance information, and a superior admin panel for system-wide control.

## Features

*   **Admin Dashboard (`/`)**:
    *   Requires login (Email/Password via Firebase Authentication).
    *   View, add, edit, and delete participants.
    *   Mark participant attendance status (Present, Absent, In Break, Restroom Break, Technical Issue, Stepped Out, Present On Account).
    *   Import participants from a CSV file. New schools/committees found in CSV are automatically added to system lists.
    *   Export participant data to a CSV file.
    *   Filter participants by school, committee, status (All, Present, Absent), or search term.
    *   Toggle visibility of table columns (Avatar, Name, School, Committee, Status, Actions).
*   **Login Page (`/auth/login`)**:
    *   Allows administrators to log in using Firebase Authentication (Email/Password).
*   **Public View (`/public`)**:
    *   Read-only list of participants.
    *   Filter participants by school, committee, status (All, Present, Absent), or search term.
    *   Toggle visibility of table columns (Avatar, Name, School, Committee, Status).
    *   Does not require login.
*   **Superior Admin Panel (`/superior-admin`)**:
    *   Restricted access to a designated Owner UID via Firebase Authentication.
    *   Manage system-wide lists of Schools and Committees.
    *   Manage administrator accounts (grant/revoke admin role for existing Firebase Auth users by providing their Auth UID).
    *   Links to placeholder pages for System Settings.
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
    *   **Firestore**: NoSQL database for storing participant data, system schools, system committees, and user roles.
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
3.  **Copy Firebase Config**: During the web app setup, Firebase will provide you with a `firebaseConfig` object. You'll need this for the environment variables.
4.  **Enable Firestore**: In the Firebase Console, go to "Firestore Database" and create a database. Start in **Test Mode** for initial development (allows open read/write). **CRITICAL**: You MUST set up proper [Firestore Security Rules](#firestore-security-rules-critical) before deploying to production.
5.  **Enable Firebase Authentication**:
    *   In the Firebase Console, go to "Authentication".
    *   Go to the "Sign-in method" tab.
    *   **Enable the Email/Password provider.** This is required for the current login page.
    *   Go to the "Users" tab and **add at least one user** (e.g., your admin account that will be the Superior Admin). Note the UID of this user. This UID will be used as the `OWNER_UID`.

### Project Setup

1.  **Clone the Repository (or get the code)**:
    ```bash
    # git clone <your-repository-url>
    # cd mun-attendance-tracker
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    # or
    # yarn install
    ```
3.  **Configure Firebase Credentials (Environment Variables - CRITICAL FOR PRODUCTION)**:
    *   Create a new file named `.env.local` in the root of your project (e.g., alongside `package.json`).
    *   Add your Firebase project configuration to this file. **This file should be in your `.gitignore` and NEVER committed to version control.**
        Example `.env.local`:
        ```env
        NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
        NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id" # Optional
        ```
    *   Replace `"your-api-key"`, etc., with the actual values from your Firebase project settings (Web App configuration).
    *   The application (`src/lib/firebase.ts`) is configured to read these environment variables.

4.  **Set Superior Admin UID**:
    *   Open `src/lib/constants.ts`.
    *   Update the `OWNER_UID` constant with the Firebase UID of the user who should have superior admin access (the one you noted in Firebase Setup Step 5).
    ```typescript
    // src/lib/constants.ts
    export const OWNER_UID = "YOUR_ACTUAL_FIREBASE_OWNER_UID"; // e.g., "JZgMG6xdwAYInXsdciaGj6qNAsG2"
    ```

### Running the Application Locally

*   **Start the development server**:
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
*   Open [http://localhost:9002](http://localhost:9002) (or the port specified in your `package.json` dev script). You will be redirected to `/auth/login`.

## Usage

### Admin Access (`/`)

*   **Logging In**: Navigate to `/auth/login` and sign in with an Email/Password account that you've created in your Firebase Authentication users list and has been granted 'admin' role via the Superior Admin panel.
*   **Dashboard (`/`)**: Once logged in, you will be redirected to the main admin dashboard to manage participants.

### Superior Admin Access (`/superior-admin`)

*   **Prerequisite**: You must be logged into the application using the Firebase account whose UID matches the `OWNER_UID` configured in `src/lib/constants.ts`.
*   **Navigation**:
    *   If you are logged in as the owner, a "Superior Admin" link will appear in the sidebar on the main dashboard.
    *   Alternatively, navigate directly to `/superior-admin` in your browser.
*   **Functionality**:
    *   Manage system-wide lists of Schools and Committees.
    *   Manage administrator accounts (grant/revoke admin privileges for existing Firebase Authentication users by providing their Auth UID).
    *   Links to other control panels (e.g., System Settings - currently placeholders).

### Public View (`/public`)

*   Navigate to `/public`. No login is required to view this page.

## Key Files & Project Structure

*   `src/app/`: Contains page routes (App Router).
    *   `page.tsx`: Admin Dashboard (protected by login).
    *   `auth/login/page.tsx`: Admin login page.
    *   `auth/layout.tsx`: Layout for authentication pages.
    *   `public/page.tsx`: Public participant view.
    *   `superior-admin/page.tsx`: Superior Admin dashboard.
    *   `superior-admin/admin-management/page.tsx`: Page for managing admin accounts.
    *   `superior-admin/system-settings/page.tsx`: Placeholder page for system settings.
    *   `layout.tsx`: Root layout for the application.
    *   `globals.css`: Global styles and Tailwind CSS theme variables.
*   `src/components/`: Reusable React components.
    *   `ui/`: ShadCN UI components.
    *   `layout/`: Layout components (`AppLayoutClientShell`, `PublicLayout`).
    *   `participants/`: Components related to participant management (Table, Form, Actions, etc.).
    *   `shared/`: General shared components (Logo, Theme Toggle).
    *   `superior-admin/`: Components specific to the superior admin panel (e.g., `AddAdminDialog`).
*   `src/lib/`: Core logic and utilities.
    *   `actions.ts`: Server Actions for interacting with Firebase Firestore.
    *   `constants.ts`: Application-wide constants like `OWNER_UID`.
    *   `firebase.ts`: Firebase initialization and configuration (uses environment variables).
    *   `utils.ts`: Utility functions (like `cn` for classnames).
*   `src/types/`: TypeScript type definitions.
*   `src/hooks/`: Custom React hooks (e.g., `useDebounce`, `useToast`).
*   `.env.local`: (You create this) For storing Firebase credentials locally and securely. **DO NOT COMMIT.**

## Deployment Checklist (CRITICAL)

Before deploying this application to a live environment, ensure you address the following:

1.  🔐 **Firestore Security Rules (CRITICAL)**:
    *   **THIS IS THE MOST IMPORTANT STEP FOR SECURITY.**
    *   In the Firebase Console, go to "Firestore Database" -> "Rules".
    *   The default "test mode" rules are **INSECURE** for production.
    *   Define rules to control who can access and modify data. See [Firestore Security Rules Examples](#firestore-security-rules-examples) below.

2.  🔑 **Environment Variables for Firebase Config**:
    *   Ensure your hosting provider is configured with the same `NEXT_PUBLIC_FIREBASE_...` environment variables that you have in your `.env.local` file.
    *   **DO NOT hardcode Firebase config in `src/lib/firebase.ts` for production builds.** The current setup correctly reads from environment variables if `.env.local` is configured.

3.  🚪 **Firebase Authentication Setup & Admin Roles**:
    *   **Enable Email/Password Provider**: In Firebase Console > Authentication > Sign-in method, enable the "Email/Password" provider.
    *   **Create Initial Superior Admin User**: In Firebase Console > Authentication > Users, add the user who will be the superior admin. Note their UID and set it as `OWNER_UID` in `src/lib/constants.ts`.
    *   The current login (`/auth/login`) allows any user created in Firebase Auth (Email/Password provider) to attempt login. Access to the main admin dashboard (`/`) is then granted if they are logged in.
    *   True admin access (beyond just being logged in) should ideally be verified by checking their role in the `users` Firestore collection after login or in middleware (this part is not fully implemented for the main dashboard yet, but the Superior Admin panel uses it for managing admins).
    *   The Superior Admin panel allows granting 'admin' roles to existing Firebase Auth users.

4.  🛠️ **Build-time Error Checks (`next.config.ts`)**:
    *   The `next.config.ts` file has been updated to set `typescript.ignoreBuildErrors = false` and `eslint.ignoreDuringBuilds = false`. This is good practice for production as it ensures TypeScript and ESLint errors are caught during the build process.

5.  🚀 **Build and Deploy**:
    *   Build the application: `npm run build`.
    *   Deploy to your chosen hosting provider (e.g., Firebase Hosting, Vercel, Netlify). Follow their specific deployment instructions, especially regarding environment variable setup.

## Firestore Security Rules Examples

**Replace `YOUR_OWNER_UID` with the actual UID of the superior admin (from `src/lib/constants.ts`).**

These are example rules. You **MUST** review and tailor them to your exact application needs.

```json
{
  "rules": {
    "participants": {
      // Allow public read for the /public page
      ".read": "true",
      // Allow write access only to authenticated users (admins)
      // You might want to refine this further to check for an 'admin' role if you implement it.
      ".write": "request.auth != null"
    },
    "system_schools": {
      // Allow public read for filters and forms
      ".read": "true",
      // Only the owner can create, update, or delete schools
      ".write": "request.auth != null && request.auth.uid == 'YOUR_OWNER_UID'"
    },
    "system_committees": {
      // Allow public read for filters and forms
      ".read": "true",
      // Only the owner can create, update, or delete committees
      ".write": "request.auth != null && request.auth.uid == 'YOUR_OWNER_UID'"
    },
    "users": {
      // The 'users' collection stores roles (e.g., { uid: "...", email: "...", role: "admin" })
      // Documents are keyed by the Firebase Auth UID.

      // Superior Admin (Owner) can read/write/list all user role documents
      ".read": "request.auth != null && request.auth.uid == 'YOUR_OWNER_UID'",
      ".write": "request.auth != null && request.auth.uid == 'YOUR_OWNER_UID'",
      
      // Individual users might need to read their own role document if you expand functionality
      // Example: allow a user to read their own document if the document ID matches their UID
      // "{userId}": {
      //   "allow read": "request.auth != null && request.auth.uid == userId"
      // }
    }
  }
}
```

**Explanation of User Rules Example:**
*   The rules for the `users` collection allow the Owner to manage all documents within it (granting/revoking admin roles).
*   The commented-out section for `"{userId}"` is an example of how you could allow individual users to read their *own* role document if needed.
*   Granting `list` access on the collection level (`.read` on `users`) is generally needed for the owner to query the collection (e.g., `getAdminUsers`).

## Customization

*   **Owner UID**: Change the `OWNER_UID` in `src/lib/constants.ts`.
*   **Attendance Statuses**: Modify the `AttendanceStatus` type in `src/types/index.ts` and update `src/components/participants/AttendanceStatusBadge.tsx` and `src/components/participants/ParticipantActions.tsx` accordingly.
*   **Styling**: Adjust Tailwind CSS classes and the theme variables in `src/app/globals.css`.

This guide should help you get started, understand the application's structure, and prepare for a more secure deployment!
