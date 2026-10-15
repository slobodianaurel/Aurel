import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  affectedDetails?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  affectedDetails = [],
  confirmLabel = 'Підтвердити операцію',
  cancelLabel = 'Скасувати',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 shadow-lg">
        <h3 id="confirm-modal-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>

        {affectedDetails.length > 0 && (
          <div className="mt-4 border-t border-b border-slate-200 py-3 space-y-1.5">
            <div className="text-xs font-semibold text-slate-700">
              Обсяг змін у Google Sheets:
            </div>
            <ul className="text-xs text-slate-600 space-y-1 font-mono-tabular">
              {affectedDetails.map((item, idx) => (
                <li key={idx}>· {item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-md transition-colors whitespace-nowrap disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-[#DC2626] hover:bg-red-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {isLoading ? 'Виконується...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
