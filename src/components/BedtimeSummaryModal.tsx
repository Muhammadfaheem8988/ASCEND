import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Moon } from 'lucide-react';
import { generateBedtimeSummary } from '../utils/aiEngine';
import { audio } from '../utils/audio';

interface BedtimeSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BedtimeSummaryModal = ({ isOpen, onClose }: BedtimeSummaryModalProps) => {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<'gemini' | 'local' | null>(null);
  const [fallbackReason, setFallbackReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      generateSummary();
      audio.playNotification();
    } else {
      setSummary('');
      setError('');
      setSource(null);
      setFallbackReason('');
    }
  }, [isOpen]);

  const generateSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await generateBedtimeSummary();
      setSummary(result.text);
      setSource(result.source);
      setFallbackReason(result.fallbackReason || '');
      audio.playSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-lg overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-brand/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand animate-pulse">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-200">Daily Review</h2>
              <p className="text-xs text-brand-light font-medium uppercase tracking-wider">Ascend AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 animate-pulse text-sm">Analyzing your day...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          ) : (
            <>
            {source === 'local' && <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200" role="status">Local summary · {fallbackReason}</p>}
            {source === 'gemini' && <p className="mb-4 text-xs text-slate-500">Generated with Gemini</p>}
            <div className="prose prose-invert prose-p:text-slate-300 prose-p:leading-relaxed max-w-none text-sm md:text-base">
              {summary.split('\n').map((paragraph, idx) => (
                paragraph.trim() ? <p key={idx} className="mb-4">{paragraph}</p> : null
              ))}
            </div>
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-dark-900/50 flex justify-end">
          <button onClick={onClose} className="btn-primary px-6 py-2 rounded-xl flex items-center gap-2">
            <Moon className="w-4 h-4" />
            Goodnight
          </button>
        </div>
        
      </div>
    </div>,
    document.body
  );
};

export default BedtimeSummaryModal;
