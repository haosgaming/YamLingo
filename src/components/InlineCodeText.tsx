export function InlineCodeText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code
              key={i}
              className="rounded px-1 py-0.5 font-mono text-[0.9em] font-semibold"
              style={{
                backgroundColor: 'var(--bg-editor)',
                color: 'var(--accent)',
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
