# Testing Guide: Filtering Fixes

## Overview
This guide helps you verify that all filtering functionality works correctly after fixing the Firestore composite index errors.

## Before Testing
1. **Stop the development server** if it's running
2. **Clear browser cache** or use Incognito/Private mode
3. **Restart the development server**: 
   ```powershell
   cd "D:\Coding\Harmun Tracker\HARMUN_TRACKER"
   npm run dev
   ```

## Test Pages

### 1. Main Dashboard (`/`)
**Tests the ParticipantDashboardClient component**

✅ **Test Cases:**
- [ ] Load page - should display without errors
- [ ] Filter by School only (select any school)
- [ ] Filter by Committee only (select any committee)
- [ ] Filter by Status only (select Present/Absent)
- [ ] Filter by School + Committee
- [ ] Filter by School + Status
- [ ] Filter by Committee + Status
- [ ] Filter by School + Committee + Status
- [ ] Search with text while filters are active
- [ ] Clear all filters

**Expected Result:** All combinations should work without showing "Failed to fetch filtered data" error.

---

### 2. Staff Management Page (`/staff`)
**Tests the StaffDashboardClient component**

✅ **Test Cases:**
- [ ] Load page - should display without errors
- [ ] Filter by Team only (select any team)
- [ ] Filter by Status only (select any status)
- [ ] Filter by Team + Status
- [ ] Search with text while filters are active
- [ ] Clear all filters

**Expected Result:** All combinations should work without showing "Failed to fetch filtered data" error.

---

### 3. Public View Page (`/public`)
**Tests the public participant view with real-time updates**

✅ **Test Cases:**
- [ ] Load page - should display without errors
- [ ] Filter by School only
- [ ] Filter by Committee only
- [ ] Click "Present" quick filter button
- [ ] Click "Absent" quick filter button
- [ ] Click "All Participants" button
- [ ] Filter by School + Committee + Status simultaneously
- [ ] Search with text while filters are active
- [ ] Leave page open for 1 minute to verify real-time updates work

**Expected Result:** All combinations should work without console errors. Real-time updates should continue working.

---

## What to Check

### Browser Console (F12)
1. Open browser DevTools (Press F12)
2. Go to Console tab
3. Clear console
4. Test each filter combination
5. **Look for:**
   - ❌ NO errors about "Failed to fetch filtered data"
   - ❌ NO errors about "requires an index"
   - ❌ NO 500 Internal Server Error
   - ✅ May see warnings about composite indexes (these are informational)

### Terminal/Server Logs
1. Watch the terminal where `npm run dev` is running
2. **Look for:**
   - ❌ NO errors about failed preconditions
   - ✅ May see warnings about "[Server Action] Composite index needed" (informational)

### UI Behavior
- [ ] All filters work smoothly
- [ ] Data displays correctly for all filter combinations
- [ ] No loading spinners that never complete
- [ ] Toast notifications appear for actual errors only (not for normal filtering)

---

## Performance Check

After all filters work correctly:

1. **Small Dataset (< 100 records):**
   - All filter combinations should feel instant

2. **Medium Dataset (100-1000 records):**
   - First filter selection: 1-2 seconds
   - Subsequent filters: < 1 second

3. **Large Dataset (> 1000 records):**
   - First filter: 2-5 seconds
   - Subsequent filters: 1-2 seconds
   - Consider creating composite indexes if performance is poor

---

## Common Issues

### Issue: Filters still showing errors
**Solution:**
1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache completely
3. Restart dev server
4. Check that all files were saved properly

### Issue: Infinite loading spinner
**Solution:**
1. Check browser console for errors
2. Check Firestore rules allow read access
3. Verify Firebase config is correct

### Issue: Data not filtering correctly
**Solution:**
1. Check that data in Firestore has the correct field names
2. Verify field values match exactly (case-sensitive)
3. Check console for any filtering logic errors

---

## Success Criteria

✅ **All tests pass when:**
1. No "Failed to fetch filtered data" errors in console
2. No 500 errors in Network tab
3. All filter combinations return correct results
4. Performance is acceptable for your dataset size
5. Real-time updates work on public page
6. No console errors during normal operation

---

## If Tests Fail

1. **Document the exact steps** that cause the error
2. **Capture the error message** from browser console
3. **Check the Network tab** in DevTools for failed requests
4. **Review the terminal** for server-side errors
5. **Contact support** with:
   - Which page/filter combination failed
   - Browser console error messages
   - Server terminal error messages
   - Screenshots if helpful

---

## Next Steps After Testing

### If All Tests Pass:
1. ✅ Deploy to production
2. ✅ Monitor production logs for any issues
3. ✅ Consider creating composite indexes if dataset grows large

### If Tests Show Performance Issues:
1. Review dataset size
2. Consider implementing pagination
3. Create composite indexes in Firebase Console
4. Monitor query performance metrics

---

## Notes

- The hybrid filtering approach (server + client-side) works best for datasets under 10,000 records
- For larger datasets, composite indexes may be necessary
- Search is always performed client-side for maximum flexibility
- Real-time listeners (public page) may use more client-side filtering than static pages
