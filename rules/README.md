# Firestore Security Rules

This folder contains two versions of Firestore security rules for your HARMUN Tracker project.

## Files

### 1. `firestore-option1-public-checkin.rules`
**Use Case:** Public QR code check-in without authentication

**Features:**
- ✅ Anyone can scan QR codes and update participant/staff attendance status
- ✅ Public updates are restricted to attendance fields only: `status`, `attended`, `checkInTime`, `updatedAt`
- ✅ Only admins can create/delete participants or edit other fields (name, school, etc.)
- ⚠️ Less secure but more convenient for public events

**Best for:** Events where you want guests to self-check-in via QR codes without logging in.

---

### 2. `firestore-option2-auth-only.rules`
**Use Case:** Authenticated check-in with login required

**Features:**
- ✅ Any logged-in user can update participant/staff attendance status
- ✅ Updates are restricted to attendance fields only: `status`, `attended`, `checkInTime`, `updatedAt`
- ✅ Only admins can create/delete participants or edit other fields
- ✅ More secure - requires authentication

**Best for:** Events where you want to track who is updating attendance or require login for accountability.

---

## How to Deploy

1. **Choose the rule file** that matches your use case
2. **Copy the contents** of your chosen file
3. **Go to Firebase Console** → Firestore Database → Rules
4. **Paste the rules** and publish

### Quick Deploy Command
```bash
# For Option 1 (Public Check-In)
firebase deploy --only firestore:rules --project harmun-tracker

# For Option 2 (Auth-Only)
firebase deploy --only firestore:rules --project harmun-tracker
```

**Note:** Make sure to update `firestore.rules` in your project root with your chosen option before deploying.

---

## Key Differences

| Feature | Option 1 (Public) | Option 2 (Auth) |
|---------|-------------------|-----------------|
| QR Check-In | No login required | Login required |
| Security Level | Medium | High |
| User Experience | Faster/easier | Requires authentication |
| Attendance Updates | Anyone | Authenticated users only |
| Admin Operations | Admins only | Admins only |

---

## Testing

After deployment, test by:
1. Scanning a participant QR code from `/checkin` page
2. Verifying status updates work correctly
3. Testing that you cannot edit protected fields (name, school, etc.) without admin access

---

## Troubleshooting

**"Permission Denied" Error:**
- Ensure you deployed the correct rule file
- Check Firebase Console → Rules are published
- Verify your app is connected to the correct Firebase project

**"auth/invalid-credential" Error:**
- This is unrelated to Firestore rules
- Create the user account in Firebase Authentication
- Verify `.env` has correct Firebase credentials
