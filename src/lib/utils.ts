import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { AttendanceStatus } from "@/types"

/** Stepped Out and Absent count as "absent"; everything else counts as "present". */
export function isEffectivelyAbsent(status: AttendanceStatus): boolean {
  return status === 'Absent' || status === 'Stepped Out'
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getGoogleDriveImageSrc(url: string): string {
  if (!url) {
    return '';
  }
  
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }
  
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
  }
  
  return url;
}
