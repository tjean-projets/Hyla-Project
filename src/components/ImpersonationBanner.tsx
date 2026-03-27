import { X, Eye } from 'lucide-react';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useNavigate } from 'react-router-dom';

export function ImpersonationBanner() {
  const { isImpersonating, partnerName, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const handleStop = () => {
    stopImpersonation();
    navigate('/admin');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
      <div className="flex items-center justify-center gap-3 h-10 px-4 text-xs font-medium">
        <Eye className="h-3.5 w-3.5" />
        <span>Vue du compte de <strong className="text-sm">{partnerName}</strong></span>
        <button
          onClick={handleStop}
          className="ml-2 h-6 px-3 rounded-full bg-white/20 hover:bg-white/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
        >
          <X className="h-3 w-3" />
          Revenir admin
        </button>
      </div>
    </div>
  );
}
