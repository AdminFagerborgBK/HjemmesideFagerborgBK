/**
 * Simple markdown-like content renderer for site_pages content.
 * Supports ## headings, paragraphs, and **bold** text.
 */

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

const MarkdownContent = ({ content, className }: MarkdownContentProps) => {
  if (!content) return null;

  const lines = content.split('\n');
  const sections: { heading: string; paragraphs: string[] }[] = [];
  let currentSection: { heading: string; paragraphs: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: trimmed.replace(/^## /, ''), paragraphs: [] };
    } else if (trimmed && currentSection) {
      currentSection.paragraphs.push(trimmed);
    } else if (trimmed && !currentSection) {
      currentSection = { heading: '', paragraphs: [trimmed] };
    }
  }
  if (currentSection) sections.push(currentSection);

  return (
    <div className={`space-y-8 ${className || ''}`}>
      {sections.map((section, i) => (
        <div key={i} className="bg-card rounded-xl p-6 shadow-card">
          {section.heading && (
            <h3 className="text-xl font-bold text-primary mb-3">{section.heading}</h3>
          )}
          {section.paragraphs.map((p, j) => (
            <p key={j} className="text-muted-foreground leading-relaxed mt-3 first:mt-0">
              {renderInlineFormatting(p)}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MarkdownContent;
