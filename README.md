# My Fitness Tracker

## Why sign-in previously failed
The earlier page was only a frontend. The new version is wired to Supabase, but you must connect it to your own Supabase project first.

### 1. Create a Supabase project
Create a project at https://supabase.com/

### 2. Create the database
Open **SQL Editor** in Supabase and run `supabase_setup.sql`.

### 3. Get the browser-safe API key
In Supabase Project Settings / API, copy the project URL and the browser-safe **publishable/anon** key. Never use a `service_role` or secret key in `config.js`.

Create a file named `config.js` beside `index.html`:

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
};
```

### 4. Configure Auth
In Supabase Auth settings:
- Enable Email/password sign-in.
- Decide whether email confirmation is required.
- Add your GitHub Pages URL to **Site URL**.
- Add the same published URL to **Redirect URLs**.

Example:
`https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`

For email confirmation/passwordless redirect behavior, Supabase uses the configured Site URL / allowed Redirect URLs. 

### 5. Deploy the static site
Upload all files from this folder to the same GitHub repository used by your GitHub Pages site. GitHub Pages hosts the frontend; Supabase provides the authenticated cloud database.

### 6. Use the same account everywhere
Sign in with the same email/password on your computer and phone. Daily diet/workout records are saved by user + date in Supabase, so they are shared across devices.

### 7. Import old data
On Home, click **Import old browser data** once after signing in. This imports records from the previous localStorage-based tracker.

## Important
`config.js` contains only the browser-safe publishable/anon key. Do not put secret/service-role keys in the repository.
