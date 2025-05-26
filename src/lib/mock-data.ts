import type { Participant } from '@/types';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is installed or use a simpler ID generation

// Helper to generate IDs if uuid is not available/preferred for mocks
const generateId = () => Math.random().toString(36).substr(2, 9);


export const schools: string[] = ["Northwood High", "University High", "Portola High", "Woodbridge High", "Irvine High", "Beckman High"];
export const committees: string[] = ["UNSC", "DISEC", "SOCHUM", "ECOFIN", "WHO", "UNHRC", "SPECPOL"];

export const initialParticipants: Participant[] = [
  {
    id: generateId(),
    name: "John Doe",
    school: "Northwood High",
    committee: "UNSC",
    status: "Present",
    imageUrl: "https://placehold.co/40x40.png",
  },
  {
    id: generateId(),
    name: "Alice Smith",
    school: "University High",
    committee: "DISEC",
    status: "Absent",
    imageUrl: "https://placehold.co/40x40.png",
  },
  {
    id: generateId(),
    name: "Bob Johnson",
    school: "Portola High",
    committee: "SOCHUM",
    status: "Present On Account",
    imageUrl: "https://placehold.co/40x40.png",
  },
  {
    id: generateId(),
    name: "Eva Williams",
    school: "Northwood High",
    committee: "ECOFIN",
    status: "Present",
    imageUrl: "https://placehold.co/40x40.png",
  },
  {
    id: generateId(),
    name: "Michael Brown",
    school: "Woodbridge High",
    committee: "UNSC",
    status: "Absent",
    imageUrl: "https://placehold.co/40x40.png",
  },
  {
    id: generateId(),
    name: "Sophia Davis",
    school: "University High",
    committee: "WHO",
    status: "Present",
    imageUrl: "https://placehold.co/40x40.png",
  },
  {
    id: generateId(),
    name: "David Wilson",
    school: "Irvine High",
    committee: "DISEC",
    status: "Present On Account",
    imageUrl: "https://placehold.co/40x40.png",
  },
  {
    id: generateId(),
    name: "Olivia Garcia",
    school: "Beckman High",
    committee: "UNHRC",
    status: "Present",
    imageUrl: "https://placehold.co/40x40.png",
  }
];
