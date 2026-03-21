import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { BackgroundBlobs } from '@/components/BackgroundBlobs';
import { Mail, Lock, Loader2 } from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';
import { toast } from 'sonner';

export default function Auth() {
  const { user, role, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && role) {
    return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);

    setSubmitting(false);

    if (error) {
      toast.error(error.message);
    } else if (!isLogin) {
      toast.success('Account created successfully! You are now logged in.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-4">
      <BackgroundBlobs />
      <div className="glass-card-glow w-full max-w-md p-8 animate-scale-in relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 rounded-xl btn-primary-gradient mb-4">
            <Music className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">MusicDist</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLogin ? 'Sign in to your account' : 'Create your artist account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-11 pr-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg btn-primary-gradient text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLogin ? 'Sign In' : 'Create Artist Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? 'Sign Up as Artist' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
