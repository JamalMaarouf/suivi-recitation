// COMPOSANT PeriodeSelectorHybride (Etape 14 v2)
// Pattern hybride : N boutons rapides + dropdown "Plus ▾" + Personnalisée
//
// Props :
//   - boutonsRapides : Array<{key, label}> - boutons toujours visibles
//   - dropdownItems : Array<{groupe, items: [{key, label}]}> - items dans dropdown
//   - allowCustom : bool - permet la selection "Personnalisée" (datepickers)
//   - periode : string - cle de la periode active
//   - setPeriode : fn - setter
//   - dateDebut, dateFin : strings YYYY-MM-DD pour mode custom
//   - setDateDebut, setDateFin : setters
//   - lang : 'fr' | 'ar'
//   - variant : 'default' (fond clair) | 'dark' (fond fonce, header)
//
// Comportement :
//   - Cliquer un bouton rapide -> setPeriode(key)
//   - Cliquer "Plus ▾" -> ouvre dropdown groupe
//   - Selectionner item dropdown -> setPeriode(key) + ferme dropdown
//   - Selectionner "Personnalisée" dans dropdown -> setPeriode('custom')
//   - Si periode='custom' : 2 datepickers apparaissent sous le selecteur
import React, { useState } from 'react';

export default function PeriodeSelectorHybride({
  boutonsRapides = [],
  dropdownItems = [],
  allowCustom = true,
  periode,
  setPeriode,
  dateDebut,
  dateFin,
  setDateDebut,
  setDateFin,
  lang = 'fr',
  variant = 'default',
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const isAr = lang === 'ar';
  const isDark = variant === 'dark';

  // Style des boutons selon le variant
  const btnStyle = (active) => isDark ? {
    background: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
    border: `1px solid ${active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}`,
    borderRadius: 20, padding: '5px 12px', color: '#fff',
    fontSize: 11, fontWeight: active ? 700 : 400,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    fontFamily: 'inherit',
  } : {
    padding: '5px 12px', borderRadius: 20,
    border: `1px solid ${active ? '#378ADD' : '#e0e0d8'}`,
    background: active ? '#E6F1FB' : '#fff',
    color: active ? '#378ADD' : '#888',
    fontSize: 11, fontWeight: active ? 700 : 400,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    fontFamily: 'inherit',
  };

  // Liste plate des items dropdown pour trouver le label de la periode active
  const allDropdownItems = dropdownItems.flatMap(g => g.items);
  const itemActifDansDropdown = allDropdownItems.find(i => i.key === periode);
  const customActif = periode === 'custom';
  const dropdownActif = !!itemActifDansDropdown || customActif;
  const labelPlus = (() => {
    if (customActif) return (isAr ? '📐 فترة محددة' : '📐 Personnalisée') + ' ▾';
    if (itemActifDansDropdown) return itemActifDansDropdown.label + ' ▾';
    return isAr ? 'المزيد ▾' : 'Plus ▾';
  })();

  return (
    <div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',position:'relative',alignItems:'center'}}>
        {/* Boutons rapides */}
        {boutonsRapides.map(p => (
          <button key={p.key} onClick={() => setPeriode(p.key)}
            style={btnStyle(periode === p.key)}>
            {p.label}
          </button>
        ))}

        {/* Bouton Plus + dropdown */}
        {(dropdownItems.length > 0 || allowCustom) && (
          <div style={{position:'relative'}}>
            <button onClick={() => setShowDropdown(s => !s)}
              style={btnStyle(dropdownActif)}>
              {labelPlus}
            </button>
            {showDropdown && (
              <>
                <div onClick={() => setShowDropdown(false)}
                  style={{position:'fixed',inset:0,zIndex:50}} />
                <div style={{
                  position:'absolute',top:'calc(100% + 4px)',
                  [isAr?'right':'left']:0,zIndex:51,
                  background:'#fff',borderRadius:10,
                  boxShadow:'0 6px 20px rgba(0,0,0,0.15)',
                  minWidth:220,maxHeight:'60vh',overflowY:'auto',padding:6,
                  border:'1px solid #e0e0d8',
                }}>
                  {dropdownItems.map(g => (
                    <div key={g.groupe} style={{marginBottom:4}}>
                      <div style={{
                        fontSize:9,fontWeight:700,color:'#888',
                        textTransform:'uppercase',padding:'4px 10px',letterSpacing:0.3,
                      }}>
                        {g.groupe}
                      </div>
                      {g.items.map(item => (
                        <button key={item.key}
                          onClick={() => { setPeriode(item.key); setShowDropdown(false); }}
                          style={{
                            display:'block',width:'100%',
                            textAlign:isAr?'right':'left',
                            padding:'8px 12px',border:'none',borderRadius:6,fontSize:12,
                            background: periode === item.key ? '#E1F5EE' : 'transparent',
                            color: periode === item.key ? '#085041' : '#333',
                            fontWeight: periode === item.key ? 700 : 500,
                            cursor:'pointer',fontFamily:'inherit',
                          }}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                  {/* Personnalisée en dernier */}
                  {allowCustom && (
                    <div style={{marginTop:4,paddingTop:6,borderTop:'1px solid #f0f0ec'}}>
                      <button onClick={() => { setPeriode('custom'); setShowDropdown(false); }}
                        style={{
                          display:'block',width:'100%',
                          textAlign:isAr?'right':'left',
                          padding:'8px 12px',border:'none',borderRadius:6,fontSize:12,
                          background: customActif ? '#EEEDFE' : 'transparent',
                          color: customActif ? '#534AB7' : '#333',
                          fontWeight: customActif ? 700 : 500,
                          cursor:'pointer',fontFamily:'inherit',
                        }}>
                        📐 {isAr?'فترة محددة...':'Personnalisée...'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Datepickers Personnalisée (apparaissent en dessous si actif) */}
      {customActif && (
        <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <label style={{fontSize:11,color:isDark?'rgba(255,255,255,0.8)':'#666',fontWeight:600}}>
              {isAr?'من':'Du'}
            </label>
            <input type="date" value={dateDebut || ''} onChange={e => setDateDebut?.(e.target.value)}
              style={{padding:'5px 8px',borderRadius:6,border:'1px solid #d0d8e8',fontSize:11,fontFamily:'inherit'}}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <label style={{fontSize:11,color:isDark?'rgba(255,255,255,0.8)':'#666',fontWeight:600}}>
              {isAr?'إلى':'Au'}
            </label>
            <input type="date" value={dateFin || ''} onChange={e => setDateFin?.(e.target.value)}
              style={{padding:'5px 8px',borderRadius:6,border:'1px solid #d0d8e8',fontSize:11,fontFamily:'inherit'}}/>
          </div>
        </div>
      )}
    </div>
  );
}
