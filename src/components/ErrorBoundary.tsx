import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Quand la key change, l'ErrorBoundary se réinitialise automatiquement */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Erreur inconnue' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // Chunk introuvable après un nouveau déploiement Vercel → rechargement forcé
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.name === 'ChunkLoadError';
    if (isChunkError) {
      window.location.reload();
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Réinitialise quand la route change (resetKey = location.pathname)
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Une erreur est survenue</h2>
            <p className="text-sm text-muted-foreground mt-1">{this.state.message}</p>
          </div>
          <Button onClick={this.reset} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }
}
