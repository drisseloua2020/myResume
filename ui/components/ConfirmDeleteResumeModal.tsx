import React from 'react';

interface ConfirmDeleteResumeModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Confirmation modal styled to match ConfirmNewResumeModal.
 */
const ConfirmDeleteResumeModal: React.FC<ConfirmDeleteResumeModalProps> = ({ onConfirm, onCancel, loading }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!loading) onCancel();
        }}
      ></div>

      <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-[#2e3d50] text-white px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-lg">Confirm</div>
          <button
            onClick={() => {
              if (!loading) onCancel();
            }}
            className="text-white/80 hover:text-white transition"
            aria-label="Close"
            type="button"
            disabled={!!loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="text-slate-700 text-base leading-relaxed">
            Delete this saved resume? This action can&apos;t be undone.
          </p>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={!!loading}
              className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              No
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!!loading}
              className="px-5 py-2.5 rounded-lg bg-[#1a91f0] text-white font-bold hover:bg-[#1170cd] shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Deleting…' : 'YES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteResumeModal;
