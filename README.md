
# MUN Attendance Tracker

The MUN Attendance Tracker is a Next.js application designed to help manage and track participant attendance for Model United Nations conferences. It features an admin dashboard for managing participants, a public view for general attendance information, and a superior admin panel for system-wide control.

## Features

*   **Admin Dashboard (`/`)**:
    *   View, add, edit, and delete participants.
    *   Mark participant attendance status (Present, Absent, In Break, etc.).
    *   Import participants from a CSV file.
    *   Export participant data to a CSV file.
    *   Filter participants by school, committee, status, or search term.
    *   Toggle visibility of table columns (Avatar, Name, School, Committee, Status, Actions).
    *   Secure: Requires user to be logged in (basic setup, login page implementation pending).
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
3.  **Copy Firebase Config**: During the web app setup, Firebase will provide you with a `firebaseConfig` object. You'll need this.
4.  **Enable Firestore**: In the Firebase Console, go to "Firestore Database" and create a database. Start in **Test Mode** for initial development (allows open read/write). **IMPORTANT**: You MUST set up proper [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) before deploying to production.
5.  **Enable Firebase Authentication**: In the Firebase Console, go to "Authentication".
    *   Enable at least one sign-in method (e.g., Email/Password, Google). This will be needed for admins to log in.
    *   Note the UID of the user you want to be the "Superior Admin". You can find this in the Authentication users list after they've signed up/logged in once.

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
3.  **Configure Firebase Credentials**:
    *   Open `src/lib/firebase.ts`.
    *   Replace the placeholder `firebaseConfig` object with the one you obtained from your Firebase project (or ensure the existing one is correct). The `apiKey` field is particularly important.
    *   **IMPORTANT FOR PRODUCTION**: For actual deployment, it's highly recommended to move your Firebase configuration into environment variables (e.g., in a `.env.local` file) to keep your API keys and other sensitive information secure.
        Example `.env.local` (this file should be in your `.gitignore`):
        ```
        NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
        NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id"
        ```
        Then update `src/lib/firebase.ts` to use these environment variables.

4.  **Set Superior Admin UID**:
    *   Open `src/lib/constants.ts`.
    *   Update the `OWNER_UID` constant with the Firebase UID of the user who should have superior admin access.
    ```typescript
    export const OWNER_UID = "YOUR_ACTUAL_FIREBASE_OWNER_UID"; // e.g., "JZgMG6xdwAYInXsdciaGj6qNAsG2"
    ```

### Running the Application Locally

*   **Start the development server**:
    ```bash
    npm run dev
    # or
    # yarn dev
    ```
*   Open [http://localhost:9002](http://localhost:9002) (or the port specified in your `package.json` dev script) in your browser.

## Usage

### Admin Access

*   **Logging In**: Currently, the application relies on Firebase Authentication but does not have a dedicated login page. An administrator would need to be logged in to Firebase (e.g., through a separate process or if they were already authenticated in a previous session for the Firebase project domain). **For production, you need to implement a proper login page/flow.**
*   **Dashboard (`/`)**: Once logged in, an admin can access the main dashboard to manage participants.
*   **Superior Admin Panel (`/superior-admin`)**:
    *   Navigate to `/superior-admin`.
    *   You must be logged in with the Firebase account whose UID matches the `OWNER_UID` configured in `src/lib/constants.ts`.
    *   If logged in as the owner, a link to this panel will also appear in the sidebar.

### Public View

*   Navigate to `/public`. No login is required to view this page.

## Key Files & Project Structure

*   `src/app/`: Contains page routes (App Router).
    *   `page.tsx`: Admin Dashboard.
    *   `public/page.tsx`: Public participant view.
    *   `superior-admin/page.tsx`: Superior Admin panel.
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
    *   `firebase.ts`: Firebase initialization and configuration.
    *   `utils.ts`: Utility functions (like `cn` for classnames).
*   `src/types/`: TypeScript type definitions.
*   `src/hooks/`: Custom React hooks.

## Deployment

1.  **Firebase App Hosting**: This project is structured well for deployment on Firebase App Hosting.
2.  **CRITICAL - Firestore Security Rules**:
    *   Before deploying, **you MUST configure Firestore Security Rules** in the Firebase Console. The default "test mode" rules are insecure and allow anyone to read/write your data.
    *   Define rules to control who can access and modify data (e.g., only authenticated admins can write, public can read specific fields, superior admin has broader access).
3.  **CRITICAL - Admin Login Page**:
    *   Implement a proper login page/flow using Firebase Authentication (e.g., Email/Password, Google Sign-In) so administrators can securely log in.
4.  **CRITICAL - Environment Variables**:
    *   Move your `firebaseConfig` from `src/lib/firebase.ts` to environment variables (e.g., `.env.local` for local development, and configure them in your hosting provider's settings for deployment). This protects your API keys.
5.  **Build the Application**:
    ```bash
    npm run build
    ```
6.  **Deploy**: Follow your hosting provider's instructions (e.g., using `firebase deploy` for Firebase Hosting).

## Customization

*   **Owner UID**: Change the `OWNER_UID` in `src/lib/constants.ts`.
*   **Attendance Statuses**: Modify the `AttendanceStatus` type in `src/types/index.ts` and update `src/components/participants/AttendanceStatusBadge.tsx` and `src/components/participants/ParticipantActions.tsx` accordingly.
*   **Styling**: Adjust Tailwind CSS classes and the theme variables in `src/app/globals.css`.

This guide should help you get started and understand the application's structure and deployment considerations!
