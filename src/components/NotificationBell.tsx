import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data as unknown as Notification[]);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifs-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const notif = payload.new as Notification;
        setNotifications(prev => [notif, ...prev.slice(0, 19)]);

        // Persistent sonner toast (5s) for critical events
        const isCritical = notif.type === 'success' || notif.title.includes('📥') || notif.title.includes('⚠️');
        sonnerToast(notif.title, {
          description: notif.message,
          duration: isCritical ? 5000 : 3000,
          action: notif.link ? {
            label: 'Voir',
            onClick: () => navigate(notif.link!),
          } : undefined,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, navigate]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'à l\'instant';
    if (mins < 60) return `il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-500';
      case 'error': return 'bg-destructive';
      case 'warning': return 'bg-amber-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" />
              Tout marquer comme lu
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[380px]">
          {notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 10).map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                    !notif.is_read && 'bg-muted/20'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn(
                      'mt-1.5 h-2 w-2 rounded-full shrink-0',
                      getTypeIcon(notif.type)
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[13px] leading-snug', !notif.is_read ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
