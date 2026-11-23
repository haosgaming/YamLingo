import { useEffect } from 'react';
import { Code2, Compass, Keyboard, X } from 'lucide-react';

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  id: string;
  title: string;
  icon: 'nav' | 'editor';
  items: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'navigation',
    title: 'Navigace & Prostředí',
    icon: 'nav',
    items: [
      { keys: ['?'], description: 'Otevřít / zavřít přehled zkratek' },
      { keys: ['1'], description: 'Přejít na Mapu výuky' },
      { keys: ['2'], description: 'Přejít na Aktivní misi' },
      { keys: ['3'], description: 'Otevřít YAML Doctor' },
      { keys: ['4'], description: 'Otevřít Obchod (Volty & Témata)' },
      { keys: ['Z'], description: 'Zapnout / vypnout režim Soustředění' },
      { keys: ['M'], description: 'Zapnout / ztlumit zvuky' },
      { keys: ['P'], description: 'Pozastavit / obnovit hru' },
      { keys: ['Esc'], description: 'Zavřít okno nebo otevřít pauzu' },
      { keys: ['Enter'], description: 'Spustit výuku (na úvodní obrazovce)' },
    ],
  },
  {
    id: 'editor',
    title: 'YAML Editor & Mise',
    icon: 'editor',
    items: [
      { keys: ['Tab'], description: 'Odsadit řádek o 2 mezery' },
      { keys: ['Shift', 'Tab'], description: 'Zmenšit odsazení o 2 mezery' },
      { keys: ['Enter'], description: 'Nový řádek (auto-odsazení po :)' },
      { keys: ['Ctrl / ⌘', '/'], description: 'Zakomentovat / odkomentovat řádek (#)' },
      { keys: ['Ctrl / ⌘', 'Shift', 'F'], description: 'Rychle opravit odsazení a dvojtečky' },
      { keys: ['Ctrl / ⌘', 'Enter'], description: 'Zkontrolovat kód aktivní mise' },
      { keys: ['Ctrl / ⌘', 'Z'], description: 'Vrátit poslední úpravu (Zpět)' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-strong)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 border-b px-5 py-4"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg border"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--border-strong)',
                color: 'var(--accent)',
              }}
            >
              <Keyboard className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="font-display text-lg font-bold leading-tight">
                Klávesové zkratky
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Keyboard Shortcuts — rychlá navigace a příkazy YAML editoru
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít klávesové zkratky"
            className="rounded-lg border p-1.5 transition-colors hover:opacity-80"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-secondary)',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Two-column Cheat Sheet Body */}
        <div className="grid max-h-[75vh] gap-5 overflow-y-auto p-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.id} className="space-y-3">
              <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                {group.icon === 'nav' ? (
                  <Compass className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                ) : (
                  <Code2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
                )}
                <h3 className="font-display text-sm font-bold">{group.title}</h3>
              </div>

              <ul className="space-y-2">
                {group.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{item.description}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((keyLabel, kIdx) => (
                        <span key={kIdx} className="flex items-center gap-1">
                          {kIdx > 0 && (
                            <span style={{ color: 'var(--text-muted)' }}>+</span>
                          )}
                          <kbd
                            className="inline-flex min-w-[24px] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              borderColor: 'var(--border-strong)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {keyLabel}
                          </kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t px-5 py-3 text-xs"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <span>Zkratky s jedním písmenem (1–4, Z, M, P, ?) fungují mimo textová pole.</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
          >
            Rozumím
          </button>
        </div>
      </div>
    </div>
  );
}
