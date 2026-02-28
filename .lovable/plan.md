

## Phase 1: Backend Foundation

### 1.1 Enable Lovable Cloud & Connect ElevenLabs
- Enable Lovable Cloud for database, auth, storage, and edge functions
- Connect ElevenLabs via connector for TTS

### 1.2 Create Database Tables
Create all 8 tables with proper types and constraints:
- `elder_profiles` (id, display_name, age, gender, preferred_language, timezone, relationship_label, created_by_user_id)
- `family_links` (id, family_user_id, elder_profile_id)
- `notification_templates` (id, elder_profile_id, category, type, title, schedule_time, frequency, voice_mode, message_text, family_voice_audio_url, is_enabled)
- `notification_instances` (id, template_id, elder_profile_id, scheduled_at, status, reply_audio_url, reply_transcript, classification_label)
- `qa_interactions` (id, elder_profile_id, asked_at, question_audio_url, question_transcript, answer_text, answer_audio_url, language_used)
- `mood_settings` (id, elder_profile_id, is_enabled, frequency, time_1, time_2)
- `mood_entries` (id, elder_profile_id, mood_score, selected_tags, ai_suggested_tags, mood_audio_url, mood_transcript, acknowledgement_text)
- `family_dashboard_visits` (id, family_user_id, elder_profile_id, visited_at)

### 1.3 RLS Policies
- Family users can only access elder data through `family_links` join
- All reads/writes scoped to authenticated user + elder_profile_id
- Elder route access scoped to specific elder_profile_id parameter

### 1.4 Storage Bucket
- Create `voice-recordings` bucket with policies for authenticated upload/read scoped through family_links

---

## Phase 2: Auth + Family Core Pages

### 2.1 Login Page (`/login`)
- Email/password signup + login using Supabase Auth
- Redirect to `/family` after login

### 2.2 Create Elder Profile (`/family/create-elder`)
- Form: display_name (required), preferred_language (dropdown), timezone (IANA dropdown), relationship_label, age, gender
- On save: insert `elder_profiles` + `family_links` rows

### 2.3 Create Notification Wizard (`/family/create-notification`)
- 5-step wizard: category → type/title → schedule/frequency → voice mode → message text
- If voice_mode = family_recorded: browser mic recording, upload to storage, playback to verify

### 2.4 Family Dashboard (`/family`)
- Elder profile selector dropdown + "Create Elder Profile" button
- Quick Actions: Trigger Demo Reminder, Trigger Mood Prompt, Run Daily Check
- Live Status Panel: 10 most recent instances with status badges
- Reply Log: filterable by time range (Today/This Week/All) and type (Task/Check-in/Mood)
  - Tasks: show status only, no transcript by default (reveal on click if unclear)
  - Check-ins: show transcript by default
  - Mood: show score + tags, transcript if recorded
  - Detail drawer with audio playback + 7-day retention note

---

## Phase 3: Daily Summary Card & Insights

### 3.1 Daily Summary Card (top of `/family`)
- Insert `family_dashboard_visits` row on page load
- Determine time window: today (no prior visit) or since last visit (multi-day)
- Compute deterministic facts in elder timezone:
  - Done/missed/unclear/no_response counts by task type (medication, appointment, exercise)
  - Check-in count
  - Latest mood score + trend
- Render using fallback templates (A/B/C/D as specified), optionally polish with GPT (facts only, no invention)
- Template A: daily first check — "Hi {familyName}. Today so far, {relationship} {elderName} has {task_summary}. {checkin}. Mood: {mood}."
- Template B: multi-day — "Since you last checked in ({days} days ago)..." with adherence/appointments/check-ins/mood trend
- Template C: no-response risk — "{elderName} has not replied to any check-ins today."
- Template D: compact stats — "Today: Meds X/Y • Appts X/Y • Exercise X/Y • Check-ins X • Mood {label}"

### 3.2 Insights Section
- Time range selector: Daily / Weekly / Monthly
- Adherence bar chart: done vs missed vs unclear by day, filterable by task type
- Mood line chart: average mood score per day

---

## Phase 4: Edge Functions

### 4.1 `transcribe`
- Accept audio file, call OpenAI Whisper with elder language hint, return transcript

### 4.2 `classify-reply`
- Accept task type + message_text + transcript, use Lovable AI Gateway (GPT)
- Return exactly one of: `done` / `missed` / `unclear`

### 4.3 `qa-answer`
- Accept question transcript + elder preferred_language
- GPT system prompt: friendly elderly assistant, never diagnose, suggest doctor for serious issues
- Return answer in elder language

### 4.4 `tts-generate`
- Accept text + language, call ElevenLabs TTS, return audio URL
- Match closest ElevenLabs voice/language to elder preference

### 4.5 `mood-ack`
- Accept mood_score + tags + optional transcript + elder language
- Return warm 2-sentence acknowledgement + closing line in elder language

---

## Phase 5: Elder Interface (`/elder/:elderProfileId`)

### 5.1 Layout
- Very large typography, high contrast, minimal clutter
- Greeting in elder preferred_language: "Hi {name}"
- Show most recent pending instance or "No reminders right now" (in elder language)

### 5.2 REPLY Flow
- Auto-play family voice or TTS fallback for pending reminder
- Record voice reply → upload → transcribe via Whisper
- If task: classify (done/missed/unclear), update status, store transcript only if unclear
- If check-in: set status=done, store transcript permanently
- Show "Thank you" in elder language

### 5.3 ASK A QUESTION Flow
- Record voice → transcribe → GPT Q&A (safe, elder language) → TTS → auto-play + display answer

### 5.4 MOOD Flow (visible only when mood enabled)
- 5-emoji scale → GPT-suggested tags in elder language → optional voice note → warm acknowledgement via GPT + TTS
- Store mood_score, tags, transcript permanently; audio 7 days only

---

## Phase 6: Final Polish

### 6.1 Multi-Language & Timezone
- All elder UI labels in preferred_language
- Schedule times in elder timezone, stored UTC, displayed local
- GPT classification outputs English labels regardless of transcript language

### 6.2 No-Response Handling
- Mark pending instances as `no_response` after 30 min (simulated)
- "Run Daily Check" button shows alert if no check-ins today (elder timezone)

### 6.3 Loading & Error States
- Loading indicators for transcription, classification, TTS, Q&A, mood acknowledgement
- Friendly error toasts for all failure cases

