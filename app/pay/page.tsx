'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/app/supabase';
import { Check, Copy, MessageCircle, Clock, ShieldAlert } from 'lucide-react';

const PAYMENT_PHONE = '+216 50 581 498';
const WHATSAPP_NUMBER = '21650581498'; // digits only, no + or spaces, for the wa.me link

const PLANS = [
  { key: '1m', label: '1 Month', months: 1, price: 10 },
  { key: '3m', label: '3 Months', months: 3, price: 25 },
  { key: '6m', label: '6 Months', months: 6, price: 45 },
  { key: '12m', label: '1 Year', months: 12, price: 75 },
];

function PayPageContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Resource-purchase mode (came from the Drive tab) ---
  const resourceId = searchParams.get('resource');
  const [resource, setResource] = useState<{ id: string; title: string; price: number; resource_type: string } | null>(null);
  const [loadingResource, setLoadingResource] = useState(!!resourceId);

  // --- Subscription-plan mode ---
  const preselectedKey = searchParams.get('plan');
  const [selectedPlan, setSelectedPlan] = useState(
    PLANS.find((p) => p.key === preselectedKey) || PLANS[1]
  );

  const isResourceMode = !!resourceId;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setEmail(session.user.email);
      if (session?.user?.id) setUserId(session.user.id);
    });
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', session.user.id)
        .single();
      if (data) setFullName(`${data.first_name || ''} ${data.last_name || ''}`.trim());
    });

    if (resourceId) {
      supabase
        .from('resources_view')
        .select('id, title, price, resource_type')
        .eq('id', resourceId)
        .single()
        .then(({ data }) => {
          setResource(data);
          setLoadingResource(false);
        });
    }
  }, [resourceId]);

  const copyPhone = () => {
    navigator.clipboard.writeText(PAYMENT_PHONE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Only mark as "pending verification" once they actually commit to sending proof,
  // not just from browsing the page.
  const handleSendClick = async () => {
    if (!userId) return;
    if (isResourceMode && resource) {
      await supabase.rpc('request_resource_purchase', { p_resource_id: resource?.id });
    } else {
      await supabase.rpc('select_paid_plan', { plan_label: selectedPlan.label });
    }
  };

  const amount = isResourceMode ? resource?.price : selectedPlan.price;
  const itemLabel = isResourceMode ? resource?.title : `${selectedPlan.label} plan`;

  const whatsappMessage = encodeURIComponent(
    `Bonjour! I just paid ${amount} DT for "${itemLabel}" on Study Hub.\nName: ${fullName || '[your name]'}\nEmail: ${email || '[your email]'}\nI'm attaching my payment screenshot.`
  );
  const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`;

  if (isResourceMode && loadingResource) {
    return (
      <div className="min-h-screen bg-[#0B0E17] text-[#ECEFF6] flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  if (isResourceMode && !resource) {
    return (
      <div className="min-h-screen bg-[#0B0E17] text-[#ECEFF6] flex items-center justify-center p-4">
        <p className="text-sm text-slate-400">This resource couldn't be found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E17] text-[#ECEFF6] font-sans flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header notice */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <ShieldAlert size={20} className="text-amber-400 shrink-0" />
          <div>
            <h2 className="font-semibold text-amber-300 text-sm">
              
            </h2>{isResourceMode ? `Unlock "${resource?.title}"` : 'Your free trial or subscription has expired'}
            <p className="text-xs text-slate-400 mt-0.5">
              {isResourceMode
                ? 'Complete the payment below to unlock this resource.'
                : 'Choose a plan below and follow the payment steps to keep using Study Hub.'}
            </p>
          </div>
        </div>

        {/* Pricing: plan cards (subscription mode) or a single resource card */}
        {isResourceMode ? (
  <div className="bg-slate-900 border border-teal-500/40 rounded-xl p-5">
    <p className="text-xs text-slate-400 mb-1">{resource?.resource_type === 'summary' ? 'Course Summary' : 'Exercise Set (with correction)'}</p>
    <p className="text-lg font-bold text-white">{resource?.title}</p>
    <p className="text-2xl font-bold text-teal-400 mt-2">{resource?.price} DT</p>
  </div>
) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan.key === plan.key;
              return (
                <button
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan)}
                  className={`text-left rounded-xl p-4 border transition cursor-pointer ${
                    isSelected ? 'bg-teal-500/10 border-teal-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-300">{plan.label}</span>
                    {isSelected && <Check size={14} className="text-teal-400" />}
                  </div>
                  <p className="text-xl font-bold text-white">{plan.price} <span className="text-xs font-normal text-slate-500">DT</span></p>
                  {plan.months >= 3 && (
                    <p className="text-[10px] text-teal-400 mt-1">{(plan.price / plan.months).toFixed(1)} DT/month</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Payment instructions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h3 className="font-semibold text-slate-200 text-sm mb-2 flex items-center gap-2">
            <Clock size={15} className="text-teal-400" /> How to pay — {amount} DT
          </h3>

          <div className="space-y-4 text-sm text-slate-300">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-teal-600/20 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <div>
                <p className="font-medium text-slate-200">Pay via the D17 app</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Open D17, send <strong>{amount} DT</strong> to this number:
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <code className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200">{PAYMENT_PHONE}</code>
                  <button onClick={copyPhone} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer">
                    {copied ? <Check size={13} className="text-teal-400" /> : <Copy size={13} className="text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-teal-600/20 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <div>
                <p className="font-medium text-slate-200">Send your payment proof on WhatsApp</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send the payment screenshot to <strong>{PAYMENT_PHONE}</strong> on WhatsApp, along with your full name
                  {fullName && <> (<span className="text-slate-300">{fullName}</span>)</>} and your account email
                  {email && <> (<span className="text-slate-300">{email}</span>)</>}. We'll activate it manually within a few hours.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <a
              href={whatsappLink}
              onClick={handleSendClick}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <MessageCircle size={16} /> Send via WhatsApp
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          Already sent your payment? Activation is manual and can take a few hours. Thanks for your patience!
        </p>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0E17] text-[#ECEFF6] flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    }>
      <PayPageContent />
    </Suspense>
  );
}