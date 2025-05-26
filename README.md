
# MUN Attendance Tracker

The MUN Attendance Tracker is a Next.js application designed to help manage and track participant attendance for Model United Nations conferences. It features an admin dashboard for managing participants, a public view for general attendance information, and a superior admin panel for system-wide control.

## Features

*   **Admin Dashboard (`/`)**:
    *   Requires login.
    *   View, add, edit, and delete participants.
    *   Mark participant attendance status (Present, Absent, In Break, etc.).
    *   Import participants from a CSV file.
    *   Export participant data to a CSV file.
    *   Filter participants by school, committee, status, or search term.
    *   Toggle visibility of table columns (Avatar, Name, School, Committee, Status, Actions).
*   **Login Page (`/auth/login`)**:
    *   Allows administrators to log in using Firebase Authentication (Email/Password).
*   **Public View (`/public`)**:
    *   Read-only list of participants.
    *   Filter participants by school, committee, status, or search term.
    *   Toggle visibility of table columns (Avatar, Name, School, Committee, Status).
    *   Does not require login.
*   **Superior Admin Panel (`/superior-admin`)**:
    *   Restricted access to a designated Owner UID via Firebase Authentication.
    *   Placeholder for advanced controls:
        *   Global data management.
        *   System-wide settings.
        *   Admin account management (future).
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
    *   **Firestore**: NoSQL database for storing participant data.
    *   **Firebase Authentication**: For user authentication (admin and superior admin).
*   **Lucide React**: Library for icons.
*   **Genkit (for AI)**: Configured but not actively used in current core features.

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn

### Firebase Setup

1.  **Create a Firebase Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  **Add a Web App**: In your Firebase project, add a new Web application.
3.  **Copy Firebase Config**: During the web app setup, Firebase will provide you with a `firebaseConfig` object. You'll need this for the environment variables.
4.  **Enable Firestore**: In the Firebase Console, go to "Firestore Database" and create a database. Start in **Test Mode** for initial development (allows open read/write). **CRITICAL**: You MUST set up proper [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) before deploying to production.
5.  **Enable Firebase Authentication**: In the Firebase Console, go to "Authentication".
    *   Go to the "Sign-in method" tab.
    *   Enable the **Email/Password** provider. This is required for the current login page. You can enable other providers (like Google) later if you wish.
    *   Go to the "Users" tab and add at least one user (e.g., your admin account). Note the UID of the user you want to be the "Superior Admin".

### Project Setup

