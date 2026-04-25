import { useEffect } from 'react';
import { useToast } from '../lib/toast';

// ═══════════════════════════════════════════════════════════════
// Composant invisible qui ecoute les blocages d'ecriture du wrapper
// supabase et affiche un toast d'avertissement.
//
// Le wrapper supabase.js dispatche un event 'impersonation-blocked'
// chaque fois qu'une operation insert/update/delete/upsert est
// bloquee. Ce composant intercepte ces events et affiche un toast.
//
// Anti-spam : on ne montre qu'un toast par 3 secondes meme si le
// code essaie plusieurs operations en cascade (ce qui arriverait
// par exemple sur un formulaire de creation qui fait insert+update).
// ═══════════════════════════════════════════════════════════════

let lastToastTime = 0;
const TOAST_COOLDOWN_MS = 3000;

export default function ImpersonationToastListener({ lang = 'fr' }) {
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e) => {
      const now = Date.now();
      if (now - lastToastTime < TOAST_COOLDOWN_MS) return;
      lastToastTime = now;

      const opLabel = {
        insert: lang === 'ar' ? 'إضافة' : 'ajout',
        update: lang === 'ar' ? 'تعديل' : 'modification',
        delete: lang === 'ar' ? 'حذف' : 'suppression',
        upsert: lang === 'ar' ? 'حفظ' : 'enregistrement',
      }[e.detail?.operation] || (lang === 'ar' ? 'تعديل' : 'modification');

      toast.error(
        lang === 'ar'
          ? `🔒 وضع القراءة فقط — تم منع ${opLabel}. اخرج من وضع التقمص أولاً.`
          : `🔒 Mode lecture seule — ${opLabel} bloqué(e). Quittez l'impersonification d'abord.`,
        { duration: 5000 }
      );
    };

    window.addEventListener('impersonation-blocked', handler);
    return () => window.removeEventListener('impersonation-blocked', handler);
  }, [toast, lang]);

  return null; // composant invisible
}
