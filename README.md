
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
3.  **Copy Firebase Config**: During the web app setup, Firebase will provide you with a `firebaseConfig` object. You'll need this for the environment variables (or to hardcode in `src/lib/firebase.ts` as per current setup).
4.  **Enable Firestore**: In the Firebase Console, go to "Firestore Database" and create a database. Start in **Test Mode** for initial development (allows open read/write for 30 days). **CRITICAL**: You MUST set up proper [Firestore Security Rules](#firestore-security-rules-critical-step-by-step) (see section below) *before* the test mode expires or before deploying to production. If you encounter "Missing or insufficient permissions" errors, it's almost certainly due to your Firestore rules not allowing the operation.
5.  **Enable Firebase Authentication**:
    *   In the Firebase Console, go to "Authentication".
    *   Go to the "Sign-in method" tab.
    *   **Enable the Email/Password provider.** This is required for the current login page.
    *   Go to the "Users" tab and **add at least one user** (e.g., your admin account that will be the Superior Admin). Note the UID of this user. This UID will be used as the `OWNER_UID`. The current `OWNER_UID` is `JZgMG6xdwAYInXsdciaGj6qNAsG2`.
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
3.  **Configure Firebase Credentials**:
    *   The file `src/lib/firebase.ts` is currently configured to use **hardcoded Firebase credentials**. Ensure these match your Firebase project.
    *   If you wish to switch to using environment variables (recommended for production flexibility):
        *   Create a new file named `.env.local` in the root of your project.
        *   Add your Firebase project configuration:
            ```env
            NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
            NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
            NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
            NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
            NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
            NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
            NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id" # Optional
            ```
        *   Then, update `src/lib/firebase.ts` to read these environment variables (this was the original setup).

4.  **Set Superior Admin UID**:
    *   Open `src/lib/constants.ts`.
    *   The `OWNER_UID` constant in this file defines who has superior admin access. The current value is `JZgMG6xdwAYInXsdciaGj6qNAsG2`.
    *   **If you change this UID, you MUST also update it in the Firestore Security Rules (see [Changing the Owner UID](#changing-the-owner-uid) and [Firestore Security Rules Critical Step-by-Step](#firestore-security-rules-critical-step-by-step)).**

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
    *   `firebase.ts`: Firebase initialization and configuration (currently hardcoded, can be switched to environment variables).
    *   `utils.ts`: Utility functions (like `cn` for classnames).
*   `src/types/`: TypeScript type definitions.
*   `src/hooks/`: Custom React hooks (e.g., `useDebounce`, `useToast`).
*   `.env.local`: (You create this if using environment variables) For storing Firebase credentials locally and securely. **DO NOT COMMIT.**

## Deployment Checklist (CRITICAL)

Before deploying this application to a live environment, ensure you address the following:

1.  🔐 **Firestore Security Rules (CRITICAL)**:
    *   **THIS IS THE MOST IMPORTANT STEP FOR SECURITY.**
    *   In the Firebase Console, go to "Firestore Database" -> "Rules".
    *   The default "test mode" rules are **INSECURE** for production.
    *   Deploy the rules provided in the [Firestore Security Rules Critical Step-by-Step](#firestore-security-rules-critical-step-by-step) section below. **Test them thoroughly** using the Firebase Rules Playground (see [Debugging Firestore Rules with Rules Playground (Step-by-Step)](#debugging-firestore-rules-with-rules-playground-step-by-step)).
    *   **If you see "Missing or insufficient permissions" errors in your application, it's almost always because your Firestore security rules are not correctly configured to allow the operation for the currently authenticated user.** This error means Firebase on the server-side has blocked an action because the rules didn't permit it.

2.  🔑 **Firebase Config (Environment Variables vs. Hardcoded)**:
    *   Currently, `src/lib/firebase.ts` uses hardcoded Firebase configuration.
    *   For better security and flexibility in production, switch to using `NEXT_PUBLIC_FIREBASE_...` environment variables from a `.env.local` file (for local development) and configure these in your hosting provider.

3.  🚪 **Firebase Authentication Setup & Admin Roles**:
    *   **Enable Email/Password Provider**: In Firebase Console > Authentication > Sign-in method, enable the "Email/Password" provider.
    *   **Create Initial Superior Admin User**: In Firebase Console > Authentication > Users, add the user who will be the superior admin. Note their UID and ensure it matches `OWNER_UID` in `src/lib/constants.ts` (`JZgMG6xdwAYInXsdciaGj6qNAsG2`).
    *   **Admin Users**: Users who are granted 'admin' role via the Superior Admin panel must *also* exist as users in Firebase Authentication.

4.  🛠️ **Build-time Error Checks (`next.config.ts`)**:
    *   The `next.config.ts` file has `typescript.ignoreBuildErrors = false` and `eslint.ignoreDuringBuilds = false`. This is good for production.

5.  🚀 **Build and Deploy**:
    *   Build: `npm run build`.
    *   Deploy to your chosen hosting provider.

## Firestore Security Rules Critical Step-by-Step

The `OWNER_UID` used in these rules is taken from `src/lib/constants.ts`. If your Owner UID in that file is different, you **MUST** update it in these rules before publishing. The current `OWNER_UID` in `src/lib/constants.ts` is `JZgMG6xdwAYInXsdciaGj6qNAsG2`.

**These are "flattened" rules (no helper functions) for maximum clarity during debugging.**

1.  **Go to your Firebase Project Console.**
2.  Navigate to **Build > Firestore Database**.
3.  Click the **Rules** tab.
4.  **DELETE ALL EXISTING TEXT** in the rules editor.
5.  **COPY the ENTIRE block of rules below:**
    ```
    rules_version = '2';

    service cloud.firestore {
      match /databases/{database}/documents {

        // Participants Collection
        match /participants/{participantId} {
          allow read: if true; // Public read
          allow write: if (request.auth != null && request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2") || // Owner
                         (request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"); // Admin
        }

        // System Schools Collection
        match /system_schools/{schoolId} {
          allow read: if true; // Public read
          allow write: if request.auth != null && request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2"; // Owner only
        }

        // System Committees Collection
        match /system_committees/{committeeId} {
          allow read: if true; // Public read
          allow write: if request.auth != null && request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2"; // Owner only
        }

        // System Configuration Collection
        match /system_config/{settingId} {
          allow read, write: if request.auth != null && request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2"; // Owner only
        }

        // Users Collection (for managing admin roles)
        match /users/{userId} {
          allow write: if request.auth != null && request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2"; // Owner can write/manage roles
          allow read: if request.auth != null &&
                      (request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2" || request.auth.uid == userId); // Owner can read any, user can read own
        }

        // Allow Owner to list all user documents (for admin management page)
        match /users {
           allow list: if request.auth != null && request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2"; // Owner only
        }
      }
    }
    ```
6.  **PASTE** these rules into the empty editor in your Firebase Console.
7.  **VERIFY** that the UID `JZgMG6xdwAYInXsdciaGj6qNAsG2` is exactly correct in all places within the rules you just pasted.
8.  Click the **PUBLISH** button.

## Debugging Firestore Rules with Rules Playground (Step-by-Step)

If you are encountering "Missing or insufficient permissions" errors, especially for Owner-specific actions like adding a school, the Firebase Rules Playground is your best tool.

**Let's test if the Owner (`JZgMG6xdwAYInXsdciaGj6qNAsG2`) can add a new school:**

1.  **Go to your Firebase Project Console.**
2.  Navigate to **Build > Firestore Database**.
3.  Click the **Rules** tab.
4.  On the right side of the rules editor, you should see a section or button labeled **"Rules Playground"**, **"Develop and Test"**, or **"Test rules"**. Click it.

5.  **Configure the Simulation**:
    *   **Simulation type / Method**: Select or type `create`. (This simulates adding a new document).
    *   **Location (Path)**: Enter the path to a *new, non-existent* document in the `system_schools` collection. For example:
        `system_schools/someNewSchoolId`
        (You can make up `someNewSchoolId`; it doesn't need to exist yet).
    *   **Authentication**:
        *   Toggle **Authenticated** to **ON**.
        *   For **Provider**, you can leave it as "anonymous" or select "password" - it doesn't strictly matter for UID-based rules as long as you provide the UID.
        *   In the **Auth UID** field, enter your Owner UID: `JZgMG6xdwAYInXsdciaGj6qNAsG2`
        *   Leave **Token** fields blank (unless testing custom claims, not relevant here).
    *   **Document Data (for `create` or `update`)**: Since we are simulating a `create`, Firestore expects some data for the new document. Add a simple field:
        *   Click "Add field".
        *   Field: `name`
        *   Type: `string`
        *   Value: `Test School From Playground`
        This should look like: `{ "name": "Test School From Playground" }`

6.  **Click "Run"** (or the equivalent button to start the simulation).

7.  **Analyze Results**:
    *   The playground will show whether the `create` request was **Allowed** or **Denied**.
    *   If **Denied**, it will highlight the specific line(s) in your *currently published rules* that caused the denial. This is crucial.
        *   Look at the rule for `match /system_schools/{schoolId}`.
        *   The condition is `allow write: if request.auth != null && request.auth.uid == "JZgMG6xdwAYInXsdciaGj6qNAsG2";`.
        *   The playground will show you the values of `request.auth.uid` it used for the simulation. Ensure it is `JZgMG6xdwAYInXsdciaGj6qNAsG2`.
    *   If **Allowed**, it means your currently published rules *do* permit the Owner to create a document in `system_schools`. If your app still fails with a permission error for this action, it could indicate:
        *   The user logged into your app is *not actually* `JZgMG6xdwAYInXsdciaGj6qNAsG2` at the time of the request (check your app's client-side console logs for `auth.currentUser.uid`).
        *   Your app is trying to write to a different path than `/system_schools/{documentId}`.
        *   You are connecting to a different Firebase project from your app than the one where you are testing rules. (Check `firebaseConfig.projectId` in `src/lib/firebase.ts` and compare with the project ID in your Firebase console URL).

**Common reasons for denial in the playground when you expect an allow:**
*   **Typo in the UID**: The UID `JZgMG6xdwAYInXsdciaGj6qNAsG2` in your actual published rules in the Firebase console has a typo (e.g., wrong character, case, extra space).
*   **Path Mismatch**: The path you are simulating doesn't exactly match a path defined in your rules.
*   **Incorrect `get()` path or condition**: If a rule relies on `get()` (like the admin check for participants), ensure the path in `get()` is correct and the conditions on the retrieved data are met. (Not directly relevant for the simple `system_schools` owner check, but good to keep in mind).
*   **Rules not published**: You might be testing against rules that are not the currently active ones. Ensure you've clicked "Publish" in the main rules editor *after* pasting the correct rules.

Using the Rules Playground systematically will help you confirm if your rules are behaving as expected for the Owner UID.

## Customization

*   **Owner UID**: See [Changing the Owner UID](#changing-the-owner-uid).
*   **Attendance Statuses**: Modify the `AttendanceStatus` type in `src/types/index.ts` and update `src/components/participants/AttendanceStatusBadge.tsx` and `src/components/participants/ParticipantActions.tsx` accordingly. The default status for new participants can be configured in the Superior Admin panel.
*   **Styling**: Adjust Tailwind CSS classes and the theme variables in `src/app/globals.css`.

## Changing the Owner UID

The Superior Administrator of the application is identified by a specific Firebase Authentication User ID (UID), which is stored in `src/lib/constants.ts` as `OWNER_UID`. The current `OWNER_UID` is `JZgMG6xdwAYInXsdciaGj6qNAsG2`.

If you need to change who the owner is:

1.  **Identify the New Owner's Firebase Auth UID**:
    *   The new owner must have an existing user account in your Firebase Authentication system.
    *   You can find a user's UID in the Firebase Console (Authentication -> Users tab).
2.  **Update `src/lib/constants.ts`**:
    *   Open the file `src/lib/constants.ts`.
    *   Change the value of the `OWNER_UID` constant to the new owner's Firebase Auth UID.
    *   Example: `export const OWNER_UID = "newFirebaseUserUID";`
3.  **Update Firestore Security Rules (CRITICAL)**:
    *   Open your Firebase project in the Firebase Console.
    *   Navigate to Firestore Database -> Rules.
    *   In your security rules, find **all instances** where the old `OWNER_UID` is used (e.g., `request.auth.uid == 'JZgMG6xdwAYInXsdciaGj6qNAsG2'`).
    *   Replace these instances with the new `OWNER_UID`. Refer to the examples in [Firestore Security Rules Critical Step-by-Step](#firestore-security-rules-critical-step-by-step) and ensure the UID used there matches your new `OWNER_UID` from `constants.ts`.
    *   **Publish** your updated security rules.
4.  **Update `README.md` (Optional but Recommended)**:
    *   If you plan to share this codebase or for your own future reference, update the `OWNER_UID` mentioned in this `README.md` to reflect the new UID.
5.  **Re-deploy**: If your application is already deployed, you'll need to rebuild and re-deploy it for the changes in `src/lib/constants.ts` to take effect.

**Failure to update the Firestore Security Rules to match the new `OWNER_UID` in `constants.ts` will result in the new owner not having the necessary permissions to access superior admin features or perform owner-specific actions.**

## Troubleshooting Deployment

*   **Permission Denied / Missing Data / "Missing or insufficient permissions"**:
    *   This **almost always points to an issue with your Firestore Security Rules.** The error message (e.g., `FirebaseError: Missing or insufficient permissions. Make sure you are logged in as Owner (UID: JZgMG6xdwAYInXsdciaGj6qNAsG2) and that Firestore rules allow the Owner to write to 'system_committees' collection...`) is very specific.
    *   Check your browser's developer console for detailed errors from Firebase. These often indicate issues with Firestore Security Rules.
    *   Ensure your deployed security rules in the Firebase console match the access patterns your application needs.
    *   Use the Rules Playground in Firebase to test your rules. See the [Debugging Firestore Rules with Rules Playground (Step-by-Step)](#debugging-firestore-rules-with-rules-playground-step-by-step) section.
    *   **Verify `NEXT_PUBLIC_FIREBASE_PROJECT_ID`**: If using `.env.local`, ensure this variable correctly points to the Firebase project ID where your rules and authentication are set up. If hardcoding in `src/lib/firebase.ts`, ensure `firebaseConfig.projectId` is correct. A mismatch means your app talks to one project, but your rules are in another.
*   **Missing Firestore Indexes**:
    *   If data fetching fails with an error message in the browser console mentioning "The query requires an index...", Firestore usually provides a direct link in that error message to create the required composite index. Click it and create the index. The `getParticipants` function is most likely to trigger this if multiple filters are applied.
*   **Firebase Connection Issues / API Key Errors**:
    *   Verify that your Firebase configuration (either in `src/lib/firebase.ts` or via environment variables) is correct for your Firebase project.
*   **Login Problems**:
    *   Ensure the **Email/Password Sign-in Provider** is enabled in your Firebase project's Authentication settings.
    *   Verify that the user accounts (especially the `OWNER_UID` account) exist in Firebase Authentication.

This guide should help you get started, understand the application's structure, and prepare for a more secure deployment!

    