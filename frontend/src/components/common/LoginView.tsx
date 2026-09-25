import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/authService';
import { RxLogo } from './RxLogo';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [secret, setSecret] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) {
      setErrorMsg('Access key is required');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const res = await authService.login(secret.trim());
    setIsLoading(false);

    if (res.success) {
      onLoginSuccess();
    } else {
      setErrorMsg(res.error || 'Invalid access key. Please try again.');
      setSecret('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#090a0f] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Standard Industry Auth Card */}
      <div className="w-full max-w-sm space-y-6">
        
        {/* Brand & Title */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <RxLogo size={40} className="w-10 h-10 rounded-xl shrink-0 shadow-sm" />
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Sign in to RopeTX
            </h1>
            <p className="text-xs text-zinc-400">
              Enter operator access key to open console
            </p>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-[#111218] border border-white/[0.08] rounded-2xl p-6 sm:p-7 space-y-4 shadow-2xl shadow-black/80">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-token-input"
                className="text-xs font-medium text-zinc-300 block"
              >
                Access Key
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="admin-token-input"
                  type={showPassword ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full bg-[#0a0b0e] border border-white/[0.1] pl-3.5 pr-10 py-2.5 text-white text-sm outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all rounded-xl placeholder:text-zinc-600 font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
                  title={showPassword ? 'Hide access key' : 'Show access key'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="px-3 py-2 bg-red-950/40 border border-red-900/50 text-red-300 text-xs rounded-xl flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !secret.trim()}
              className="w-full py-2.5 px-4 bg-white hover:bg-zinc-200 active:scale-[0.98] text-black font-semibold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </span>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Test Key Quick-Fill Helper */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-400">
            <span>Test Access Key:</span>
            <button
              type="button"
              onClick={() => {
                setSecret('AdminSecret2026');
                setErrorMsg(null);
              }}
              className="font-mono text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]"
              title="Click to fill test access key"
            >
              AdminSecret2026
            </button>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="text-center">
          <a
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-block"
          >
            ← Back to live stream
          </a>
        </div>

      </div>
    </div>
  );
};
