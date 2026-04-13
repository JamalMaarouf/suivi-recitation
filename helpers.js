import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmLabel, cancelLabel, confirmColor, lang='fr' }) {
  if (!isOpen) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={onCancel}>
      <div style={{background:'#fff',borderRadius:20,padding:'2rem',maxWidth:420,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
          <div style={{fontSize:40,marginBottom:'0.75rem'}}>{confirmColor==='#E24B4A'?'🗑️':'⚠️'}</div>
          <div style={{fontSize:16,fontWeight:700,color:'#1a1a1a',marginBottom:8}}>{title}</div>
          {message&&<div style={{fontSize:13,color:'#888',lineHeight:1.5}}>{message}</div>}
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onCancel}
            style={{flex:1,padding:'11px',border:'1.5px solid #e0e0d8',borderRadius:10,background:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',color:'#666'}}>
            {cancelLabel||(lang==='ar'?'إلغاء':lang==='en'?'Cancel':'Annuler')}
          </button>
          <button onClick={onConfirm}
            style={{flex:1,padding:'11px',border:'none',borderRadius:10,background:confirmColor||'#E24B4A',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            {confirmLabel||(lang==='ar'?'تأكيد':lang==='en'?'Confirm':'Confirmer')}
          </button>
        </div>
      </div>
    </div>
  );
}
