'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/supabase';
import { Check, Clock, ShieldAlert, Loader2 } from 'lucide-react';

const PLANS = [
  { key: 'free', label: 'Free Trial (14 days)', months: 0, price: 0, isFree: true },
  { key: '1m', label: '1 Month', months: 1, price: 10 },
  { key: '3m', label: '3 Months', months: 3, price: 25 },
  { key: '6m', label: '6 Months', months: 6, price: 45 },
  { key: '12m', label: '1 Year', months: 12, price: 75 },
];

export default function PlanGate({ children }) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(session);

      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, subscription_status, subscription_ends_at, plan, trial_used, banned, ban_reason')
        .eq('id', session.user.id)
        .single();

      if (!isMounted) return;
      setProfile(profileData);
      setLoading(false);
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) load();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const choosePlan = async (plan) => {
    if (!session?.user) return;
    setSelecting(true);

    if (plan.isFree) {
      const { data, error } = await supabase.rpc('start_free_trial');

      if (error) {
        alert('Something went wrong starting your trial. Please try again or contact support.');
        setSelecting(false);
        return;
      }

      if (!data?.success) {
        // Trial was already used — refetch the real profile so the UI reflects that
        const { data: freshProfile } = await supabase
          .from('profiles')
          .select('role, subscription_status, subscription_ends_at, plan, trial_used')
          .eq('id', session.user.id)
          .single();
        setProfile(freshProfile);
        setSelecting(false);
        return;
      }

      setProfile((prev) => ({
        ...prev,
        subscription_status: 'trial',
        subscription_ends_at: data.ends_at,
        plan: 'Free Trial (14 days)',
        trial_used: true,
      }));
      setSelecting(false);
    } else {
      const { error } = await supabase.rpc('select_paid_plan', { plan_label: plan.label });

      if (error) {
        alert('Something went wrong selecting your plan. Please try again.');
        setSelecting(false);
        return;
      }

      router.push(`/pay?plan=${plan.key}`);
      setSelecting(false);
    }
  };

  // --- Not logged in: let the page handle showing the login/signup screen ---
  if (!session) return children;

  // --- Still loading profile: avoid flashing the dashboard before we know the status ---
  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#09090B] text-[#71717A] flex items-center justify-center text-sm">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading your account...
      </div>
    );
  }

  // --- Banned users are blocked outright, even admins-in-theory shouldn't be banned but check first ---
  if (profile.banned) {
    return (
      <div className="min-h-screen bg-[#09090B] text-[#F2F2F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111113] border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
          <ShieldAlert size={28} className="text-red-400 mx-auto" />
          <h2 className="text-lg font-bold">Your account has been suspended</h2>
          <p className="text-sm text-[#8C93A6]">
            {profile.ban_reason || 'Your access has been restricted due to a violation of our community guidelines.'}
          </p>
          <p className="text-xs text-[#8C93A6]">If you believe this is a mistake, please contact support.</p>
        </div>
      </div>
    );
  }

  // --- Admins bypass all plan/trial gating entirely ---
  if (profile.role === 'admin') return children;

  const isExpired = profile.subscription_ends_at && new Date(profile.subscription_ends_at) < new Date();
  const isBlocked = profile.subscription_status === 'expired' || (isExpired && profile.subscription_status !== 'pending_payment');

  // --- Already picked a paid plan, waiting on manual verification ---
  if (profile.subscription_status === 'pending_payment') {
    return (
      <div className="min-h-screen bg-[#09090B] text-[#F2F2F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#111113] border border-white/10 rounded-2xl p-8 text-center space-y-4">
          <Clock size={28} className="text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold">Payment pending verification</h2>
          <p className="text-sm text-[#8C93A6]">
            We're waiting to confirm your payment for the <strong className="text-[#F2F2F5]">{profile.plan}</strong> plan.
            This is usually verified within a few hours of receiving your WhatsApp message.
          </p>
          <button
            onClick={() => router.push('/pay')}
            className="w-full bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold py-2.5 rounded-xl transition"
          >
            View payment instructions again
          </button>
        </div>
      </div>
    );
  }

  // --- No plan chosen yet, OR trial/subscription expired: show the plan picker ---
  if (profile.subscription_status === 'pending' || isBlocked) {
    const showFree = profile.subscription_status === 'pending' && !profile.trial_used;

    return (
      <div className="min-h-screen bg-[#09090B] text-[#F2F2F5] flex items-center justify-center p-4 py-12">
        <div className="max-w-3xl w-full space-y-6">
          {isBlocked && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
              <ShieldAlert size={20} className="text-red-400 shrink-0" />
              <div>
                <h2 className="font-semibold text-red-300 text-sm">Your access has ended</h2>
                <p className="text-xs text-[#8C93A6] mt-0.5">Choose a plan below to keep using Study Hub.</p>
              </div>
            </div>
          )}
          {!isBlocked && (
            <div className="text-center">
              <h2 className="text-2xl font-bold">Choose your plan</h2>
              <p className="text-sm text-[#8C93A6] mt-1">Start with a free trial or go straight to a paid plan.</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {PLANS.filter((p) => !p.isFree || showFree).map((plan) => (
              <button
                key={plan.key}
                onClick={() => choosePlan(plan)}
                disabled={selecting}
                className="text-left rounded-xl p-4 border border-white/10 bg-[#111113] hover:border-teal-500/50 transition cursor-pointer disabled:opacity-50"
              >
                <p className="text-xs font-semibold text-[#8C93A6] mb-1">{plan.label}</p>
                <p className="text-xl font-bold text-[#F2F2F5]">
                  {plan.isFree ? 'Free' : `${plan.price} DT`}
                </p>
                <span className="text-[11px] text-teal-400 mt-2 inline-flex items-center gap-1">
                  {selecting ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Select
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Active trial or active paid plan: show the dashboard, with a countdown/renewal banner if relevant ---
  const daysLeft = profile.subscription_ends_at
    ? Math.max(0, Math.ceil((new Date(profile.subscription_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const showTrialBanner = profile.subscription_status === 'trial' && daysLeft !== null;
  const showRenewalBanner = profile.subscription_status === 'active' && daysLeft !== null && daysLeft <= 5;

  return (
    <>
      {showTrialBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-center py-2 px-4 text-xs text-amber-300 font-medium flex items-center justify-center gap-3 flex-wrap">
          <span>🕒 {daysLeft} day{daysLeft === 1 ? '' : 's'} left in your free trial.</span>
          <button
            onClick={() => router.push('/pay')}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 text-[11px] font-bold px-3 py-1 rounded-full transition cursor-pointer"
          >
            Pay Now →
          </button>
        </div>
      )}
      {showRenewalBanner && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 text-center py-2 px-4 text-xs text-rose-300 font-medium flex items-center justify-center gap-3 flex-wrap">
          <span>
            ⏳ Your {profile.plan || 'plan'} {daysLeft === 0 ? 'ends today' : `ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}.
          </span>
          <button
            onClick={() => router.push('/pay')}
            className="bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-bold px-3 py-1 rounded-full transition cursor-pointer"
          >
            Renew →
          </button>
        </div>
      )}
      {children}
    </>
  );
}