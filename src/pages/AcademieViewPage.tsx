import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  GraduationCap, FileText, Video, Image as ImageIcon, FileBox, Link as LinkIcon,
  Download, ExternalLink, Lock, ChevronRight, ChevronDown, CheckCircle2, Circle,
  PlayCircle, ArrowLeft, MessageCircle, Send, Trash2,
} from 'lucide-react';

const FILE_TYPE_ICONS = {
  video: Video,
  image: ImageIcon,
  pdf: FileText,
  document: FileBox,
  link: LinkIcon,
};

type AcademyFile = {
  id: string;
  academy_id: string;
  section_id: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_type: 'video' | 'image' | 'pdf' | 'document' | 'link';
  is_external: boolean;
  file_size_mb: number | null;
  category: string | null;
  sort_order: number;
};

type AcademySection = {
  id: string;
  academy_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

export default function AcademieViewPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [mobileShowList, setMobileShowList] = useState(true);

  const { data: academy, isLoading } = useQuery({
    queryKey: ['academy-view', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await supabase.from('academies').select('*').eq('slug', slug).maybeSingle();
      return data;
    },
    enabled: !!slug && !!user,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['academy-view-sections', academy?.id],
    queryFn: async () => {
      if (!academy) return [];
      const { data } = await supabase.from('academy_sections').select('*').eq('academy_id', academy.id).order('sort_order');
      return (data || []) as AcademySection[];
    },
    enabled: !!academy,
  });

  const { data: files = [] } = useQuery({
    queryKey: ['academy-view-files', academy?.id],
    queryFn: async () => {
      if (!academy) return [];
      const { data } = await supabase.from('academy_files').select('*').eq('academy_id', academy.id).order('sort_order');
      return (data || []) as AcademyFile[];
    },
    enabled: !!academy,
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['academy-progress', user?.id, academy?.id],
    queryFn: async () => {
      if (!user || !academy) return [];
      const fileIds = files.map(f => f.id);
      if (fileIds.length === 0) return [];
      const { data } = await supabase
        .from('academy_file_progress')
        .select('file_id')
        .eq('user_id', user.id)
        .in('file_id', fileIds);
      return (data || []).map((p: any) => p.file_id) as string[];
    },
    enabled: !!user && !!academy && files.length > 0,
  });

  const completedSet = useMemo(() => new Set(progress), [progress]);

  // Auto-select first lesson if none + auto-expand first section
  useEffect(() => {
    if (sections.length > 0 && expandedSections.size === 0) {
      setExpandedSections(new Set([sections[0].id]));
    }
  }, [sections]);

  useEffect(() => {
    if (!activeFileId && files.length > 0) {
      // Pick first file in first section
      const firstSection = sections[0];
      if (firstSection) {
        const sFiles = files.filter(f => f.section_id === firstSection.id).sort((a, b) => a.sort_order - b.sort_order);
        if (sFiles.length > 0) setActiveFileId(sFiles[0].id);
      } else if (files.length > 0) {
        setActiveFileId(files[0].id);
      }
    }
  }, [files, sections, activeFileId]);

  // Fetch signed URL for active file
  useEffect(() => {
    let cancelled = false;
    const f = files.find(f => f.id === activeFileId);
    if (!f) { setSignedUrl(null); return; }
    if (f.is_external) { setSignedUrl(f.file_url); return; }
    setSignedUrl(null);
    supabase.storage.from('academy-files').createSignedUrl(f.file_url, 3600).then(({ data }) => {
      if (!cancelled) setSignedUrl(data?.signedUrl || null);
    });
    return () => { cancelled = true; };
  }, [activeFileId, files]);

  const toggleProgress = useMutation({
    mutationFn: async (fileId: string) => {
      if (!user) return;
      if (completedSet.has(fileId)) {
        await supabase.from('academy_file_progress').delete().eq('user_id', user.id).eq('file_id', fileId);
      } else {
        await supabase.from('academy_file_progress').insert({ user_id: user.id, file_id: fileId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academy-progress'] });
    },
  });

  const downloadFile = async (f: AcademyFile) => {
    if (f.is_external) {
      window.open(f.file_url, '_blank');
      return;
    }
    const { data } = await supabase.storage.from('academy-files').createSignedUrl(f.file_url, 60);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = f.title;
      a.click();
    }
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /></div></AppLayout>;
  }

  if (!academy) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <Lock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Accès refusé</h1>
          <p className="text-sm text-muted-foreground mb-6">Cette académie n'existe pas ou tu n'as pas l'autorisation de la consulter.</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Retour au dashboard</button>
        </div>
      </AppLayout>
    );
  }

  const totalFiles = files.length;
  const completedCount = files.filter(f => completedSet.has(f.id)).length;
  const overallProgress = totalFiles > 0 ? Math.round((completedCount / totalFiles) * 100) : 0;

  const activeFile = files.find(f => f.id === activeFileId);
  const orphanFiles = files.filter(f => !f.section_id);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Header avec progression globale */}
        <div className="bg-gradient-to-br from-blue-600/15 to-violet-600/15 border border-blue-500/20 rounded-2xl p-4 sm:p-5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate">{academy.name}</h1>
              {academy.description && <p className="text-xs text-muted-foreground line-clamp-1">{academy.description}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-foreground leading-none">{overallProgress}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{completedCount}/{totalFiles}</p>
            </div>
          </div>
          {totalFiles > 0 && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all" style={{ width: `${overallProgress}%` }} />
            </div>
          )}
        </div>

        {/* Layout Skool-style : sidebar + content */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Mobile : toggle list/lesson */}
          <div className="lg:hidden flex gap-2 mb-2">
            <button onClick={() => setMobileShowList(true)} className={`flex-1 py-2 rounded-xl text-xs font-semibold ${mobileShowList ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>Programme</button>
            <button onClick={() => setMobileShowList(false)} className={`flex-1 py-2 rounded-xl text-xs font-semibold ${!mobileShowList ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>Leçon</button>
          </div>

          {/* Sidebar : sections + lessons */}
          <div className={`${mobileShowList ? 'block' : 'hidden'} lg:block bg-card border border-border rounded-2xl overflow-hidden lg:max-h-[calc(100vh-220px)] lg:sticky lg:top-4 lg:overflow-y-auto`}>
            {sections.map(section => {
              const sFiles = files.filter(f => f.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order);
              const sCompleted = sFiles.filter(f => completedSet.has(f.id)).length;
              const isExpanded = expandedSections.has(section.id);
              return (
                <div key={section.id} className="border-b border-border last:border-0">
                  <button onClick={() => toggleSection(section.id)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{section.title}</p>
                      <p className="text-[10px] text-muted-foreground">{sCompleted}/{sFiles.length} terminé{sCompleted > 1 ? 's' : ''}</p>
                    </div>
                    {sFiles.length > 0 && sCompleted === sFiles.length && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="bg-muted/20">
                      {sFiles.map(f => {
                        const Icon = FILE_TYPE_ICONS[f.file_type];
                        const isActive = activeFileId === f.id;
                        const isDone = completedSet.has(f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => { setActiveFileId(f.id); setMobileShowList(false); }}
                            className={`w-full flex items-center gap-2.5 pl-9 pr-4 py-2.5 hover:bg-muted/50 transition-colors text-left ${isActive ? 'bg-blue-500/10 border-l-2 border-blue-500' : ''}`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                            )}
                            <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <p className={`text-xs truncate flex-1 ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{f.title}</p>
                          </button>
                        );
                      })}
                      {sFiles.length === 0 && (
                        <p className="px-9 py-2 text-[10px] text-muted-foreground italic">Vide</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Orphan files */}
            {orphanFiles.length > 0 && (
              <div className="border-t border-border bg-amber-500/5">
                <p className="px-4 py-2 text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Sans section</p>
                {orphanFiles.map(f => {
                  const Icon = FILE_TYPE_ICONS[f.file_type];
                  const isActive = activeFileId === f.id;
                  const isDone = completedSet.has(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => { setActiveFileId(f.id); setMobileShowList(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left ${isActive ? 'bg-blue-500/10 border-l-2 border-blue-500' : ''}`}
                    >
                      {isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />}
                      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <p className={`text-xs truncate flex-1 ${isActive ? 'font-semibold' : 'text-muted-foreground'}`}>{f.title}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {sections.length === 0 && orphanFiles.length === 0 && (
              <div className="text-center py-10 px-4">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Aucune leçon disponible</p>
              </div>
            )}
          </div>

          {/* Lesson content */}
          <div className={`${!mobileShowList ? 'block' : 'hidden'} lg:block`}>
            {!activeFile ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <PlayCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Sélectionne une leçon pour commencer</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Mobile back */}
                <button onClick={() => setMobileShowList(true)} className="lg:hidden flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground border-b border-border">
                  <ArrowLeft className="h-3.5 w-3.5" /> Retour au programme
                </button>

                {/* Player area */}
                <div className="bg-black/5 dark:bg-black/30 min-h-[300px] flex items-center justify-center">
                  {!signedUrl ? (
                    <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  ) : activeFile.file_type === 'video' ? (
                    <video controls className="w-full max-h-[60vh]" src={signedUrl} key={activeFile.id} />
                  ) : activeFile.file_type === 'image' ? (
                    <img src={signedUrl} alt={activeFile.title} className="w-full max-h-[60vh] object-contain" />
                  ) : activeFile.file_type === 'pdf' ? (
                    <iframe src={signedUrl} className="w-full h-[60vh]" title={activeFile.title} />
                  ) : activeFile.file_type === 'link' ? (
                    <div className="p-12 text-center w-full">
                      <LinkIcon className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                      <p className="text-sm font-medium mb-3">Cette ressource s'ouvre dans un nouvel onglet</p>
                      <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold">
                        <ExternalLink className="h-4 w-4" />
                        Ouvrir le lien
                      </a>
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <FileBox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-4">Aperçu non disponible pour ce type de fichier.</p>
                      <button onClick={() => downloadFile(activeFile)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                        <Download className="h-4 w-4" />
                        Télécharger
                      </button>
                    </div>
                  )}
                </div>

                {/* Lesson info + actions */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base sm:text-lg font-bold">{activeFile.title}</h2>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                        {activeFile.file_type}
                        {activeFile.file_size_mb ? ` · ${activeFile.file_size_mb} MB` : ''}
                      </p>
                    </div>
                    {!activeFile.is_external && (
                      <button onClick={() => downloadFile(activeFile)} className="flex-shrink-0 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-500" title="Télécharger">
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {activeFile.description && (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-blue-500 prose-li:text-muted-foreground prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {activeFile.description}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Mark complete */}
                  <button
                    onClick={() => toggleProgress.mutate(activeFile.id)}
                    disabled={toggleProgress.isPending}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      completedSet.has(activeFile.id)
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } disabled:opacity-50`}
                  >
                    {completedSet.has(activeFile.id) ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Leçon terminée
                      </>
                    ) : (
                      <>
                        <Circle className="h-4 w-4" />
                        Marquer comme terminée
                      </>
                    )}
                  </button>
                </div>

                {/* Comments section */}
                <LessonComments fileId={activeFile.id} academyOwnerId={academy.owner_user_id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/* ── Section commentaires sous une leçon (style Skool) ── */
function LessonComments({ fileId, academyOwnerId }: { fileId: string; academyOwnerId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data: comments = [] } = useQuery({
    queryKey: ['lesson-comments', fileId],
    queryFn: async () => {
      const { data } = await supabase
        .from('academy_lesson_comments')
        .select('*')
        .eq('file_id', fileId)
        .order('created_at', { ascending: true });
      if (!data || data.length === 0) return [];
      const userIds = Array.from(new Set(data.map((c: any) => c.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      return data.map((c: any) => ({
        ...c,
        author: profiles?.find((p: any) => p.id === c.user_id) || null,
      }));
    },
  });

  const postComment = useMutation({
    mutationFn: async () => {
      if (!user || !body.trim()) return;
      const { error } = await supabase.from('academy_lesson_comments').insert({
        file_id: fileId,
        user_id: user.id,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['lesson-comments', fileId] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('academy_lesson_comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-comments', fileId] });
    },
  });

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{comments.length} commentaire{comments.length > 1 ? 's' : ''}</h3>
      </div>

      {/* Form */}
      <div className="flex gap-2 mb-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écris un commentaire..."
          rows={2}
          className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              postComment.mutate();
            }
          }}
        />
        <button
          onClick={() => postComment.mutate()}
          disabled={!body.trim() || postComment.isPending}
          className="self-end p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-3">Sois le premier à commenter</p>
        )}
        {comments.map((c: any) => {
          const initials = c.author?.full_name?.split(' ').map((s: string) => s[0]).slice(0, 2).join('') || '?';
          const isOwn = c.user_id === user?.id;
          const isOwner = c.user_id === academyOwnerId;
          const canDelete = isOwn || user?.id === academyOwnerId;
          const date = new Date(c.created_at);
          const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={c.id} className="flex gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-muted/40 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-foreground truncate">{c.author?.full_name || 'Utilisateur'}</p>
                    {isOwner && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-600 dark:text-violet-300">PROF</span>}
                    <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                    {canDelete && (
                      <button onClick={() => { if (confirm('Supprimer ?')) deleteComment.mutate(c.id); }} className="ml-auto p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line break-words">{c.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
