// This file is no longer needed as the QR scanning page has been removed.
// It is kept with a minimal component to prevent build errors.
// You can safely delete this file from your project.

import React from 'react';

export default function DeprecatedScanPage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>QR Scan Page (Removed)</h1>
      <p>This page is no longer in use.</p>
      <p>
        QR code management and download functionality can be found on the
        QR Management page accessible from the sidebar.
      </p>
    </div>
  );
}
