'use client';

import React, { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, Clock, UserRound, Loader2, Info } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Participant } from '@/types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export function NotificationCenter() {
  const [overdueParticipants, setOverdueParticipants] = useState<Participant[]>([]);
  const [toiletBreakThreshold, setToiletBreakThreshold] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(true);
  const [overtakingIds, setOvertakingIds] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function fetchThreshold() {
      try {
        const configSnap = await getDoc(doc(db, 'system_config', 'main_settings'));
        if (configSnap.exists()) {
          const configData = configSnap.data();
          if (configData.toiletBreakThreshold !== undefined) {
            setToiletBreakThreshold(configData.toiletBreakThreshold);
          }
        }
      } catch (error) {
        console.error("Error fetching threshold:", error);
      }
    }
    fetchThreshold();
  }, []);

  useEffect(() => {
    const participantsRef = collection(db, 'participants');
    const q = query(
      participantsRef,
      where('status', '==', 'Restroom Break'),
      where('restroomBreakOvertaken', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRestroom = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as Participant[];

      const filtered = allRestroom.filter(p => {
        if (!p.statusChangedAt) return false;
        const startTime = typeof p.statusChangedAt === 'string' ? parseISO(p.statusChangedAt) : (p.statusChangedAt as any).toDate();
        const diffInMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
        return diffInMinutes >= toiletBreakThreshold;
      });

      setOverdueParticipants(filtered);
      setIsLoading(false);
    }, (error) => {
      console.error("Error listening to overdue participants:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toiletBreakThreshold]);

  const handleOvertake = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOvertakingIds(prev => [...prev, id]);
    try {
      await updateDoc(doc(db, "participants", id), {
        restroomBreakOvertaken: true,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Overtaken", description: "Notification removed." });
    } catch (error: any) {
      console.error("Overtake failed:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setOvertakingIds(prev => prev.filter(i => i !== id));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {overdueParticipants.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground animate-pulse">
              {overdueParticipants.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {overdueParticipants.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {overdueParticipants.length} Urgent
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : overdueParticipants.length > 0 ? (
            overdueParticipants.map(p => {
              const startTime = typeof p.statusChangedAt === 'string' ? parseISO(p.statusChangedAt) : (p.statusChangedAt as any).toDate();
              return (
                <DropdownMenuItem
                  key={p.id}
                  className="flex flex-col items-start p-3 focus:bg-accent cursor-pointer"
                  onClick={() => router.push(`/participants/${p.id}`)}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-destructive" />
                      <span className="font-bold text-sm">{p.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(startTime)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2 px-6">
                    Committee: {p.committee}
                  </div>
                  <div className="flex justify-end w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={(e) => handleOvertake(p.id, e)}
                      disabled={overtakingIds.includes(p.id)}
                    >
                      {overtakingIds.includes(p.id) ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Overtake
                    </Button>
                  </div>
                </DropdownMenuItem>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <div className="bg-muted rounded-full p-3 mb-2">
                <Info className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground">No urgent restroom break notifications.</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
