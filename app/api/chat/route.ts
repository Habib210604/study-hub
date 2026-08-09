import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const maxDuration = 30;

// 1. Existing GET Handler for Event Reminders (Untouched)
export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      return NextResponse.json(
        { error: 'Missing environment variables.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
    const resend = new Resend(resendApiKey);

    const oneDay = new Date();
    oneDay.setDate(oneDay.getDate() + 1);
    const oneDayStr = oneDay.toISOString().split('T')[0];

    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    const threeDaysStr = threeDays.toISOString().split('T')[0];

    const { data: events, error: dbError } = await supabase
      .from('events')
      .select('id, title, event_date, type, user_id')
      .in('event_date', [oneDayStr, threeDaysStr]);

    if (dbError) {
      console.error('🔴 SUPABASE DB ERROR:', dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        message: 'No events scheduled for 1 day or 3 days from now.',
        backendIsSearchingFor: { tomorrow: oneDayStr, threeDaysOut: threeDaysStr }
      });
    }

    const results = [];
    for (const event of events) {
      if (!event.user_id) continue;

      const { data: userData } = await supabase.auth.admin.getUserById(event.user_id);
      const userEmail = userData?.user?.email;

      if (userEmail) {
        const isTomorrow = event.event_date === oneDayStr;
        const timeFrameLabel = isTomorrow ? 'Tomorrow' : 'in 3 Days';

        const emailResponse = await resend.emails.send({
          from: 'Study Dashboard <onboarding@resend.dev>',
          to: userEmail,
          subject: `⏰ Reminder: ${event.type === 'exam' ? 'Exam' : 'Event'} ${timeFrameLabel}!`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc;">
              <h2 style="color: #4f46e5;">Upcoming ${event.type === 'exam' ? 'Exam' : 'Event'} Reminder</h2>
              <p>Hi there!</p>
              <p>This is a quick reminder that you have an upcoming <strong>${event.type || 'event'}</strong> scheduled <strong>${timeFrameLabel.toLowerCase()}</strong>:</p>
              <div style="padding: 16px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0;">
                <h3 style="margin: 0; color: #1e293b;">${event.title}</h3>
                <p style="margin: 4px 0 0 0; color: #64748b;">Date: ${event.event_date}</p>
              </div>
              <p>Good luck with your preparation!</p>
            </div>
          `,
        });
        results.push(emailResponse);
      }
    }

    return NextResponse.json({ success: true, sentCount: results.length });
  } catch (err: any) {
    console.error('🔴 ERROR IN REMINDERS API:', err.message || err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. Direct Native POST Handler for AI Chat
export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    // API key read from environment variable.
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('🔴 MISSING GEMINI_API_KEY environment variable');
      return NextResponse.json(
        { error: 'Server is missing GEMINI_API_KEY. Add it to .env.local and restart the dev server.' },
        { status: 500 }
      );
    }

    const systemPrompt = context
      ? `You are an expert AI study assistant. Use the following uploaded document context to answer the student's questions accurately:\n\n${context}`
      : `You are an expert AI study assistant helping a student with their coursework, exams, and subjects.`;

    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    contents.unshift({
      role: 'user',
      parts: [{ text: `[System Instruction]: ${systemPrompt}` }]
    });

    // Model updated again: gemini-2.5-flash was retired for new users.
    // gemini-3.6-flash is the current generally-available Flash model.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contents })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('🔴 GEMINI API ERROR:', data.error?.message || data);
      throw new Error(data.error?.message || 'Failed to generate content from Gemini API');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    return NextResponse.json({ role: 'assistant', content: text });
  } catch (err: any) {
    console.error('🔴 ERROR IN AI CHAT API:', err.message || err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}