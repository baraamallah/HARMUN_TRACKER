
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
    *   **Firestore**: NoSQL database for storing participant data, system schools, system committees, user roles, and system configuration.
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
4.  **Enable Firestore**: In the Firebase Console, go to "Firestore Database" and create a database. Start in **Test Mode** for initial development (allows open read/write for 30 days). **CRITICAL**: You MUST set up proper [Firestore Security Rules](#firestore-security-rules-examples) (see section below) *before* the test mode expires or before deploying to production. If you encounter "Missing or insufficient permissions" errors, it's almost certainly due to your Firestore rules not allowing the operation.
5.  **Enable Firebase Authentication**:
    *   In the Firebase Console, go to "Authentication".
    *   Go to the "Sign-in method" tab.
    *   **Enable the Email/Password provider.** This is required for the current login page.
    *   Go to the "Users" tab and **add at least one user** (e.g., your admin account that will be the Superior Admin). Note the UID of this user. This UID will be used as the `OWNER_UID`.
    *   **For other users you intend to make 'admin' via the Superior Admin panel**: These users must *also* exist in Firebase Authentication (e.g., they can sign up if you implement a sign-up flow, or you can add them manually in the Firebase Console). The Superior Admin panel grants them an *application role* in Firestore; it does not create their Firebase Authentication account itself.

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
    *   Ensure the `OWNER_UID` constant matches the Firebase UID of the user who should have superior admin access (the one you noted in Firebase Setup Step 5). The current value is `JZgMG6xdwAYInXsdciaGj6qNAsG2`.

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
    *   Manage system settings (e.g., default attendance status for new participants).
    *   Links to other control panels.

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
    *   `superior-admin/system-settings/page.tsx`: Page for managing system-wide settings.
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
    *   Deploy the rules provided in the [Firestore Security Rules Examples](#firestore-security-rules-examples) section below. **Test them thoroughly** using the Firebase Rules Playground.
    *   **If you see "Missing or insufficient permissions" errors in your application, it's almost always because your Firestore security rules are not correctly configured to allow the operation for the currently authenticated user.** This error means Firebase on the server-side has blocked an action because the rules didn't permit it.

2.  🔑 **Environment Variables for Firebase Config**:
    *   Ensure your hosting provider is configured with the same `NEXT_PUBLIC_FIREBASE_...` environment variables that you have in your `.env.local` file.
    *   **DO NOT hardcode Firebase config in `src/lib/firebase.ts` for production builds.** The current setup correctly reads from environment variables if `.env.local` is configured.

3.  🚪 **Firebase Authentication Setup & Admin Roles**:
    *   **Enable Email/Password Provider**: In Firebase Console > Authentication > Sign-in method, enable the "Email/Password" provider.
    *   **Create Initial Superior Admin User**: In Firebase Console > Authentication > Users, add the user who will be the superior admin. Note their UID and ensure it matches `OWNER_UID` in `src/lib/constants.ts`.
    *   **Admin Users**: Users who are granted 'admin' role via the Superior Admin panel must *also* exist as users in Firebase Authentication (e.g., by signing up or being manually added in the Firebase console). The Superior Admin panel assigns an application role in Firestore, not the Firebase Auth account itself.
    *   The login (`/auth/login`) allows any user created in Firebase Auth (Email/Password provider) to attempt login.
    *   Access to the main admin dashboard (`/`) is granted if they are logged in. True admin access (beyond just being logged in) should ideally be verified by checking their role in the `users` Firestore collection. The example Firestore rules for `/participants` demonstrate this.

4.  🛠️ **Build-time Error Checks (`next.config.ts`)**:
    *   The `next.config.ts` file has been updated to set `typescript.ignoreBuildErrors = false` and `eslint.ignoreDuringBuilds = false`. This is good practice for production as it ensures TypeScript and ESLint errors are caught during the build process.

5.  🚀 **Build and Deploy**:
    *   Build the application: `npm run build`.
    *   Deploy to your chosen hosting provider (e.g., Firebase Hosting, Vercel, Netlify). Follow their specific deployment instructions, especially regarding environment variable setup.

## Firestore Security Rules Examples

**The `OWNER_UID` used in these rules is `JZgMG6xdwAYInXsdciaGj6qNAsG2` (as defined in `src/lib/constants.ts`). If your Owner UID is different, you MUST update it in these rules before publishing.**

These are example rules. You **MUST** review and tailor them to your exact application needs and **test them thoroughly** using the Firebase Rules Playground.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Participants Collection
    // Defines who can read and write participant data.
    match /participants/{participantId} {
      // Allow public read for the /public page.
      // Authenticated users can also read for the admin dashboard.
      allow read: if true;

      // Allow write access only to authenticated users who have an 'admin' role
      // in the 'users' collection, OR if the user is the Owner.
      allow write: if request.auth != null &&
                   (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
                    request.auth.uid == 'JZgMG6xdwAYInXsdciaGj6qNAsG2');
    }

    // System Schools Collection
    // Defines who can read and write the list of system-wide schools.
    match /system_schools/{schoolId} {
      // Allow public read for filters and forms throughout the app.
      allow read: if true;

      // Only the Owner can create, update, or delete schools.
      allow write: if request.auth != null && request.auth.uid == 'JZgMG6xdwAYInXsdciaGj6qNAsG2';
    }

    // System Committees Collection
    // Defines who can read and write the list of system-wide committees.
    match /system_committees/{committeeId} {
      // Allow public read for filters and forms throughout the app.
      allow read: if true;

      // Only the Owner can create, update, or delete committees.
      allow write: if request.auth != null && request.auth.uid == 'JZgMG6xdwAYInXsdciaGj6qNAsG2';
    }

    // System Configuration Collection
    // Defines who can read and write application-wide settings.
    match /system_config/{settingId} { // e.g., {settingId} could be 'main_settings'
      // Only the Owner can read and write system configuration.
      allow read, write: if request.auth != null && request.auth.uid == 'JZgMG6xdwAYInXsdciaGj6qNAsG2';
    }

    // Users Collection (for managing admin roles)
    // Documents in this collection are keyed by Firebase Auth UID.
    // Example document: { uid: "someAuthUID", email: "admin@example.com", role: "admin" }
    match /users/{userId} {
      // Allow the Owner to create, update, or delete any user role document.
      allow write: if request.auth != null && request.auth.uid == 'JZgMG6xdwAYInXsdciaGj6qNAsG2';

      // Allow an authenticated user to read their own role document.
      // Also, allow the Owner to read any user's role document.
      allow read: if request.auth != null &&
                  (request.auth.uid == userId || request.auth.uid == 'JZgMG6xdwAYInXsdciaGj6qNAsG2');
    }

    // Rule for LISTING documents in the users collection.
    // This is specifically needed for the getAdminUsers query by the Owner
    // on the Admin Account Management page.
    match /users {
       allow list: if request.auth != null && request.auth.uid == 'JZgMG6xdwAYInXsdciaGj6qNAsG2';
    }
  }
}
```
**Explanation of User Rules Example:**
*   The rules for the `users` collection allow the Owner to manage all documents within it (granting/revoking admin roles).
*   The `allow list` rule on `/users` is specifically for the `getAdminUsers` query to work for the Owner.
*   Individual users can read their *own* role document if needed.
*   The `participants` write rule is an example of how to check a user's role from the `users` collection.

## Customization

*   **Owner UID**: Change the `OWNER_UID` in `src/lib/constants.ts` (if you did, you MUST update it in the Firestore Security Rules as well).
*   **Attendance Statuses**: Modify the `AttendanceStatus` type in `src/types/index.ts` and update `src/components/participants/AttendanceStatusBadge.tsx` and `src/components/participants/ParticipantActions.tsx` accordingly. The default status for new participants can be configured in the Superior Admin panel.
*   **Styling**: Adjust Tailwind CSS classes and the theme variables in `src/app/globals.css`.

## Troubleshooting Deployment

*   **Permission Denied / Missing Data / "Missing or insufficient permissions"**:
    *   This **almost always points to an issue with your Firestore Security Rules.** The error message "PERMISSION_DENIED: Missing or insufficient permissions. Make sure you are logged in as Owner (UID: JZgMG6xdwAYInXsdciaGj6qNAsG2) and that Firestore rules allow the Owner to write to 'system_committees' collection. Check README.md for correct rules. Check browser console for more details." is very specific.
    *   Check your browser's developer console for detailed errors from Firebase. These often indicate issues with Firestore Security Rules.
    *   Ensure your deployed security rules in the Firebase console match the access patterns your application needs (e.g., the `OWNER_UID` needs write access to `system_committees`, `system_schools`, `system_config`, and `users`).
    *   Use the Rules Playground in Firebase to test your rules against specific operations and user authentication states.
*   **Missing Firestore Indexes**:
    *   If data fetching fails with an error message in the browser console mentioning "The query requires an index...", Firestore usually provides a direct link in that error message to create the required composite index. Click it and create the index.
*   **Firebase Connection Issues / API Key Errors**:
    *   Verify that your `NEXT_PUBLIC_FIREBASE_...` **environment variables** are correctly set up in your hosting provider's settings (e.g., Vercel, Netlify). These must match your Firebase project configuration.
*   **Login Problems**:
    *   Ensure the **Email/Password Sign-in Provider** is enabled in your Firebase project's Authentication settings.
    *   Verify that the user accounts (especially the `OWNER_UID` account) exist in Firebase Authentication. If granting 'admin' roles, ensure those users also exist in Firebase Auth.

This guide should help you get started, understand the application's structure, and prepare for a more secure deployment!

