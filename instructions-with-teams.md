````markdown
# Dynasty Draft Picks Tracker – JSON State + Netlify Blobs (Cursor Instructions)

This doc describes how to structure **teams and picks in JSON** and how to combine that with **Netlify Blobs** to avoid a database. It’s written so Cursor can help you scaffold the project.

Goal:  
A small React + Netlify Functions app where your dynasty league logs **draft pick trades** (including future years) with **Sapiens rule** checks. Existing pick ownership comes from a JSON file derived from your Excel sheet.

---

## 1. Data model overview

We’ll use **one main JSON “seed” file** in the repo:

- `src/data/initialState.json`

This will store:

- `teams`: static list of all league teams.
- `basePicks`: all picks and their current owners **as of today** (i.e. what your Excel sheet says).

New trades will be stored **separately** in Netlify Blobs (a simple key/value store), not in the JSON file.

### TypeScript types

Create `src/types/state.ts`:

```ts
export type TeamId = string;

export type Team = {
  id: TeamId;      // stable slug, e.g. "gtd_pussies"
  name: string;    // UI name, e.g. "GTD PUSSIES"
};

export type Pick = {
  year: number;            // e.g. 2026
  round: number;           // e.g. 1
  originalOwnerId: TeamId; // team that "minted" the pick
  currentOwnerId: TeamId;  // who owns it at baseline (after old trades)
};

// Reference to a pick used inside a Trade.
// We DO NOT copy currentOwnerId here; trades change that.
export type TradePickRef = {
  year: number;
  round: number;
  originalOwnerId: TeamId;
};

export type Trade = {
  id: string;
  createdAt: string;
  fromTeamId: TeamId;
  toTeamId: TeamId;
  picks: TradePickRef[];
  notes?: string;
};

export type State = {
  teams: Team[];
  basePicks: Pick[];
  trades: Trade[]; // dynamic, stored in Netlify Blobs
};
````

---

## 2. `initialState.json` – converting from the Excel sheet

We’ll keep JSON instead of CSV.

Create `src/data/initialState.json`:

```json
{
  "teams": [
    { "id": "gtd_pussies", "name": "GTD PUSSIES" },
    { "id": "slimreaper", "name": "SLIMREAPER" },
    { "id": "onlyfranz", "name": "ONLYFRANZ" }
    // ...one per team in your league
  ],
  "basePicks": [
    {
      "year": 2026,
      "round": 1,
      "originalOwnerId": "gtd_pussies",
      "currentOwnerId": "gtd_pussies"
    },
    {
      "year": 2026,
      "round": 1,
      "originalOwnerId": "slimreaper",
      "currentOwnerId": "slimreaper"
    },
    {
      "year": 2026,
      "round": 1,
      "originalOwnerId": "row",
      "currentOwnerId": "gtd_pussies"
    }
    // ...one object per pick in your grid
  ]
}
```

### Mapping rules from the Excel grid

From your “WRONGKONG DYNASTY DRAFT PICKS” sheet:

* **Columns (row 2)**: team names → convert to stable `id` slugs (e.g. `GTD PUSSIES` → `gtd_pussies`).
* **Column A**: year (carry down the last non-empty value).
* **Column B**: round (e.g. `"ROUND 1"` → `1`).
* **Body cells**:

  * If the cell is empty → **no pick**, skip it.
  * If the cell is `"X"` → pick is with its **original owner**:

    * `currentOwnerId = originalOwnerId`
  * If the cell contains another team’s name → pick was traded:

    * `currentOwnerId = that team’s id`

This builds a clean list where **each pick** is:

```json
{
  "year": 2026,
  "round": 1,
  "originalOwnerId": "row",
  "currentOwnerId": "gtd_pussies"
}
```

That represents:
“2026 Round 1 pick originally owned by ROW is currently owned by GTD PUSSIES”.

---

## 3. Loading the initial state in code

Create `src/data/initialState.ts`:

```ts
import raw from './initialState.json';
import type { State } from '../types/state';

export const initialState: State = {
  teams: raw.teams,
  basePicks: raw.basePicks,
  trades: [] // no live trades stored in the JSON file
};
```

This gives you a typed `initialState` object you can use in both frontend and backend.

---

## 4. Storing live trades in Netlify Blobs

We’ll use Blobs as a tiny key/value store. All **mutable** data goes there:

* `trades`: new trades logged via the web app.

Install Blobs helper:

```bash
npm install @netlify/blobs
```

Define the shape of what’s stored in the blob:

```ts
// src/types/blobState.ts
import type { Trade } from './state';