1.  **Clone the Repository (or get the code)**:
    ```bash
    git clone <your-repository-url>
    cd mun-attendance-tracker
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
    *   Update the `OWNER_UID` constant with the Firebase UID of the user who should have superior admin access.
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
*   Open [http://localhost:9002](http://localhost:9002) (or the port specified in your `package.json` dev script) in your browser. You will be redirected to `/auth/login`.

## Usage

### Admin Access (`/`)

*   **Logging In**: Navigate to `/auth/login` and sign in with an Email/Password account that you've created in your Firebase Authentication users list.
*   **Dashboard (`/`)**: Once logged in, you will be redirected to the main admin dashboard to manage participants.

### Superior Admin Access (`/superior-admin`)

*   **Prerequisite**: You must be logged into the application using the Firebase account whose UID matches the `OWNER_UID` configured in `src/lib/constants.ts`.
*   **Navigation**:
    *   If you are logged in as the owner, a "Superior Admin" link will appear in the sidebar on the main dashboard.
    *   Alternatively, navigate directly to `/superior-admin` in your browser.
*   **Functionality**: This panel is for system-wide controls, currently with placeholders.

### Public View (`/public`)

*   Navigate to `/public`. No login is required to view this page.

## Key Files & Project Structure

*   `src/app/`: Contains page routes (App Router).
    *   `page.tsx`: Admin Dashboard (protected).
    *   `auth/login/page.tsx`: Admin login page.
    *   `auth/layout.tsx`: Layout for authentication pages.
    *   `public/page.tsx`: Public participant view.
    *   `superior-admin/page.tsx`: Superior Admin panel (protected by UID).
    *   `layout.tsx`: Root layout for the application.
    *   `globals.css`: Global styles and Tailwind CSS theme variables.
*   `src/components/`: Reusable React components.
    *   `ui/`: ShadCN UI components.
    *   `layout/`: Layout components (`AppLayoutClientShell`, `PublicLayout`).
    *   `participants/`: Components related to participant management (Table, Form, Actions, etc.).
    *   `shared/`: General shared components (Logo, Theme Toggle).
*   `src/lib/`: Core logic and utilities.
    *   `actions.ts`: Server Actions for interacting with Firebase Firestore.
    *   `constants.ts`: Application-wide constants like `OWNER_UID`.
    *   `firebase.ts`: Firebase initialization and configuration (uses environment variables).
    *   `utils.ts`: Utility functions (like `cn` for classnames).
*   `src/types/`: TypeScript type definitions.
*   `src/hooks/`: Custom React hooks.
*   `.env.local`: (You create this) For storing Firebase credentials locally and securely. **DO NOT COMMIT.**

## Deployment Checklist (CRITICAL)

Before deploying this application to a live environment, ensure you address the following:

1.  🔐 **Firestore Security Rules**:
    *   **THIS IS THE MOST IMPORTANT STEP FOR SECURITY.**
    *   In the Firebase Console, go to "Firestore Database" -> "Rules".
    *   The default "test mode" rules are **INSECURE** for production.
    *   Define rules to control who can access and modify data. Examples:
        *   Only authenticated users (admins) can write to the `participants` collection.
        *   Anyone can read the `participants` collection (for the public view).
        *   The superior admin might have broader permissions (though typically data access rules are role-based, not UID-specific at the rule level unless carefully managed).
    *   Refer to the [Firebase Firestore Security Rules documentation](https://firebase.google.com/docs/firestore/security/get-started).

2.  🔑 **Environment Variables for Firebase Config**:
    *   Ensure your hosting provider is configured with the same `NEXT_PUBLIC_FIREBASE_...` environment variables that you have in your `.env.local` file.
    *   **DO NOT hardcode Firebase config in `src/lib/firebase.ts` for production builds.** The current setup reads from environment variables.

3.  🚪 **Admin Roles & Signup (Future Enhancement)**:
    *   The current login (`/auth/login`) allows any user created in Firebase Auth (Email/Password provider) to access the main admin dashboard (`/`).
    *   For more granular control (distinguishing regular admins from other users), you'll need to implement a role system (e.g., store a `role: 'admin'` field in Firestore for users) and check this role after login or in middleware.
    *   Consider how new admin accounts will be created (e.g., only by the superior admin).

4.  🛠️ **Build-time Error Checks**:
    *   In `next.config.ts`, consider setting:
        ```typescript
        typescript: {
          ignoreBuildErrors: false, // Set to false for production
        },
        eslint: {
          ignoreDuringBuilds: false, // Set to false for production
        },
        ```
    *   This ensures that TypeScript and ESLint errors are caught during the build process, leading to a more stable application. (These are currently true in your `next.config.ts`, change them for production).

5.  🚀 **Build and Deploy**:
    *   Build the application: `npm run build`.
    *   Deploy to your chosen hosting provider (e.g., Firebase Hosting, Vercel, Netlify). Follow their specific deployment instructions, especially regarding environment variable setup.

## Customization

*   **Owner UID**: Change the `OWNER_UID` in `src/lib/constants.ts`.
*   **Attendance Statuses**: Modify the `AttendanceStatus` type in `src/types/index.ts` and update `src/components/participants/AttendanceStatusBadge.tsx` and `src/components/participants/ParticipantActions.tsx` accordingly.
*   **Styling**: Adjust Tailwind CSS classes and the theme variables in `src/app/globals.css`.

This guide should help you get started, understand the application's structure, and prepare for a more secure deployment!
