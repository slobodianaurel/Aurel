import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (icon: string) => void;
  onSelectIcon?: (icon: string) => void;
  currentIcon?: string;
  title?: string;
}

const ICON_GROUPS = [
  {
    name: 'Дім та побут',
    icons: ['🏠', '🔑', '⚡', '💧', '🌐', '🛋️', '🛏️', '🧹', '🧼', '🪴', '📦', '🔨', '🔧'],
  },
  {
    name: 'Продукти та їжа',
    icons: ['🛒', '🍞', '🥩', '🥦', '🍎', '🍕', '🍔', '☕', '🥐', '🍷', '🍫', '🍿', '🍱', '🍽️'],
  },
  {
    name: 'Транспорт та авто',
    icons: ['🚗', '⛽', '🚌', '🚇', '🅿️', '🚕', '🚲', '✈️', '🚆', '🎫', '🛵', '⚓'],
  },
  {
    name: 'Робота, бізнес та дохід',
    icons: ['💼', '💻', '📱', '⏱️', '💵', '🏦', '🎁', '📑', '💡', '🕒', '📈', '🪙', '💰', '✨'],
  },
  {
    name: 'Здоровʼя та спорт',
    icons: ['🏋️', '💪', '💊', '🩺', '🧘', '🏃', '🦷', '🧴', '💇', '🧖', '👓', '🚑'],
  },
  {
    name: 'Покупки та розваги',
    icons: ['🛍️', '👕', '👗', '🎮', '🎟️', '⚽', '📚', '🎨', '🎵', '🎬', '🏖️', '⛺', '🐾'],
  },
  {
    name: 'Символи та статус',
    icons: ['⭐', '❤️', '🎯', '🚀', '🔔', '💎', '🤝', '🎀', '🏷️', '📄', '🔒', '📌'],
  },
];

export const IconPickerModal: React.FC<IconPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onSelectIcon,
  currentIcon = '🏷️',
  title = 'Оберіть значок',
}) => {
  const [customEmoji, setCustomEmoji] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  const chooseIcon = (icon: string) => {
    if (onSelect) onSelect(icon);
    if (onSelectIcon) onSelectIcon(icon);
    onClose();
  };

  if (!isOpen) return null;

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customEmoji.trim()) {
      chooseIcon(customEmoji.trim());
      setCustomEmoji('');
    }
  };

  const filteredGroups = ICON_GROUPS.map((g) => ({
    ...g,
    icons: filterQuery
      ? g.icons.filter(() => g.name.toLowerCase().includes(filterQuery.toLowerCase()))
      : g.icons,
  })).filter((g) => g.icons.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentIcon || '🏷️'}</span>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Custom Input */}
        <div className="p-3 border-b border-slate-100 bg-white">
          <form onSubmit={handleApplyCustom} className="flex gap-2">
            <input
              type="text"
              placeholder="Або введіть будь-який емодзі..."
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-slate-900 focus:outline-hidden"
              maxLength={4}
            />
            <button
              type="submit"
              disabled={!customEmoji.trim()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Застосувати
            </button>
          </form>
        </div>

        {/* Emoji Grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredGroups.map((group) => (
            <div key={group.name} className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                {group.name}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {group.icons.map((emoji) => {
                  const isSelected = emoji === currentIcon;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => chooseIcon(emoji)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all ${
                        isSelected
                          ? 'bg-blue-100 border-2 border-blue-600 shadow-xs scale-105'
                          : 'hover:bg-slate-100 hover:scale-110 active:scale-95'
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
          <span>Поточний: {currentIcon || 'не встановлено'}</span>
          <button
            type="button"
            onClick={() => chooseIcon('')}
            className="text-xs text-red-600 hover:underline font-medium"
          >
            Скинути значок
          </button>
        </div>
      </div>
    </div>
  );
};
