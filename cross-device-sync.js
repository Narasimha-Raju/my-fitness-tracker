/*
  Cross-device sync for My Fitness Tracker
  ----------------------------------------
  Add this script to index.html, diet-tracker.html and
  workout-tracker.html AFTER fitness-cloud.js.

  It uses the existing Supabase user_app_data table for
  cross-device synchronization and keeps localStorage
  as the local/offline cache.
*/

(function () {
  "use strict";

  let cloudReady = false;
  let currentUser = null;
  let syncing = false;
  let saveTimer = null;

  const SYNC_PREFIXES = [
    "fatloss-tracker-v3-",
    "workout-tracker-v2-"
  ];

  const SYNC_EXACT_KEYS = [
    "fatloss-saved-items-v1",
    "fatloss-saved-recipes-v1",
    "fatloss-custom-foods",
    "fatloss-saved-items-v2",
    "fatloss-saved-recipes-v2"
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function isSyncableKey(key) {
    if (!key) return false;

    return (
      SYNC_EXACT_KEYS.includes(key) ||
      SYNC_PREFIXES.some(prefix => key.startsWith(prefix))
    );
  }

  function getCurrentPage() {
    const file = location.pathname.split("/").pop();
    return file || "index.html";
  }

  function readSyncableLocalStorage() {
    const storage = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!isSyncableKey(key)) continue;

      const value = localStorage.getItem(key);

      if (value === null) continue;

      storage[key] = {
        value,
        updatedAt: Date.now()
      };
    }

    return storage;
  }

  function restoreStorage(storage) {
    if (!storage || typeof storage !== "object") return;

    Object.entries(storage).forEach(([key, entry]) => {
      if (!isSyncableKey(key)) return;
      if (!entry || typeof entry.value !== "string") return;

      try {
        localStorage.setItem(key, entry.value);
      } catch (error) {
        console.warn(
          "Unable to restore synced localStorage key:",
          key,
          error
        );
      }
    });
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function getCloudData() {
    if (!cloudReady || !window.FitnessCloud) {
      return Promise.resolve({});
    }

    return window.FitnessCloud
      .loadAppData()
      .then(data => data || {});
  }

  function saveCloudData(data) {
    if (!cloudReady || !window.FitnessCloud) {
      return Promise.resolve(false);
    }

    return window.FitnessCloud.saveAppData(data);
  }

  /*
    Important first-login behavior:

    Cloud data wins when the same key exists in both places.
    This prevents an empty/new desktop localStorage from
    overwriting the data that already exists on the phone.

    Local-only keys are uploaded to the cloud.
  */
  function mergeStorage(localStorageData, cloudStorageData) {
    const merged = {};

    const keys = new Set([
      ...Object.keys(localStorageData || {}),
      ...Object.keys(cloudStorageData || {})
    ]);

    keys.forEach(key => {
      const localEntry = localStorageData?.[key];
      const cloudEntry = cloudStorageData?.[key];

      if (cloudEntry && typeof cloudEntry.value === "string") {
        merged[key] = cloudEntry;
        return;
      }

      if (localEntry && typeof localEntry.value === "string") {
        merged[key] = localEntry;
      }
    });

    return merged;
  }

  function setSyncButton(mode, message) {
    const button = document.getElementById("fitnessSyncButton");

    if (!button) return;

    if (mode === "cloud") {
      button.textContent = "☁ Synced";
    } else if (mode === "error") {
      button.textContent = "⚠ Sync issue";
    } else {
      button.textContent = "☁ Sign in to sync";
    }

    button.title = message || "";
  }

  function setModalStatus(message) {
    const status = document.getElementById(
      "fitnessSyncModalStatus"
    );

    if (status) {
      status.textContent = message || "";
    }
  }

  /*
    Full synchronization.

    1. Read cloud data.
    2. Read current browser localStorage.
    3. Restore cloud data to this browser.
    4. Upload any local-only data.
    5. Keep the merged result in Supabase.
  */
  async function fullSync() {
    if (!cloudReady || syncing) return;

    syncing = true;

    try {
      const cloudData = await getCloudData();
      const localData = readSyncableLocalStorage();

      const mergedStorage = mergeStorage(
        localData,
        cloudData.storage || {}
      );

      restoreStorage(mergedStorage);

      await saveCloudData({
        ...cloudData,
        storage: mergedStorage,
        storageVersion: 1,
        lastSyncedAt: new Date().toISOString()
      });

      setSyncButton(
        "cloud",
        "Your data is synchronized with Supabase."
      );

      /*
        Tell the currently open tracker to reload its state
        after cloud data has been restored.
      */
      window.dispatchEvent(
        new CustomEvent("fitness-cloud-restored")
      );

    } catch (error) {
      console.error("Cross-device sync failed:", error);

      setSyncButton(
        "error",
        "Cloud sync failed. Local data is still safe."
      );
    } finally {
      syncing = false;
    }
  }

  /*
    Push the current browser data to Supabase after local changes.

    This runs after a short debounce so typing/changing quantity
    does not create hundreds of requests.
  */
  function scheduleCloudSave() {
    if (!cloudReady) return;

    clearTimeout(saveTimer);

    saveTimer = setTimeout(async () => {
      try {
        const cloudData = await getCloudData();
        const localData = readSyncableLocalStorage();

        const mergedStorage = {
          ...(cloudData.storage || {}),
          ...localData
        };

        await saveCloudData({
          ...cloudData,
          storage: mergedStorage,
          storageVersion: 1,
          lastSyncedAt: new Date().toISOString()
        });

        setSyncButton("cloud", "Synced");

      } catch (error) {
        console.error(
          "Background cloud synchronization failed:",
          error
        );

        setSyncButton(
          "error",
          "Saved locally. Cloud sync will retry."
        );
      }
    }, 700);
  }

  /*
    Observe localStorage writes made by the existing tracker pages.

    This means you don't need to rewrite every existing save()
    or persist() call just for cloud synchronization.
  */
  function patchLocalStorage() {
    if (window.__fitnessCrossDeviceStoragePatched) {
      return;
    }

    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);

      if (
        this === localStorage &&
        isSyncableKey(key) &&
        cloudReady
      ) {
        scheduleCloudSave();
      }
    };

    Storage.prototype.removeItem = function (key) {
      originalRemoveItem.call(this, key);

      if (
        this === localStorage &&
        isSyncableKey(key) &&
        cloudReady
      ) {
        scheduleCloudSave();
      }
    };

    window.__fitnessCrossDeviceStoragePatched = true;
  }

  /*
    -----------------------------
    AUTH UI
    -----------------------------
  */

  function injectSyncUI() {
    if (document.getElementById("fitnessSyncButton")) {
      return;
    }

    const nav =
      document.querySelector(".site-nav") ||
      document.querySelector(".nav");

    if (!nav) {
      return;
    }

    const button = document.createElement("button");

    button.id = "fitnessSyncButton";
    button.type = "button";
    button.textContent = "☁ Sign in to sync";

    button.style.cssText = `
      border:1px solid #dbe3ee;
      background:#fff;
      color:#334155;
      border-radius:10px;
      padding:8px 11px;
      font:800 11px system-ui;
      white-space:nowrap;
      cursor:pointer;
    `;

    button.addEventListener("click", openSyncModal);

    nav.appendChild(button);

    const style = document.createElement("style");

    style.textContent = `
      #fitnessSyncModal {
        position:fixed;
        inset:0;
        z-index:99999;
        display:none;
        align-items:center;
        justify-content:center;
        padding:16px;
        background:rgba(8,18,35,.58);
        backdrop-filter:blur(6px);
      }

      #fitnessSyncModal.open {
        display:flex;
      }

      .fitness-sync-card {
        width:min(430px,100%);
        background:#fff;
        border-radius:18px;
        padding:20px;
        box-shadow:0 30px 90px rgba(0,0,0,.28);
      }

      .fitness-sync-card h3 {
        margin:0 0 6px;
        font-size:20px;
        color:#172033;
      }

      .fitness-sync-card p {
        margin:0 0 14px;
        font-size:11px;
        color:#718096;
        line-height:1.55;
      }

      .fitness-sync-card input {
        width:100%;
        box-sizing:border-box;
        min-height:42px;
        margin:5px 0;
        border:1px solid #dfe5ee;
        border-radius:10px;
        padding:9px;
      }

      .fitness-sync-actions {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:10px;
      }

      .fitness-sync-actions button {
        border:1px solid #dfe5ee;
        border-radius:10px;
        padding:9px 12px;
        font-weight:800;
        background:#fff;
        color:#334155;
      }

      .fitness-sync-actions .primary {
        background:#2563eb;
        color:#fff;
        border-color:#2563eb;
      }

      .fitness-sync-user {
        font-size:12px;
        font-weight:800;
        color:#334155;
        padding:10px 12px;
        border-radius:10px;
        background:#f8fafc;
      }

      #fitnessSyncModalStatus {
        margin-top:10px;
        min-height:18px;
        font-size:11px;
        color:#64748b;
      }

      @media(max-width:600px) {
        .fitness-sync-card {
          padding:16px;
          border-radius:16px;
        }
      }
    `;

    document.head.appendChild(style);

    const modal = document.createElement("div");

    modal.id = "fitnessSyncModal";

    modal.innerHTML = `
      <div class="fitness-sync-card">

        <h3>☁ Cross-device Sync</h3>

        <p>
          Sign in with the same account on your phone and desktop.
          Your saved foods, recipes, diet logs and workout logs
          will then be available on both devices.
        </p>

        <div id="fitnessSyncForm">

          <input
            id="fitnessSyncEmail"
            type="email"
            autocomplete="email"
            placeholder="Email"
          >

          <input
            id="fitnessSyncPassword"
            type="password"
            autocomplete="current-password"
            placeholder="Password"
          >

          <div class="fitness-sync-actions">
            <button
              class="primary"
              id="fitnessSyncSignIn"
            >
              Sign in
            </button>

            <button id="fitnessSyncSignUp">
              Create account
            </button>

            <button id="fitnessSyncClose">
              Close
            </button>
          </div>

        </div>

        <div
          id="fitnessSyncSigned"
          style="display:none"
        >

          <div
            class="fitness-sync-user"
            id="fitnessSyncUser"
          ></div>

          <div class="fitness-sync-actions">

            <button
              class="primary"
              id="fitnessSyncNow"
            >
              Sync now
            </button>

            <button id="fitnessSyncSignOut">
              Sign out
            </button>

            <button id="fitnessSyncClose2">
              Close
            </button>

          </div>

        </div>

        <div id="fitnessSyncModalStatus"></div>

      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById(
      "fitnessSyncClose"
    ).onclick = closeSyncModal;

    document.getElementById(
      "fitnessSyncClose2"
    ).onclick = closeSyncModal;

    document.getElementById(
      "fitnessSyncSignIn"
    ).onclick = () => authenticate("signin");

    document.getElementById(
      "fitnessSyncSignUp"
    ).onclick = () => authenticate("signup");

    document.getElementById(
      "fitnessSyncSignOut"
    ).onclick = signOut;

    document.getElementById(
      "fitnessSyncNow"
    ).onclick = fullSync;

    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeSyncModal();
      }
    });
  }

  async function authenticate(mode) {
    const email =
      document.getElementById(
        "fitnessSyncEmail"
      ).value.trim();

    const password =
      document.getElementById(
        "fitnessSyncPassword"
      ).value;

    if (!email || password.length < 6) {
      setModalStatus(
        "Enter a valid email and a password with at least 6 characters."
      );

      return;
    }

    setModalStatus(
      mode === "signin"
        ? "Signing in..."
        : "Creating account..."
    );

    try {
      const result =
        mode === "signin"
          ? await window.FitnessCloud.signIn(
              email,
              password
            )
          : await window.FitnessCloud.signUp(
              email,
              password
            );

      currentUser =
        result?.user ||
        result?.session?.user ||
        await window.FitnessCloud.session();

      if (!currentUser) {
        setModalStatus(
          "Account created. Confirm your email if required, then sign in."
        );

        return;
      }

      cloudReady = true;

      patchLocalStorage();

      await fullSync();

      updateAccountModal();

      setModalStatus(
        "Sync is active on this device."
      );

    } catch (error) {
      console.error(error);

      setModalStatus(
        error?.message ||
        "Unable to sign in. Please try again."
      );
    }
  }

  async function signOut() {
    try {
      await window.FitnessCloud.signOut();
    } catch (error) {
      console.warn(
        "Sign-out error:",
        error
      );
    }

    currentUser = null;
    cloudReady = false;

    setSyncButton(
      "signin",
      "Sign in to sync across devices"
    );

    updateAccountModal();
  }

  function updateAccountModal() {
    const form =
      document.getElementById(
        "fitnessSyncForm"
      );

    const signed =
      document.getElementById(
        "fitnessSyncSigned"
      );

    const user =
      document.getElementById(
        "fitnessSyncUser"
      );

    if (!form || !signed) return;

    const signedIn = !!currentUser;

    form.style.display =
      signedIn ? "none" : "block";

    signed.style.display =
      signedIn ? "block" : "none";

    if (signedIn && user) {
      user.textContent =
        "Signed in as " +
        (currentUser.email || "your account");
    }
  }

  function openSyncModal() {
    const modal =
      document.getElementById(
        "fitnessSyncModal"
      );

    if (!modal) return;

    modal.classList.add("open");

    updateAccountModal();

    setModalStatus(
      currentUser
        ? "Your data is synchronized with the cloud."
        : "Use the same account on your phone and desktop."
    );
  }

  function closeSyncModal() {
    document
      .getElementById("fitnessSyncModal")
      ?.classList.remove("open");
  }

  /*
    -----------------------------
    INITIALIZATION
    -----------------------------
  */

  async function boot() {
    injectSyncUI();

    try {
      /*
        Load the existing Supabase configuration.
      */
      if (!window.SUPABASE_CONFIG) {
        await loadScript("config.js");
      }

      /*
        Load Supabase JS if it is not already loaded.
      */
      if (!window.supabase?.createClient) {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        );
      }

      /*
        Load the existing cloud helper.
      */
      if (!window.FitnessCloud) {
        await loadScript("fitness-cloud.js");
      }

      if (
        !window.FitnessCloud ||
        !window.FitnessCloud.isConfigured()
      ) {
        setSyncButton(
          "signin",
          "Supabase is not configured."
        );

        return;
      }

      /*
        Check whether the user is already logged in.
      */
      currentUser =
        await window.FitnessCloud.session();

      cloudReady = !!currentUser;

      patchLocalStorage();

      if (cloudReady) {
        /*
          This is the important part:

          When the user opens the site on a different device,
          the cloud copy is restored into that device's localStorage.
        */
        await fullSync();
      } else {
        setSyncButton(
          "signin",
          "Sign in to sync between phone and desktop."
        );
      }

    } catch (error) {
      console.error(
        "Cross-device sync initialization failed:",
        error
      );

      setSyncButton(
        "signin",
        "Cloud sync is unavailable."
      );
    }
  }

  /*
    Public API in case you need a manual sync button later.
  */
  window.FitnessCrossDeviceSync = {
    syncNow: fullSync,
    open: openSyncModal,
    isReady: () => cloudReady
  };

  /*
    Start after the existing page has loaded.
  */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      boot
    );
  } else {
    boot();
  }

})();