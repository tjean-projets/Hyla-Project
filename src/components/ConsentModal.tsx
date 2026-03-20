import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';

interface ConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConsentModal({ open, onOpenChange, onConfirm, isLoading }: ConsentModalProps) {
  const [consented, setConsented] = useState(false);

  const handleConfirm = () => {
    if (consented) {
      onConfirm();
      setConsented(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConsented(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Consentement du prospect</DialogTitle>
          <DialogDescription className="text-center">
            Confirmation obligatoire avant l'envoi du lead
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            Le prospect accepte d'être rappelé par Hyla dans le cadre d'une 
            proposition d'assurance emprunteur.
          </p>
        </div>

        <div className="flex items-start space-x-3">
          <Checkbox
            id="consent"
            checked={consented}
            onCheckedChange={(checked) => setConsented(checked === true)}
          />
          <Label
            htmlFor="consent"
            className="text-sm leading-relaxed cursor-pointer"
          >
            Je confirme avoir obtenu l'accord explicite du prospect pour être recontacté.
          </Label>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!consented || isLoading}
          >
            {isLoading ? 'Envoi...' : 'Valider et envoyer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
