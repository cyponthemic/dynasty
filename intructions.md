Here you go — drop this into `README.md` in your repo and Cursor should be happy.

````markdown
# Dynasty Draft Picks Tracker – Setup & Deploy (Vite + Netlify Functions)

This project is a simple React app (using Vite) with Netlify Functions and a JSON-like backend using **Netlify Blobs**.  
Goal: a tiny web app where league members can log draft pick trades (including future years) without needing a full database.

---

## 1. Prerequisites

Make sure you have:

- **Node.js** (v18+ recommended)
- **npm** (comes with Node)
- A **Netlify** account
- (Optional but recommended) **Netlify CLI** installed globally:

```bash
npm install -g netlify-cli
````

---

## 2. Create the React project (Vite + TypeScript)

From your projects folder:

```bash
npm create vite@latest dynasty-picks -- --template react-ts
cd dynasty-picks
npm install
```

Run dev server:

```bash
npm run dev
```

You should see the default Vite + React starter at `http://localhost:5173` (or whatever port is shown).

---

## 3. Add Netlify Functions

Create the functions folder:

```bash
mkdir -p netlify/functions
```

Add a test function at `netlify/functions/hello.ts`:

```ts
// netlify/functions/hello.ts
export default async () => {
  return new Response(JSON.stringify({ message: 'Hello from Netlify!' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

This is a basic serverless function that will live at:
`/.netlify/functions/hello` once running under Netlify.

---

## 4. Netlify build configuration

Create `netlify.toml` at the project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
```

This tells Netlify to:

* build with `npm run build`
* serve static assets from `dist`
* look for functions in `netlify/functions`.

---

## 5. Connect frontend to a function

Open `src/App.tsx` and replace the default content with something like:

```tsx
import { useEffect, useState } from 'react';

function App() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/.netlify/functions/hello')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => {
        console.error(err);
        setMessage('Error calling function');
      });
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Dynasty Draft Picks</h1>
      <p>{message ?? 'Loading…'}</p>
    </div>
  );
}

export default App;
```

This proves the frontend ↔ function wiring works before adding real logic.

---

## 6. Use Netlify dev locally (frontend + functions together)

In the project root, ensure Netlify CLI is installed:

```bash
npm install -g netlify-cli
```

Then run:

```bash
netlify dev
```

Netlify will:

* run the Vite dev server
* proxy function requests to `/.netlify/functions/*`.

Test in the browser:

* `http://localhost:8888` (Netlify dev default)
* You should see the app with “Hello from Netlify!” loaded from the function.

---

## 7. Using Netlify Blobs as your “JSON file”

Instead of a database, we use **Netlify Blobs** as a single JSON-like store for league state.

### Install Blobs helper

Inside the project:

```bash
npm install @netlify/blobs
```

### Define a simple state shape

Later you’ll expand this, but start with:

```ts
// src/types/state.ts
export type TeamId = string;

export type Team = {
  id: TeamId;
  name: string;
};

export type TradePick = {
  year: number;
  round: number;
  originalOwnerId: TeamId;
};

export type Trade = {
  id: string;
  createdAt: string;
  fromTeamId: TeamId;
  toTeamId: TeamId;
  picks: TradePick[];
  notes?: string;
};

export type State = {
  teams: Team[];
  trades: Trade[];
};
```

*(File path is up to you; this is just a suggestion.)*

### `get-state` function (read JSON from Blobs)

Create `netlify/functions/get-state.ts`:

