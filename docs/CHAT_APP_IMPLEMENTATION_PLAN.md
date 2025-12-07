# LA Zoning Chat App Implementation Plan

**Created:** 2025-12-05
**Status:** Ready for Implementation

## Overview

Add a Clerk-protected chat app at `app.yourdomain.com/chat` with message history, citations, and feedback. Keep `/analyze` public.

**Architecture:**
- `yourdomain.com/` → Landing page (public)
- `yourdomain.com/analyze` → Q&A interface (public)
- `app.yourdomain.com/chat` → Chat app (Clerk-protected, premium)

---

## Phase 1: Dependencies & Database

### 1.1 Install Dependencies
```bash
npm install @clerk/nextjs
npx shadcn@latest add accordion scroll-area avatar button input textarea
```

**Note:** `uuid` already installed in package.json. Button/input/textarea may already exist - shadcn will skip if present.

### 1.2 Supabase Migrations

Create `supabase/migrations/create_chat_tables.sql`:

```sql
-- Feedback table
CREATE TABLE public.zoning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  query TEXT NOT NULL,
  response TEXT,
  section_refs TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_user ON zoning_feedback(user_id);
CREATE INDEX idx_feedback_rating ON zoning_feedback(rating);

-- Usage/rate limiting table
CREATE TABLE public.zoning_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, date)
);

-- Increment function for rate limiting
CREATE OR REPLACE FUNCTION increment_usage(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  INSERT INTO zoning_usage (user_id, date, count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = zoning_usage.count + 1
  RETURNING count INTO current_count;
  RETURN current_count;
END;
$$ LANGUAGE plpgsql;
```

### 1.3 Environment Variables

Add to `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx
CLERK_SECRET_KEY=sk_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

---

## Phase 2: Clerk Auth Setup

### 2.1 Files to Create

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Protect `/chat` routes only |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk sign-in page |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk sign-up page |

### 2.2 Middleware (src/middleware.ts)

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/chat(.*)',
  '/api/chat(.*)',
  '/api/feedback(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
```

### 2.3 Layout Modification (src/app/layout.tsx)

Wrap with ClerkProvider:
```typescript
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

---

## Phase 3: Chat UI Components

### 3.1 File Structure

```
src/app/chat/
├── page.tsx              # Main chat page (CLIENT COMPONENT - "use client";)
├── layout.tsx            # Chat layout with header
└── components/
    ├── ChatContainer.tsx # Messages list + scroll behavior
    ├── ChatMessage.tsx   # User/assistant message bubbles
    ├── CitationCard.tsx  # Expandable citation accordion
    ├── FeedbackButtons.tsx # Thumbs up/down (plural, standardized)
    ├── ChatInput.tsx     # Fixed input at bottom
    └── Disclaimer.tsx    # Legal disclaimer per message
```

**Important:** `page.tsx` MUST be a client component (`"use client";` at top) since it handles:
- localStorage for chat history
- useState for messages
- API calls to `/api/chat`

### 3.2 Key Component Details

**ChatContainer.tsx:**
- Scrollable message list with `scroll-area` from shadcn
- Auto-scroll on new messages
- localStorage persistence: `la-zoning-chat-history-v1`
- Max 50 messages (FIFO cleanup)

**ChatMessage.tsx:**
- User messages: right-aligned, blue background
- Assistant messages: left-aligned, with citations
- Streaming support (future)

**CitationCard.tsx:**
- Uses shadcn `Accordion` component
- Shows section_ref as title
- Expandable snippet content
- Link to amlegal source (hardcoded for v1: `https://codelibrary.amlegal.com/codes/los_angeles`)
- Future: Could use `source_url` from embeddings/docs table

**ChatInput.tsx:**
- Fixed at bottom (sticky)
- Example query chips for first-time users
- Submit on Enter, Shift+Enter for newline

**Disclaimer.tsx:**
```
⚠️ INFORMATIONAL ONLY. Not legal advice.
📅 Current through Sep 30, 2025
🔗 Always verify: planning.lacity.org
```

