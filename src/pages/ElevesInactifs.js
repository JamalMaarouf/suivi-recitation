import React, { useState, useEffect } from 'react';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, joursDepuis, isInactif, getSensForEleve} from '../lib/helpers';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';

// Couleurs niveaux — fallback sur des valeurs par défaut si niveaux pas encore chargés
const NIVEAU_COLORS_FALLBACK = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };
const getNiveauColor = (code, niveaux) => {
  if (niveaux && niveaux.length > 0) return niveaux.find(n=>n.code===code)?.couleur || '#888';
  return NIVEAU_COLORS_FALLBACK[code] || '#888';
};

export default function ElevesInactifs({ navigate, goBack, lang='fr', user, isMobile  }) {
  const { toast } = useToast();
  const [inactifs, setInactifs] = useState([]);
  const [niveaux,  setNiveaux]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id).order('nom'),
        supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
        fetchAll(supabase.from('validations').select('eleve_id,date_validation,nombre_tomon,type_validation,hizb_valide').eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false})).then(data=>({data})),
        supabase.from('niveaux').select('id,code,couleur,sens_recitation').eq('ecole_id', user.ecole_id),
        supabase.from('ecoles').select('sens_recitation_defaut').eq('id', user.ecole_id).maybeSingle(),
      ]);
      const ed = results[0]?.data;
      const id = results[1]?.data;
      const vd = results[2]?.data;
      const nv = results[3]?.data;
      const ec = results[4]?.data;
      const elevesData = (ed||[]).map(eleve => {
        const vals = (vd||[]).filter(v=>v.eleve_id===eleve.id);
        const sensE = getSensForEleve(eleve, nv, ec);
        const etat = calcEtatEleve(vals, eleve.hizb_depart, eleve.tomon_depart, sensE);
        const derniere = vals[0]?.date_validation || null;
        const inst = (id||[]).find(i=>i.id===eleve.instituteur_referent_id);
        const jours = joursDepuis(derniere);
        const inactif = isInactif(derniere);
        return { ...eleve, etat, derniere, jours, inactif, instituteurNom: inst ? inst.prenom+' '+inst.nom : '' };
      });
      setNiveaux(nv||[]);
      setInactifs(elevesData.filter(e=>e.inactif).sort((a,b)=>{
        if(a.jours==null&&b.jours==null) return 0;
        if(a.jours==null) return -1;
        if(b.jours==null) return 1;
        return b.jours-a.jours;
      }));
    } catch(err) {
      console.error('ElevesInactifs error:', err);
      toast.error('Erreur: '+err.message);
    }
    setLoading(false);
  };

  const jamais  = inactifs.filter(e=>e.jours==null).length;
  const plus30  = inactifs.filter(e=>e.jours!=null&&e.jours>30).length;
  const entre14 = inactifs.filter(e=>e.jours!=null&&e.jours>14&&e.jours<=30).length;

  if (loading) return (
    <div style={{padding:'2rem',textAlign:'center'}}>
      <div className="loading">...</div>
      <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link" style={{marginTop:'1rem'}}>
        ←
      </button>
    </div>
  );

  return (
    <div style={{paddingBottom: isMobile ? 80 : 0, padding: isMobile ? 0 : '1rem',maxWidth:700,margin:'0 auto',background: isMobile ? '#f5f5f0' : 'transparent',minHeight: isMobile ? '100vh' : 'auto'}}>
      {isMobile ? (
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}></button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>🚨 {lang==='ar'?'الطلاب غير النشطين':'Élèves inactifs'}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.8)'}}>{inactifs.length} {lang==='ar'?'طالب':'élève(s)'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:'1.2rem'}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
          <div style={{fontSize:17,fontWeight:700,color:'#1a1a1a'}}>
            {lang==='ar'?'الطلاب غير النشطين':'Élèves inactifs'} ({inactifs.length})
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:'1rem'}}>
        <div style={{padding:'10px',borderRadius:10,background:'#FCEBEB',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#E24B4A'}}>{plus30}</div>
          <div style={{fontSize:10,color:'#E24B4A'}}>{'+30 '+(lang==='ar'?'يوم':'jours')}</div>
        </div>
        <div style={{padding:'10px',borderRadius:10,background:'#FFF3CD',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#856404'}}>{entre14}</div>
          <div style={{fontSize:10,color:'#856404'}}>{'14-30 '+(lang==='ar'?'يوم':'jours')}</div>
        </div>
        <div style={{padding:'10px',borderRadius:10,background:'#F0EEFF',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#534AB7'}}>{jamais}</div>
          <div style={{fontSize:10,color:'#534AB7'}}>{lang==='ar'?'لم يستظهر':'Sans récitation'}</div>
        </div>
      </div>

      {inactifs.length === 0 ? (
        <div style={{textAlign:'center',color:'#1D9E75',padding:'3rem',background:'#E1F5EE',borderRadius:12,fontSize:14,fontWeight:600}}>
          {lang==='ar'?'جميع الطلاب نشطون ✓':'Tous les élèves sont actifs ✓'}
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {inactifs.map(e => {
            const jours = e.jours;
            const estJamais = jours == null;
            const urgent = !estJamais && jours > 30;
            const nc = getNiveauColor(e.code_niveau||'1', niveaux||[]) || '#888';
            const bg = estJamais ? '#F0EEFF' : urgent ? '#FFF5F5' : '#FFFDF0';
            const borderCol = estJamais ? '#534AB7' : urgent ? '#E24B4A' : '#EF9F27';
            const textCol = estJamais ? '#534AB7' : urgent ? '#E24B4A' : '#856404';
            const init = ((e.prenom||'?')[0]+(e.nom||'?')[0]).toUpperCase();

            return (
              <div key={e.id}
                onClick={() => navigate('fiche', e)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                  borderRadius:12,cursor:'pointer',
                  background:bg,
                  border:'1.5px solid '+borderCol+'40'}}>
                <div style={{width:40,height:40,borderRadius:'50%',
                  background:nc+'25',color:nc,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontWeight:700,fontSize:14,flexShrink:0}}>
                  {init}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:3}}>
                    {e.prenom} {e.nom}
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{padding:'1px 7px',borderRadius:8,background:nc+'20',color:nc,fontSize:11,fontWeight:700}}>
                      {e.code_niveau||'?'}
                    </span>
                    {e.instituteurNom ? (
                      <span style={{fontSize:11,color:'#888'}}>{'👤 '+e.instituteurNom}</span>
                    ) : null}
                    {estJamais ? (
                      <span style={{fontSize:11,color:textCol,fontWeight:600}}>
                        {lang==='ar'?'لم يستظهر بعد':'Jamais récité'}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={{textAlign:'center',minWidth:48}}>
                  <div style={{fontSize:22,fontWeight:800,color:textCol,lineHeight:1}}>
                    {estJamais ? '∞' : jours}
                  </div>
                  <div style={{fontSize:9,color:textCol,marginTop:2}}>
                    {lang==='ar'?'يوم':'jours'}
                  </div>
                </div>
                <span style={{color:'#ccc',fontSize:16}}>›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
