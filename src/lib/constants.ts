// src/lib/constants.ts

/**
 * The Firebase Authentication UID of the designated "Owner" or "Superior Administrator" of the application.
 * This UID is used to grant special permissions for accessing sensitive areas like the Superior Admin panel
 * and for performing system-wide administrative actions.
 *
 * !!! CRITICAL SECURITY NOTE !!!
 * If you change this UID, you MUST ALSO update it in your Firebase project's
 * Firestore Security Rules. The rules provided in README.md use this UID to grant
 * elevated permissions. A mismatch will result in the new owner not having the correct
 * access, or the old owner retaining unintended access via Firestore rules.
 *
 * This UID is referenced in:
 * - src/app/superior-admin/** (all pages for access control)
 * - src/components/layout/AppLayoutClientShell.tsx (to conditionally show the Superior Admin link)
 * - Firestore Security Rules (in your Firebase project console, see README.md for examples)
 */
export const OWNER_UID = "JZgMG6xdwAYInXsdciaGj6qNAsG2";
