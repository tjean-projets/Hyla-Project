import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap, FileText, Video, Image as ImageIcon, FileBox, Link as LinkIcon,
  Download, ExternalLink, Lock, X, Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

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
  title: string;
  description: string | null;
  file_url: string;
  file_type: 'video' | 'image' | 'pdf' | 'document' | 'link';
  is_external: boolean;
  file_size_mb: number | null;
  category: string | null;
  created_at: string;
};

export default function AcademieViewPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [previewFile, setPreviewFile] = useState<AcademyFile | null>(null);
  const [previewSignedUrl, setPreviewSignedUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Fetch academy par slug (RLS filtre automatiquement)
  const { data: academy, isLoading } = useQuery({
    queryKey: ['academy-view', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await supabase
        .from('academies')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      return data;
    },
    enabled: !!slug && !!user,
  });

  // Fichiers de l'académie
  const { data: files = [] } = useQuery({
    queryKey: ['academy-view-files', academy?.id],
    queryFn: async () => {
      if (!academy) return [];
      const { data } = await supabase
        .from('academy_files')
        .select('*')
        .eq('academy_id', academy.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      return (data || []) as AcademyFile[];
    },
    enabled: !!academy,
  });

  // Catégories uniques
  const categories = useMemo(() => {
    const set = new Set<string>();
    files.forEach(f => { if (f.category) set.add(f.category); });
    return Array.from(set);
  }, [files]);

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter(f =>
      f.title.toLowerCase().includes(q) ||
      (f.category || '').toLowerCase().includes(q)
    );
  }, [files, search]);

  const openPreview = async (file: AcademyFile) => {
    if (file.is_external) {
      window.open(file.file_url, '_blank');
      return;
    }
    setPreviewFile(file);
    const { data } = await supabase.storage
      .from('academy-files')
      .createSignedUrl(file.file_url, 3600);
    setPreviewSignedUrl(data?.signedUrl || null);
  };

  const downloadFile = async (file: AcademyFile) => {
    if (file.is_external) {
      window.open(file.file_url, '_blank');
      return;
    }
    const { data } = await supabase.storage
      .from('academy-files')
      .createSignedUrl(file.file_url, 60);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = file.title;
      a.click();
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!academy) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <Lock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Accès refusé</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Cette académie n'existe pas ou tu n'as pas l'autorisation de la consulter.
            Contacte le propriétaire pour demander l'accès.
          </p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
            Retour au dashboard
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{academy.name}</h1>
              {academy.description && <p className="text-xs text-muted-foreground line-clamp-2">{academy.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
            <span>{files.length} ressource{files.length > 1 ? 's' : ''}</span>
            {categories.length > 0 && (
              <>
                <span>•</span>
                <span>{categories.length} catégorie{categories.length > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une ressource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Files grouped by category */}
        {filteredFiles.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune ressource trouvée</p>
          </div>
        )}

        {(() => {
          const grouped: Record<string, AcademyFile[]> = {};
          for (const f of filteredFiles) {
            const cat = f.category || 'Sans catégorie';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(f);
          }
          return Object.entries(grouped).map(([cat, list]) => (
            <div key={cat} className="space-y-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">{cat}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {list.map(f => {
                  const Icon = FILE_TYPE_ICONS[f.file_type];
                  return (
                    <div
                      key={f.id}
                      onClick={() => openPreview(f)}
                      className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-blue-500/40 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{f.file_type}{f.file_size_mb ? ` · ${f.file_size_mb} MB` : ''}</p>
                      </div>
                      {f.is_external ? (
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadFile(f); }}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                          title="Télécharger"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Preview modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => { setPreviewFile(null); setPreviewSignedUrl(null); }}>
          <div className="bg-background rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <p className="text-sm font-semibold flex-1 truncate">{previewFile.title}</p>
              <button onClick={() => downloadFile(previewFile)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-500" title="Télécharger">
                <Download className="h-4 w-4" />
              </button>
              <button onClick={() => { setPreviewFile(null); setPreviewSignedUrl(null); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center">
              {!previewSignedUrl ? (
                <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              ) : previewFile.file_type === 'video' ? (
                <video controls className="max-w-full max-h-full" src={previewSignedUrl} />
              ) : previewFile.file_type === 'image' ? (
                <img src={previewSignedUrl} alt={previewFile.title} className="max-w-full max-h-full object-contain" />
              ) : previewFile.file_type === 'pdf' ? (
                <iframe src={previewSignedUrl} className="w-full h-[70vh]" title={previewFile.title} />
              ) : (
                <div className="p-8 text-center">
                  <FileBox className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">Pas d'aperçu disponible pour ce type de fichier.</p>
                  <button onClick={() => downloadFile(previewFile)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold flex items-center gap-2 mx-auto">
                    <Download className="h-4 w-4" />
                    Télécharger
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
