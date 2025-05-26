'use server';

import { revalidatePath } from 'next/cache';
import { initialParticipants, schools as mockSchoolsData, committees as mockCommitteesData } from './mock-data';
import type { Participant, AttendanceStatus } from '@/types';

// Simulate a database. In a real app, this would be a database client.
let participantsDB: Participant[] = JSON.parse(JSON.stringify(initialParticipants)); // Deep copy to allow modifications

export async function getParticipants(filters?: { school?: string; committee?: string; searchTerm?: string }): Promise<Participant[]> {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  
  let filteredParticipants = [...participantsDB];

  if (filters?.school && filters.school !== "All Schools") {
    filteredParticipants = filteredParticipants.filter(p => p.school === filters.school);
  }
  if (filters?.committee && filters.committee !== "All Committees") {
    filteredParticipants = filteredParticipants.filter(p => p.committee === filters.committee);
  }
  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    filteredParticipants = filteredParticipants.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.school.toLowerCase().includes(term) ||
      p.committee.toLowerCase().includes(term)
    );
  }
  return JSON.parse(JSON.stringify(filteredParticipants));
}

export async function getSchools(): Promise<string[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return [...mockSchoolsData];
}

export async function getCommittees(): Promise<string[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return [...mockCommitteesData];
}

export async function addParticipant(participantData: Omit<Participant, 'id' | 'status' | 'imageUrl'>): Promise<Participant> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const newParticipant: Participant = {
    ...participantData,
    id: Math.random().toString(36).substr(2, 9), // Simple ID generation for mock
    status: 'Absent', // Default status
    imageUrl: 'https://placehold.co/40x40.png',
  };
  participantsDB.unshift(newParticipant); // Add to the beginning of the array
  revalidatePath('/');
  revalidatePath('/public');
  return JSON.parse(JSON.stringify(newParticipant));
}

export async function updateParticipant(participantId: string, participantData: Partial<Omit<Participant, 'id'>>): Promise<Participant | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const index = participantsDB.findIndex(p => p.id === participantId);
  if (index !== -1) {
    participantsDB[index] = { ...participantsDB[index], ...participantData };
    revalidatePath('/');
    revalidatePath('/public');
    return JSON.parse(JSON.stringify(participantsDB[index]));
  }
  return null;
}

export async function deleteParticipant(participantId: string): Promise<{ success: boolean }> {
  await new Promise(resolve => setTimeout(resolve, 200));
  participantsDB = participantsDB.filter(p => p.id !== participantId);
  revalidatePath('/');
  revalidatePath('/public');
  return { success: true };
}

export async function markAttendance(participantId: string, status: AttendanceStatus): Promise<Participant | null> {
  await new Promise(resolve => setTimeout(resolve, 100));
  const index = participantsDB.findIndex(p => p.id === participantId);
  if (index !== -1) {
    participantsDB[index].status = status;
    revalidatePath('/');
    revalidatePath('/public');
    return JSON.parse(JSON.stringify(participantsDB[index]));
  }
  return null;
}

export async function importParticipants(parsedParticipants: Omit<Participant, 'id' | 'status' | 'imageUrl'>[]): Promise<{ count: number }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  let importedCount = 0;
  parsedParticipants.forEach(data => {
    const newParticipant: Participant = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      status: 'Absent',
      imageUrl: 'https://placehold.co/40x40.png',
    };
    // Avoid duplicates based on name, school, committee for this mock
    const exists = participantsDB.some(p => p.name === newParticipant.name && p.school === newParticipant.school && p.committee === newParticipant.committee);
    if (!exists) {
      participantsDB.unshift(newParticipant);
      importedCount++;
    }
  });
  if (importedCount > 0) {
    revalidatePath('/');
    revalidatePath('/public');
  }
  return { count: importedCount };
}
