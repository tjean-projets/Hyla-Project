import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useEffectiveUserId } from './useEffectiveUser';

const STORAGE_KEY = 'hyla-notifications-enabled';

export function notificationsEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function useNotifications() {
  const effectiveId = useEffectiveUserId();

  /** Ask for permission + save preference */
  const enable = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    localStorage.setItem(STORAGE_KEY, 'true');
    return true;
  }, []);

  const disable = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'false');
  }, []);

  /** Schedule reminders for upcoming appointments (30 min before) */
  const scheduleReminders = useCallback(async () => {
    if (!effectiveId) return;
    if (!notificationsEnabled()) return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const endWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // next 24h

    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, title, start_time, contact_id, contacts(first_name, last_name)')
      .eq('user_id', effectiveId)
      .gte('start_time', now.toISOString())
      .lte('start_time', endWindow.toISOString())
      .order('start_time');

    if (!appointments?.length) return;

    const sw = await navigator.serviceWorker?.ready;

    for (const apt of appointments) {
      const aptTime = new Date(apt.start_time);
      const reminderTime = new Date(aptTime.getTime() - 30 * 60 * 1000); // 30 min before
      const delay = reminderTime.getTime() - Date.now();
      if (delay < 0) continue; // already past

      const contactName = (apt as any).contacts
        ? `${(apt as any).contacts.first_name} ${(apt as any).contacts.last_name}`
        : '';
      const timeStr = aptTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const title = `📅 RDV dans 30 min — ${apt.title}`;
      const body = contactName ? `${timeStr} · ${contactName}` : timeStr;

      if (sw) {
        // Use SW to show notification (works in background)
        sw.active?.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          title,
          body,
          delay,
          url: '/calendar',
        });
      } else {
        // Fallback: direct Notification API
        setTimeout(() => {
          new Notification(title, { body, icon: '/Hyla_logo_bold.png' });
        }, delay);
      }
    }
  }, [effectiveId]);

  // Schedule on mount and every hour
  useEffect(() => {
    scheduleReminders();
    const interval = setInterval(scheduleReminders, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [scheduleReminders]);

  return {
    permission: typeof window !== 'undefined' ? Notification?.permission : 'default',
    enabled: notificationsEnabled(),
    enable,
    disable,
  };
}
