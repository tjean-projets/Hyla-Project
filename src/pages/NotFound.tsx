import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
      <div className="text-center animate-fade-in">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Cette page n'existe pas
        </p>
        <Link to="/">
          <Button>
            <Home className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
