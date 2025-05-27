// This file is no longer the primary source of data after Firestore integration.
// It can be kept for reference or removed.
// For a clean setup, it's better to remove it if all data operations now go through Firestore.

import type { Participant } from '@/types'; // Added import

// Helper to generate IDs if uuid is not available/preferred for mocks
// const generateId = () => Math.random().toString(36).substr(2, 9);


// export const schools: string[] = ["Northwood High", "University High", "Portola High", "Woodbridge High", "Irvine High", "Beckman High"];
// export const committees: string[] = ["UNSC", "DISEC", "SOCHUM", "ECOFIN", "WHO", "UNHRC", "SPECPOL"];

// export const initialParticipants: Participant[] = [
//   {
//     id: generateId(),
//     name: "John Doe",
//     school: "Northwood High",
//     committee: "UNSC",
//     status: "Present",
//     imageUrl: "https://placehold.co/40x40.png",
//   },
//   {
//     id: generateId(),
//     name: "Alice Smith",
//     school: "University High",
//     committee: "DISEC",
//     status: "In Break",
//     imageUrl: "https://placehold.co/40x40.png",
//   },
//   // ... other mock participants
// ];

export const schools: string[] = []; // Will be fetched from Firestore
export const committees: string[] = []; // Will be fetched from Firestore
export const initialParticipants: Participant[] = []; // Will be fetched from Firestore
