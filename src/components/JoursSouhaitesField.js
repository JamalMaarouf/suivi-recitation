import React from 'react';

// ─── Composant : zone "Jours souhaités" (feature Assiduité) ───
// Utilisé dans les 3 variantes du formulaire élève (mobile, desktop création, desktop modification).
// Ordre des jours : Sam → Ven (semaine scolaire marocaine).
export default function JoursSouhaitesField({ value, onChange, lang }) {
  const joursLabels = lang === 'ar'
    ? ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
    : ['Sam', 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const jours = Array.isArray(value) ? value : [false, false, false, false, false, false, false];
  const toggleJour = (idx) => {
    const next = [...jours];
    next[idx] = !next[idx];
    onChange(next);
  };
  return (
    <div style={{ marginBottom: 12, padding: '12px', background: '#E1F5EE', borderRadius: 10, border: '1px solid #1D9E7540' }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#085041', display: 'block', marginBottom: 8 }}>
        {lang === 'ar' ? '📅 أيام الحضور المرغوبة' : '📅 Jours de présence souhaités'}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {joursLabels.map((label, idx) => {
          const actif = !!jours[idx];
          return (
            <button key={idx} type="button"
              onClick={() => toggleJour(idx)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: actif ? '2px solid #1D9E75' : '1px solid #c0c0b8',
                background: actif ? '#1D9E75' : '#fff',
                color: actif ? '#fff' : '#666',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flex: '1 1 auto',
                minWidth: 56,
              }}>
              {label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
        {lang === 'ar'
          ? 'اختر الأيام التي يحضر فيها الطالب. تُستعمل لحساب الغياب.'
          : 'Sélectionne les jours où l\'élève vient. Utilisé pour calculer les absences.'}
      </div>
    </div>
  );
}
