export default function AdminPlaceholder({ title, section, copy, phase, slug }) {
  const testSlug = slug || title.replace(/\s+/g, "-").toLowerCase();
  return (
    <div
      data-testid={`admin-placeholder-${testSlug}`}
      className="mx-auto max-w-2xl"
    >
      <div className="rounded-[24px] border-2 border-dashed border-[#1A1A1A]/15 bg-white p-10 md:p-14 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8A8588]">
          Section {section}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-[#1A1A1A]/70 leading-relaxed">{copy}</p>
        <span className="mt-6 inline-block rounded-pill bg-[#FF6B35]/12 px-4 py-1.5 text-xs font-bold text-[#FF6B35] uppercase tracking-widest">
          {phase}
        </span>
      </div>
    </div>
  );
}
