import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmLabel, cancelLabel, confirmColor, lang='fr', loading=false }) {
  if (!isOpen) return null;

  // Helper : empeche le double-clic
  const safeConfirm = () => {
    if (loading || !onConfirm) return;
    onConfirm();
  };

  const cancelDisabled = loading;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={cancelDisabled ? undefined : onCancel}>
      <div style={{background:'#fff',borderRadius:20,padding:'2rem',maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
          <div style={{fontSize:40,marginBottom:'0.75rem'}}>{loading?'⏳':(confirmColor==='#E24B4A'?'🗑️':'⚠️')}</div>
          <div style={{fontSize:16,fontWeight:700,color:'#1a1a1a',marginBottom:8}}>{title}</div>
          {message&&<div style={{fontSize:13,color:'#888',lineHeight:1.5}}>{message}</div>}
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onCancel} disabled={cancelDisabled}
            style={{flex:1,padding:'11px',border:'1.5px solid #e0e0d8',borderRadius:10,background:'#fff',fontSize:13,fontWeight:500,cursor:cancelDisabled?'not-allowed':'pointer',color:'#666',opacity:cancelDisabled?0.5:1}}>
            {cancelLabel||(lang==='ar'?'إلغاء':lang==='en'?'Cancel':'Annuler')}
          </button>
          <button onClick={safeConfirm} disabled={loading}
            style={{flex:1,padding:'11px',border:'none',borderRadius:10,background:loading?'#999':(confirmColor||'#E24B4A'),color:'#fff',fontSize:13,fontWeight:700,cursor:loading?'wait':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {loading
              ? (lang==='ar'?'⏳ جاري الحذف...':lang==='en'?'⏳ Deleting...':'⏳ Suppression...')
              : (confirmLabel||(lang==='ar'?'تأكيد':lang==='en'?'Confirm':'Confirmer'))}
          </button>
        </div>
      </div>
    </div>
  );
}
