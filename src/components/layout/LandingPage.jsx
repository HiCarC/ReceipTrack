import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const HEADER_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDRPd01Kx8qrFHqb0WwatDu0YAHHfIL88c43pfyiTkXL22qCpJ81ZOc8HE_cJpfryXA-rcKk64Jd06RMG7F517ZnXXDtVHFSXjt4nZXWohU2T6vYPrDkCKBYI5ILLjW2gZuxpwmS8Te7ybASq6fYT6kXIr6sAZNyJnku2VvEUtXjpjrKx9ZtlF2IJrxypwtxOsHzdok-M5Kqrk8wyBJG0cyx-T-1BYwrlPoe1XdNifqK5v8ImvYOe0TIyoPfPljFOewJHOf7spMLcgm";

export default function LandingPage({ className }) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordReset } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      toast({
        title: 'Missing details',
        description: 'Please enter your email and password.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error) {
      toast({
        title: 'Sign in failed',
        description: error?.message || 'Please check your details and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: 'Enter your email',
        description: 'Type your email address first to reset your password.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await sendPasswordReset(email);
      toast({
        title: 'Reset email sent',
        description: 'Check your inbox for the reset link.',
      });
    } catch (error) {
      toast({
        title: 'Reset failed',
        description: error?.message || 'Unable to send reset email.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={`relative flex min-h-screen w-full flex-col overflow-x-hidden bg-app-bg text-app-fg ${className}`}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8">
        <div className="pt-6">
          <div
            className="relative min-h-[160px] w-full overflow-hidden rounded-2xl bg-cover bg-center shadow-lg"
            style={{ backgroundImage: `url('${HEADER_IMAGE}')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#101622]/95 via-[#101622]/30 to-transparent" />
            <div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-white/10 p-2 backdrop-blur-md">
              <Wallet className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="flex flex-col px-1 pt-5 pb-3">
          <h1 className="text-[32px] font-extrabold tracking-tight text-white">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="pt-2 text-base text-app-muted">
            {isSignUp ? 'Start tracking your expenses in minutes.' : 'Please enter your details to sign in.'}
          </p>
        </div>

        <form className="flex flex-col gap-4 px-1 py-2" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white">Email address</span>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 h-5 w-5 text-app-muted" />
              <input
                className="h-14 w-full rounded-2xl border border-transparent bg-app-surface px-12 text-base text-white placeholder:text-app-muted shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-app-primary/50"
                placeholder="john@example.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white">Password</span>
            <div className="relative flex items-center rounded-2xl border border-transparent bg-app-surface shadow-sm focus-within:ring-2 focus-within:ring-app-primary/50">
              <Lock className="absolute left-4 h-5 w-5 text-app-muted" />
              <input
                className="h-14 w-full rounded-2xl bg-transparent px-12 pr-12 text-base text-white placeholder:text-app-muted focus:outline-none"
                placeholder="Enter your password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="absolute right-4 text-app-muted transition-colors hover:text-app-primary"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>

          {!isSignUp && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                className="text-sm font-medium text-app-primary hover:text-blue-400"
                onClick={handlePasswordReset}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="mt-2 h-14 w-full rounded-2xl bg-app-primary text-base font-bold text-white shadow-lg shadow-blue-900/40 transition-transform active:scale-[0.98] disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Working...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-slate-800" />
            <span className="mx-4 text-sm font-medium text-slate-500">Or continue with</span>
            <div className="flex-grow border-t border-slate-800" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-app-surface text-sm font-semibold text-white transition-colors hover:bg-[#232b3a]"
            >
              <img src="/google-icon.svg" alt="Google" className="h-5 w-5" />
              Google
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-app-surface text-sm font-semibold text-slate-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.47-1.09-.42-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.47C2.7 15.25 3.66 7.59 11.1 7.5c1.95 0 3.09 1.18 4.04 1.18.96 0 2.62-1.18 4.43-1.07 1.54.09 2.92.83 3.93 2.31-3.56 2.07-2.91 6.51.68 8.08-.66 1.48-1.57 3-2.67 4.54-.53.79-1.25 1.57-1.92 1.95-1.18.7-2.05-.28-2.54-.2zm-3.14-16c.3 2.14-1.46 4.2-3.3 4.41-.33-2.15 1.63-4.22 3.3-4.41z" />
              </svg>
              Apple
            </button>
          </div>
        </form>

        <div className="mt-auto pt-6">
          <p className="text-center text-base text-app-muted">
            {isSignUp ? 'Already have an account?' : 'New to ExpenseApp?'}{' '}
            <button
              type="button"
              className="font-bold text-app-primary hover:text-blue-400"
              onClick={() => setIsSignUp((prev) => !prev)}
            >
              {isSignUp ? 'Sign in' : 'Create account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
