/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Lock, Delete, Play, ShieldAlert, KeyRound, HelpCircle, Eye, EyeOff } from 'lucide-react';

interface LockScreenProps {
  correctPasscode: string;
  onUnlock: () => void;
  onReset: () => void;
}

export default function LockScreen({ correctPasscode, onUnlock, onReset }: LockScreenProps) {
  const [inputVal, setInputVal] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [shaking, setShaking] = useState(false);
  const [showPasscodeText, setShowPasscodeText] = useState(false);

  // Keyboard integration for desktop users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Clear errors on any keypress
      setErrorMsg('');

      if (e.key >= '0' && e.key <= '9') {
        if (inputVal.length < 12) {
          setInputVal(prev => prev + e.key);
        }
      } else if (e.key === 'Backspace') {
        setInputVal(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        handleConfirmUnlock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputVal, correctPasscode]);

  const handleKeyPress = (char: string) => {
    setErrorMsg('');
    if (inputVal.length < 12) {
      setInputVal(prev => prev + char);
    }
  };

  const handleBackspace = () => {
    setErrorMsg('');
    setInputVal(prev => prev.slice(0, -1));
  };

  const handleConfirmUnlock = () => {
    if (inputVal === correctPasscode) {
      onUnlock();
    } else {
      setShaking(true);
      setErrorMsg('Pincode o Clave de acceso incorrecta. Inténtalo de nuevo.');
      setInputVal('');
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col justify-between p-6 select-none font-sans relative overflow-hidden">
      {/* Background radial overlays */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-12 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Info */}
      <div className="w-full max-w-sm mx-auto text-center pt-8 z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-semibold mb-6">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
          GitHub Pages & Control Local
        </div>
        
        <h1 className="text-xl font-black tracking-tight text-white font-sans bg-clip-text">
          FINANZAS PROYECTADAS
        </h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">
          Acceso Protegido
        </p>
      </div>

      {/* Keypad & Input Area */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center py-6 z-10">
        {/* Lock Animation Node */}
        <div className={`mb-6 p-4 rounded-3xl bg-slate-900/80 border border-slate-800 text-cyan-400 shadow-xl transition-transform duration-300 ${shaking ? 'animate-bounce text-rose-500 border-rose-900' : 'hover:scale-105'}`}>
          <Lock size={32} className={shaking ? 'animate-pulse' : ''} />
        </div>

        {/* Masked PIN Dot Indicator */}
        <div className="w-full text-center mb-6">
          <div className="flex justify-center items-center gap-2.5 h-10 mb-2">
            {inputVal.length === 0 ? (
              <span className="text-xs font-semibold text-slate-500">Introduce tu clave de acceso...</span>
            ) : showPasscodeText ? (
              <span className="text-xl font-bold tracking-wider font-mono text-cyan-300">{inputVal}</span>
            ) : (
              <div className="flex items-center gap-2">
                {Array.from({ length: inputVal.length }).map((_, i) => (
                  <span key={i} className="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)] animate-in scale-in duration-100" />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 text-xs">
            {inputVal.length > 0 && (
              <button
                onClick={() => setShowPasscodeText(!showPasscodeText)}
                className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                {showPasscodeText ? <EyeOff size={11} /> : <Eye size={11} />}
                <span>{showPasscodeText ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            )}
          </div>
          
          {errorMsg && (
            <p className="text-xs font-bold text-rose-500 mt-2 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-900/40 inline-block animate-in fade-in slide-in-from-top-1 duration-250">
              ⚠️ {errorMsg}
            </p>
          )}
        </div>

        {/* Grid of Keypad Keys */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="h-14 rounded-2xl bg-slate-900/60 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 active:scale-95 text-xl font-bold text-slate-200 transition-all cursor-pointer flex items-center justify-center shadow-sm"
            >
              {num}
            </button>
          ))}

          {/* Action Delete/Backspace */}
          <button
            onClick={handleBackspace}
            title="Borrar dígito"
            className="h-14 rounded-2xl bg-slate-900/30 hover:bg-slate-850/60 border border-transparent hover:border-slate-800 active:scale-95 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
          >
            <Delete size={20} />
          </button>

          {/* Key 0 */}
          <button
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-slate-900/60 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 active:scale-95 text-xl font-bold text-slate-200 transition-all cursor-pointer flex items-center justify-center shadow-sm"
          >
            0
          </button>

          {/* Action Confirm/Unlock */}
          <button
            onClick={handleConfirmUnlock}
            title="Confirmar Clave"
            className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-700 hover:border-emerald-500 text-white active:scale-95 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
          >
            <Play size={18} fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Footer Info & Privacy Safeguard Clarification */}
      <div className="w-full max-w-md mx-auto text-center pb-4 z-10 px-2">
        <div className="bg-slate-900/50 border border-slate-850/80 rounded-2xl p-4 mb-5 text-left text-[10.5px] leading-relaxed text-slate-400">
          <h4 className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 mb-1 text-xs">
            🔒 Seguridad y Privacidad Garantizada
          </h4>
          <p>
            Tus presupuestos, deudas, transacciones y perfiles de finanzas se guardan <strong>exclusivamente en el dispositivo actual</strong> a través del almacenamiento web de tu navegador (<code className="bg-slate-950 px-1 py-0.5 rounded text-slate-300 font-mono text-[9.5px]">localStorage</code>). 
          </p>
          <p className="mt-1.5">
            Dado que la aplicación se ejecuta como un sitio estático estricto (en GitHub Pages), <strong>ningún dato es transmitido</strong> a servidores externos ni puede ser consultado por otras personas, manteniendo tu privacidad al 100%.
          </p>
        </div>

        <div className="flex items-center justify-center gap-6 text-[11px] font-bold">
          <button
            onClick={onReset}
            className="text-slate-550 hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer underline underline-offset-4"
          >
            <ShieldAlert size={12} />
            <span>¿Olvidaste tu PIN? Restablecer App</span>
          </button>
        </div>
      </div>
    </div>
  );
}
