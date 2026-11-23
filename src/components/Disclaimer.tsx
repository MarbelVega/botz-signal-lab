export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-center text-xs text-slate-500">
        Simulador educativo / PoC con fines analíticos. No ejecuta operaciones, no es asesoría financiera ni recomendación de inversión.
        Operar opciones binarias, Forex o mercados OTC conlleva alto riesgo de pérdida total del capital.
      </p>
    );
  }
  return (
    <div role="note" className="border-b border-amber-700/50 bg-amber-950/70 px-4 py-2 text-center text-xs text-amber-200 sm:text-sm">
      <strong className="font-semibold">⚠ Disclaimer:</strong> simulador educativo / Proof of Concept con fines analíticos, con datos
      simulados o públicos. <strong>No ejecuta operaciones reales</strong> ni constituye asesoría financiera. Operar instrumentos financieros y
      mercados OTC conlleva <strong>alto riesgo</strong>; los esquemas de ciclos (Gale / martingala) aumentan la exposición y pueden
      provocar pérdidas rápidas.
    </div>
  );
}
