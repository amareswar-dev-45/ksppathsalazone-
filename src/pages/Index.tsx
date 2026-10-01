import { useNavigate } from "react-router-dom";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.jpeg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <img src={logo} alt="KSP Pathsala Logo" className="absolute top-4 left-4 w-16 h-16 rounded-full object-cover shadow-lg" />
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          KSP Pathsala - Rank Booster Test
        </div>
        <h1 className="text-4xl md:text-6xl font-heading font-bold text-foreground mb-4">
          Rank Booster
          <span className="gradient-text block">Test</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Unlock your potential. Conquer your dreams.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg animate-fade-in">
        <button
          onClick={() => navigate("/student")}
          className="flex-1 group glass-card rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="font-heading font-semibold text-xl text-foreground mb-2">Student</h2>
          <p className="text-muted-foreground text-sm">Take a test & view results</p>
        </button>

        <button
          onClick={() => navigate("/admin/login")}
          className="flex-1 group glass-card rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-8 h-8 text-accent-foreground" />
          </div>
          <h2 className="font-heading font-semibold text-xl text-foreground mb-2">Admin</h2>
          <p className="text-muted-foreground text-sm">Manage questions & view responses</p>
        </button>
      </div>
    </div>
  );
};

export default Index;
