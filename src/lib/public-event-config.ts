/**
 * Public page branding config – edit these values directly to update
 * the event logo and hero images on the public page. No system settings needed.
 *
 * Add your images to: public/images/
 */
export const PUBLIC_EVENT_CONFIG = {
  /** Event logo – shown in header and footer */
  eventLogoPath: '/images/HARMUN.png',
  /** Set to true when you've added hero images to public/images/ */
  showHeroImages: true,
  /** 3 hero images – displayed in a row above the content */
  heroImagePaths: [
    '/images/RHTI.png',
    '/images/RHHS.png',
    '/images/HARMUN.png',
  ],
  brandName: 'MUN Attendance Tracker',
  reservedRightsText: 'All rights reserved.',
} as const;
