import React, { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { Button } from './ui/button';
import { getAuth, applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';

const funMessages = {
  verifyEmail: {
    title: "Email Verified! 🎉",
    message: "You did it! Your email is now verified. Welcome to the club!",
    cta: "Go to App"
  },
  passwordReset: {
    title: "Reset Your Password 🔑",
    message: "Ready for a fresh start? Enter your new password below. Make it strong, like your coffee! ☕️",
    cta: "Reset Password"
  },
  passwordResetSuccess: {
    title: "Password Changed! 🚀",
    message: "Your password is now as fresh as your budgeting skills. Time to conquer those expenses!",
    cta: "Go to Login"
  },
  error: {
    title: "Oops! 😅",
    message: "Something went wrong. Try again or contact support. Even the best apps have a bad day!",
    cta: "Go Home"
  }
};

export default function AuthAction() {
  const [mode, setMode] = useState('');
  const [oobCode, setOobCode] = useState('');
  const [step, setStep] = useState('loading');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get('mode'));
    setOobCode(params.get('oobCode'));
  }, []);

  useEffect(() => {
    if (!mode || !oobCode) return;
    const auth = getAuth();

    if (mode === 'verifyEmail') {
      applyActionCode(auth, oobCode)
        .then(() => setStep('verifyEmail'))
        .catch(() => setStep('error'));
    } else if (mode === 'resetPassword') {
      verifyPasswordResetCode(auth, oobCode)
        .then(() => setStep('passwordReset'))
        .catch(() => setStep('error'));
    }
  }, [mode, oobCode]);

  const handlePasswordReset = async () => {
    const auth = getAuth();
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStep('passwordResetSuccess');
    } catch {
      setError("Couldn't reset password. Try again!");
    }
  };

  // Choose message
  const msg = funMessages[step] || funMessages.error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-700 relative overflow-hidden">
      <Confetti width={window.innerWidth} height={window.innerHeight} numberOfPieces={step === 'verifyEmail' || step === 'passwordResetSuccess' ? 400 : 0} recycle={false} />
      {/* Animated floating shapes */}
      <div className="absolute top-0 left-0 w-full h-32 pointer-events-none z-0">
        <svg width="100%" height="100%" viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#38bdf8" fillOpacity="0.18" d="M0,160L60,170.7C120,181,240,203,360,197.3C480,192,600,160,720,133.3C840,107,960,85,1080,101.3C1200,117,1320,171,1380,197.3L1440,224L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"></path>
        </svg>
      </div>
      <img src="/logo.png" alt="ExpenseApp Logo" className="w-20 mb-6 z-10 drop-shadow-xl animate-bounce-slow" />
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center max-w-md w-full z-10 border border-blue-400/20 animate-fade-in-up">
        <h1 className="text-3xl font-extrabold text-blue-200 mb-2 text-center drop-shadow-lg">{msg.title}</h1>
        <p className="text-lg text-blue-100 mb-6 text-center max-w-xs">{msg.message}</p>
        {step === 'passwordReset' && (
          <div className="flex flex-col items-center gap-4 mb-4 w-full">
            <input
              type="password"
              placeholder="New password"
              className="px-4 py-3 rounded-xl border border-blue-300 bg-slate-900/60 text-white w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-inner"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <Button
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-lg px-8 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform"
              onClick={handlePasswordReset}
            >
              {msg.cta}
            </Button>
            {error && <div className="text-red-400 text-center w-full">{error}</div>}
          </div>
        )}
        {step !== 'passwordReset' && (
          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-lg px-8 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform"
            onClick={() => window.location.href = '/app'}
          >
            {msg.cta}
          </Button>
        )}
      </div>
      {/* Footer fun message */}
      <div className="mt-10 text-blue-200/70 text-sm text-center z-10 animate-fade-in-up">
        <span role="img" aria-label="party">🎊</span> ExpenseApp: Making money management less boring, one confetti at a time!
      </div>
    </div>
  );
} 