# Data Inconsistency Analysis: "Latest" vs "24h" Scores

## Issue Report

User reports: **"latest" score differs from "24h" score for the same timestamp**

Example:
- Latest (1/6@3pm): Score: 68
- 24h (1/6@3pm): Score: 75

## Root Cause Analysis

### Data Flow for Model Details Page

1. **"Latest" Period** (line 285 in `apps/web/app/models/[id]/page.tsx`):
   ```typescript
   fetch(`${apiUrl}/api/models/${modelId}`)
   ```
   - Endpoint: [`/api/models/:id`](apps/api/src/routes/models.ts:35)
   - Gets **absolute latest score** regardless of suite or mode
   - No filtering by `sortBy` parameter (combined/reasoning/speed/tooling)
   - Returns the most recent timestamp in database

2. **"24h" Period** (line 286):
   ```typescript
   fetch(`${apiUrl}/dashboard/history/${modelId}?period=${selectedPeriod}&sortBy=${sortByParam}`)
   ```
   - Endpoint: `/dashboard/history/:id` (in dashboard.ts)
   - Filters scores by:
     - **Time period** (last 24 hours)
     - **Suite type** based on `sortBy` (hourly/deep/tooling)
     - **Scoring mode** (combined mode uses weighted formula)
   - May return different score for same timestamp

### Why Scores Differ

When user is in **"combined" mode**:

**"Latest" endpoint** (`/api/models/:id`):
- Returns raw score from most recent database entry
- Could be from **any suite** (hourly, deep, OR tooling)
- No weighted averaging applied
- Example: If latest entry is from "deep" suite → shows deep score

**"24h/7d/1m" endpoints** (`/dashboard/history/:id`):
- Filters by specific suite based on mode
- **Combined mode formula**: 50% hourly + 25% deep + 25% tooling
- Only returns scores matching the selected mode's logic
- Example: Shows blended score from multiple suites

### Impact

This causes **user confusion** because:
1. Same timestamp shows different scores depending on period selection
2. "Latest" doesn't respect the selected scoring mode (combined/reasoning/speed/tooling)
3. No clear indication to user why scores differ

## Proposed Solutions

### Option 1: Quick Fix (Frontend Only)
**Add explanatory text** to model details page:

```typescript
{selectedPeriod === 'latest' && selectedScoringMode === 'combined' && (
  <div className="terminal-text--amber" style={{ fontSize: '0.8em', fontStyle: 'italic' }}>
    ℹ️ "Latest" shows most recent test result. For combined scoring across all suites, select a time period.
  </div>
)}
```

**Pros**: Easy, no backend changes
**Cons**: Doesn't fix the underlying issue

### Option 2: Backend Fix (Recommended)
**Modify `/api/models/:id` endpoint** to respect `sortBy` parameter:

**File**: [`apps/api/src/routes/models.ts`](apps/api/src/routes/models.ts:35)

```typescript
fastify.get('/:id', async (req: any, reply: any) => {
  const modelId = parseInt(req.params.id);
  const period = req.query?.period as string || 'latest';
  const sortBy = req.query?.sortBy as string || 'combined';  // ADD THIS
  
  // Apply same logic as dashboard/history endpoint
  // Filter by suite based on sortBy
  // For combined mode, compute weighted average
  // ...
});
```

**Pros**: Fixes root cause, consistent across all views
**Cons**: Requires backend changes, testing

### Option 3: Use Unified Endpoint (Best Long-term)
**Always use `/dashboard/history/:id`** for all periods including "latest":

```typescript
// In apps/web/app/models/[id]/page.tsx line 285
// Instead of:
fetch(`${apiUrl}/api/models/${modelId}`)

// Use:
fetch(`${apiUrl}/dashboard/history/${modelId}?period=latest&sortBy=${sortByParam}`)
```

**Pros**: Single source of truth, eliminates inconsistency
**Cons**: Requires backend to handle "latest" period properly

## Recommendation

Implement **Option 3** (Unified Endpoint):
1. Update frontend to always use `/dashboard/history/:id`
2. Ensure backend handles `period=latest` with proper suite filtering
3. Remove dependency on `/api/models/:id` for score data

## Files to Modify

### Frontend
- [`apps/web/app/models/[id]/page.tsx`](apps/web/app/models/[id]/page.tsx:284-287) - Line 285, replace endpoint

### Backend  
- [`apps/api/src/routes/dashboard.ts`](apps/api/src/routes/dashboard.ts) - Ensure `/dashboard/history/:id` handles `period=latest`
- [`apps/api/src/routes/models.ts`](apps/api/src/routes/models.ts:35) - Optionally add `sortBy` support

## Testing Checklist

After fix:
- [ ] "Latest" score matches first point in "24h" chart
- [ ] Scores consistent across all periods for same timestamp
- [ ] Combined mode shows blended score, not raw single-suite score
- [ ] Speed/Reasoning/Tooling modes show filtered scores
- [ ] Model details page displays correct canonical score

---

**Created**: 2026-01-12  
**Issue**: Data inconsistency between "latest" and period-specific scores  
**Status**: **Documented, fix proposed**