**Disclaimer placement:**
- Render `<Disclaimer />` **only under assistant messages** in ChatMessage.tsx
- Do NOT render for user messages
- Do NOT append disclaimer text to API response
- Do NOT store disclaimer in localStorage as part of message content
- Purely presentational UI element

---

## Phase 3.5: Types (src/types/index.ts)

Add these types to align frontend with `/api/chat` response:

```typescript
export type ChatRole = 'user' | 'assistant';

export interface ChatCitation {
  section_ref: string;
  content?: string;
  source_url?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  citations?: ChatCitation[];
  confidence?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  lastUpdated: string;
}
```

**Usage:**
- Use these types in `ChatContainer.tsx`, `ChatMessage.tsx`, `page.tsx`
- localStorage key: `la-zoning-chat-history-v1` stores `ChatState`
- `/api/chat` response maps to ChatMessage: `response` → `content`, `messageId` → `id`

---

## Phase 4: API Routes

### 4.1 Chat Endpoint (src/app/api/chat/route.ts)

```typescript
// POST /api/chat
// Request:  { message: string }  ← Simple, no history array
// Response: { response: string, citations: Citation[], messageId: string, confidence: string }

import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import { getServerClient } from '@/lib/supabase';
import { askZoningQuestion } from '@/lib/services/packet';

const DAILY_LIMIT = 50;

export async function POST(request: NextRequest) {
  // 1. Auth check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate limit check (with error handling)
  const supabase = getServerClient();
  const { data: currentCount, error: rpcError } = await supabase.rpc('increment_usage', {
    p_user_id: userId
  });

  // Handle RPC failure gracefully
  if (rpcError || currentCount === null) {
    console.error('Rate limit RPC failed:', rpcError);
    return NextResponse.json({ error: 'Rate limit check failed' }, { status: 500 });
  }

  // Note: increment_usage() returns the *new* count after increment.
  // With DAILY_LIMIT = 50, requests 1–50 are allowed.
  // The 51st request (count = 51) is the first to be blocked.
  if (currentCount > DAILY_LIMIT) {
    return NextResponse.json({
      error: 'Rate limit exceeded (50 queries/day)',
      upgradeUrl: '/pricing'
    }, { status: 429 });
  }

  // 3. Get message (simple string, not history array)
  const { message } = await request.json();

  // 4. Use existing askZoningQuestion
  // Note: The docId param is ignored - getRelevantZoningSections() in rag.ts
  // automatically searches ALL 3 LA chapters (1, 1A, IX) with intent routing
  const result = await askZoningQuestion('los-angeles-chapter1', message);

  // 5. Safety check - ensure we got a valid response
  if (!result || !result.answer) {
    return NextResponse.json(
      { error: 'Failed to generate answer' },
      { status: 500 }
    );
  }

  // 6. Return response
  return NextResponse.json({
    response: result.answer,
    citations: result.citations,
    confidence: result.confidence,
    messageId: uuidv4()
  });
}
```

**Key insights:**
1. **Simple request shape:** `{ message: string }` only - no history array. Frontend stores history in localStorage.
2. **Multi-chapter RAG is automatic:** `askZoningQuestion()` calls `getMultiQueryContext()` → `getRelevantZoningSections()` (rag.ts:269), which searches all 3 LA chapters with intent-based routing regardless of docId.
3. **Robust rate limiting:** Check for RPC errors before dereferencing count.

### 4.2 Feedback Endpoint (src/app/api/feedback/route.ts)