```ts
// netlify/functions/get-state.ts
import { getStore } from '@netlify/blobs';
import type { State } from '../../src/types/state';

export default async () => {
  const store = getStore('dynasty-picks');

  const state = (await store.getJSON('state')) as State | null;

  const safeState: State =
    state ?? {
      teams: [],
      trades: [],
    };

  return new Response(JSON.stringify(safeState), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### `add-trade` function (read-modify-write JSON)

Create `netlify/functions/add-trade.ts`:

```ts
// netlify/functions/add-trade.ts
import { getStore } from '@netlify/blobs';
import type { State, Trade } from '../../src/types/state';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const store = getStore('dynasty-picks');

  const body = await req.json(); // { fromTeamId, toTeamId, picks, notes }

  const currentState =
    ((await store.getJSON('state')) as State | null) ?? {
      teams: [],
      trades: [],
    };

  const newTrade: Trade = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    fromTeamId: body.fromTeamId,
    toTeamId: body.toTeamId,
    picks: body.picks ?? [],
    notes: body.notes ?? '',
  };

  // TODO: add Sapiens rule validation here
  // if (!validateSapiensRule(currentState.trades, newTrade)) {
  //   return new Response(JSON.stringify({ error: 'Breaks Sapiens rule' }), { status: 400 });
  // }

  const nextState: State = {
    ...currentState,
    trades: [...currentState.trades, newTrade],
  };

  await store.setJSON('state', nextState);

  return new Response(JSON.stringify({ ok: true, trade: newTrade }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

Now your app has a tiny JSON-backed API:

* `GET /.netlify/functions/get-state` → returns `{ teams, trades }`
* `POST /.netlify/functions/add-trade` → appends a trade to the JSON blob

---

## 8. Hooking the frontend to `get-state` and `add-trade`

In `src/App.tsx`, you can start shaping the UI around this API, for example:

```tsx
import { useEffect, useState } from 'react';
import type { State, Trade } from './types/state';

function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/.netlify/functions/get-state')
      .then((res) => res.json())
      .then((data: State) => setState(data))
      .catch((err) => {
        console.error(err);
        setError('Failed to load state');
      });
  }, []);

  const handleTestTrade = async () => {
    const res = await fetch('/.netlify/functions/add-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromTeamId: 'alex',
        toTeamId: 'matt',
        picks: [{ year: 2027, round: 1, originalOwnerId: 'alex' }],
        notes: 'Test trade from UI',
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to add trade');
      return;
    }

    // Reload state after adding trade
    const fresh = await fetch('/.netlify/functions/get-state').then((r) =>
      r.json()
    );
    setState(fresh);
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Dynasty Draft Picks</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!state && !error && <p>Loading state…</p>}

      {state && (
        <>
          <section>
            <h2>Trades ({state.trades.length})</h2>
            <ul>
              {state.trades.map((t: Trade) => (
                <li key={t.id}>
                  {t.createdAt} — {t.fromTeamId} ➜ {t.toTeamId}{' '}
                  ({t.picks.length} picks)
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

This gives you a working end-to-end flow:

* Click **“Add test trade”**
* `add-trade` writes to the JSON blob
* `get-state` reloads and shows the trade in the list

From here you can replace the test button with a real **“Log a trade”** form and later add:

* a **pick matrix view** (Year × Round × Owner)
* **Sapiens rule** validation inside `add-trade`.

---

## 9. Deploy to Netlify

1. Push the project to GitHub (or GitLab/Bitbucket).
2. In Netlify:

   * Click **“New site from Git”**
   * Choose your repo
   * Set build command: `npm run build`
   * Set publish directory: `dist`
3. Deploy.

Netlify will automatically:

* build the Vite app
* deploy serverless functions from `netlify/functions`
* enable Blobs for the `dynasty-picks` store used above.

---

## 10. Next steps (optional)

* Add a `rebuildOwnership(state)` helper that:

  * starts from “each team owns their own picks”
  * replays `state.trades`
  * outputs a matrix: `year × round × currentOwnerId`
* Add a proper **trade form** with dropdowns for:

  * `fromTeam`, `toTeam`
  * picks (year, round, originalOwner)
* Implement a `validateSapiensRule(trades, newTrade)` function and call it inside `add-trade` before saving.

Once those are in place, you’ve got a fully working, Netlify-hosted, JSON-backed dynasty future-pick tracker.

```

::contentReference[oaicite:0]{index=0}
```