export type BlobState = {
  trades: Trade[];
};
```

---

## 5. `get-state` Netlify function

This function combines:

* **Static** data from `initialState` (teams + basePicks).
* **Dynamic** trades from the blob.

Create `netlify/functions/get-state.ts`:

```ts
import { getStore } from '@netlify/blobs';
import { initialState } from '../../src/data/initialState';
import type { State, Trade } from '../../src/types/state';
import type { BlobState } from '../../src/types/blobState';

export default async () => {
  const store = getStore('dynasty-picks');

  const blob = (await store.getJSON('state')) as BlobState | null;

  const trades: Trade[] = blob?.trades ?? [];

  const fullState: State = {
    teams: initialState.teams,
    basePicks: initialState.basePicks,
    trades
  };

  return new Response(JSON.stringify(fullState), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

Endpoint:
`GET /.netlify/functions/get-state` → returns the full `State`.

---

## 6. `add-trade` Netlify function

This function:

1. Reads current `BlobState` (`trades`).
2. Adds a new `Trade`.
3. (Later) Validates Sapiens rule before writing.
4. Writes back the updated blob.

Create `netlify/functions/add-trade.ts`:

```ts
import { getStore } from '@netlify/blobs';
import type { Trade } from '../../src/types/state';
import type { BlobState } from '../../src/types/blobState';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const store = getStore('dynasty-picks');

  const body = await req.json(); // { fromTeamId, toTeamId, picks, notes }

  const blob =
    ((await store.getJSON('state')) as BlobState | null) ?? {
      trades: []
    };

  const newTrade: Trade = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    fromTeamId: body.fromTeamId,
    toTeamId: body.toTeamId,
    picks: body.picks ?? [],
    notes: body.notes ?? ''
  };

  // TODO: plug in Sapiens rule validation here, e.g.:
  // const validation = validateSapiensRule(initialState, blob.trades, newTrade);
  // if (!validation.ok) {
  //   return new Response(
  //     JSON.stringify({ error: validation.message }),
  //     { status: 400 }
  //   );
  // }

  const nextBlob: BlobState = {
    trades: [...blob.trades, newTrade]
  };

  await store.setJSON('state', nextBlob);

  return new Response(JSON.stringify({ ok: true, trade: newTrade }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

Endpoint:
`POST /.netlify/functions/add-trade`

Sample request body:

```json
{
  "fromTeamId": "alex",
  "toTeamId": "matt",
  "picks": [
    { "year": 2027, "round": 1, "originalOwnerId": "alex" }
  ],
  "notes": "Test trade"
}
```

---

## 7. Frontend wiring (React)

In `src/App.tsx`, you can start with a simple test UI:

```tsx
import { useEffect, useState } from 'react';
import type { State, Trade } from './types/state';

function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadState = async () => {
    try {
      const res = await fetch('/.netlify/functions/get-state');
      const data: State = await res.json();
      setState(data);
    } catch (e) {
      console.error(e);
      setError('Failed to load state');
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const handleTestTrade = async () => {
    setError(null);

    const res = await fetch('/.netlify/functions/add-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromTeamId: 'alex',
        toTeamId: 'matt',
        picks: [{ year: 2027, round: 1, originalOwnerId: 'alex' }],
        notes: 'Test trade from UI'
      })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to add trade');
      return;
    }

    await loadState();
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Dynasty Draft Picks</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!state && !error && <p>Loading…</p>}

      {state && (
        <>
          <section>
            <h2>Trades ({state.trades.length})</h2>
            <ul>
              {state.trades.map((t: Trade) => (
                <li key={t.id}>
                  {new Date(t.createdAt).toLocaleString()} —{' '}
                  {t.fromTeamId} ➜ {t.toTeamId} ({t.picks.length} picks)
                </li>
              ))}
            </ul>
          </section>

          <button onClick={handleTestTrade}>Add test trade</button>
        </>
      )}
    </main>
  );
}

export default App;
```

Once that’s working, you can:

* Build a proper **“Log a trade”** form instead of `handleTestTrade`.
* Add a **matrix view**: for each `year` + `round`, show `currentOwnerId` after replaying `basePicks` + `trades`.
* Implement **Sapiens rule** in a shared helper (e.g. `src/lib/sapiensRule.ts`) and call it from `add-trade`.

---

## 8. Summary

* **JSON** is your baseline source of truth: `initialState.json`.
* **Netlify Blobs** store just `trades`, as one `state` key.
* `get-state` = `initialState` + `trades`.
* `add-trade` = append trade → (later) validate Sapiens rule → save.

This gives you a clean, minimal setup with **no external DB**, perfect for a Netlify-hosted dynasty pick tracker.

```

::contentReference[oaicite:0]{index=0}
```