```typescript
// POST /api/feedback
// Body: { messageId, rating, query, response?, sectionRefs? }
// Response: { success: true }

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messageId, rating, query, response, sectionRefs } = await request.json();

  // Validate required fields
  if (!messageId || !query) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate rating
  if (!['up', 'down'].includes(rating)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }

  const supabase = getServerClient();
  const { error } = await supabase.from('zoning_feedback').insert({
    message_id: messageId,
    user_id: userId,
    rating,
    query,
    response,
    section_refs: sectionRefs ?? []  // Normalize to array
  });

  if (error) {
    console.error('Feedback insert failed:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

---

## Phase 5: Subdomain Routing

### 5.1 Approach: Vercel Domain Mapping (No Rewrites Needed)

**Recommended:** Use Vercel's domain mapping instead of Next.js rewrites.

The rewrite `app.yourdomain.com/:path*` → `/chat/:path*` would cause `app.yourdomain.com/chat` to become `/chat/chat` (double-pathing). Instead:

1. **Build the chat app at `/chat`** (same as main domain)
2. **Use Vercel domain mapping** to point `app.yourdomain.com` to the same deployment
3. **Middleware handles auth** - protects `/chat(.*)` routes regardless of host

This means:
- `yourdomain.com/chat` → works (redirects to sign-in via middleware)
- `app.yourdomain.com/chat` → works (same behavior)
- Both hosts serve the same `/chat` route

### 5.2 Vercel Dashboard Setup

1. Add domain `app.yourdomain.com` in Vercel
2. Point to same deployment (no special config needed)
3. Clerk Dashboard: Add `app.yourdomain.com` to allowed origins

### 5.3 Optional: Redirect Main Domain /chat to Subdomain

If you want to force users to `app.yourdomain.com/chat`:

```typescript
// next.config.ts
async redirects() {
  return [
    {
      source: '/chat/:path*',
      has: [{ type: 'host', value: 'yourdomain.com' }],
      destination: 'https://app.yourdomain.com/chat/:path*',
      permanent: false,
    },
  ];
}
```

This is optional - both hosts will work without it.

---

## Phase 6: Landing Page CTA

### 6.1 Update src/app/page.tsx

Add CTA button linking to chat:
```tsx
<Link
  href="https://app.yourdomain.com/chat"
  className="bg-amber-500 text-white px-6 py-3 rounded-lg font-semibold"
>
  🚀 Try LA Zoning Chat (Free)
</Link>
```

---

## Files Summary

### Create New

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Clerk auth middleware |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Sign-in page |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Sign-up page |
| `src/app/chat/page.tsx` | Main chat UI |
| `src/app/chat/layout.tsx` | Chat layout |
| `src/app/chat/components/ChatContainer.tsx` | Message list |
| `src/app/chat/components/ChatMessage.tsx` | Message bubble |
| `src/app/chat/components/CitationCard.tsx` | Expandable citation |
| `src/app/chat/components/FeedbackButtons.tsx` | Thumbs up/down (export as `FeedbackButtons`) |
| `src/app/chat/components/ChatInput.tsx` | Input + send |
| `src/app/chat/components/Disclaimer.tsx` | Legal disclaimer |
| `src/app/api/chat/route.ts` | Chat API |
| `src/app/api/feedback/route.ts` | Feedback API |
| `supabase/migrations/create_chat_tables.sql` | DB tables |

### Modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add ClerkProvider wrapper |
| `src/app/page.tsx` | Add CTA button to chat |
| `src/types/index.ts` | Add ChatRole, ChatCitation, ChatMessage, ChatState types |
| `next.config.ts` | (Optional) Add redirect from main domain /chat to subdomain |
| `package.json` | Add @clerk/nextjs dependency |

### Reuse (DO NOT MODIFY)

| File | What to Use |
|------|-------------|
| `src/lib/services/packet.ts` | `askZoningQuestion()` - main RAG entry point |
| `src/lib/services/rag.ts` | Called internally by packet.ts |
| `src/lib/services/llm.ts` | Called internally by packet.ts |
| `src/lib/supabase.ts` | `getServerClient()` |

---

## Implementation Order

1. Run Supabase migration (create tables)
2. Install dependencies (`@clerk/nextjs`, shadcn components)
3. Create Clerk auth files (middleware, sign-in/sign-up pages)
4. Modify layout.tsx (add ClerkProvider)
5. Add types to `src/types/index.ts`
6. Create API routes (`/api/chat`, `/api/feedback`)
7. Create chat UI components
8. Assemble chat page
9. Add landing page CTA
10. Configure Vercel subdomain
11. Test end-to-end

---

## Success Criteria

1. Chat works at `app.yourdomain.com/chat` (auth required)
2. `/analyze` remains public (no auth)
3. "parking restaurant C2" returns answer with 12.21.A.4 citation
4. Thumbs up/down saves to `zoning_feedback` table
5. 51st query returns 429 rate limit error
6. Landing page CTA links to chat app
