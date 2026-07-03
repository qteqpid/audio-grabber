function audioGrabberBookmarklet() {
  const PANEL_ID = "audio-grabber-bookmarklet-panel";
  const STYLE_ID = "audio-grabber-bookmarklet-style";
  const STORAGE_KEY = "audio-grabber-bookmarklet-items";

  const existingPanel = document.getElementById(PANEL_ID);
  if (existingPanel) {
    existingPanel.remove();
    return;
  }

  const audioExtensions = new Set([
    "mp3",
    "m4a",
    "aac",
    "wav",
    "ogg",
    "oga",
    "opus",
    "flac",
    "weba",
    "webm",
    "aiff",
    "aif",
    "amr",
    "mid",
    "midi"
  ]);
  const streamExtensions = new Set(["m3u8", "mpd"]);
  const ignoredExtensions = new Set([
    "css",
    "html",
    "htm",
    "js",
    "mjs",
    "json",
    "map",
    "xml",
    "txt",
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "avif",
    "svg",
    "ico",
    "woff",
    "woff2",
    "ttf",
    "otf"
  ]);
  const ignoredNetworkInitiators = new Set(["css", "script", "link", "img", "image", "beacon"]);

  const items = mergeResults(loadStoredItems(), scanPage());
  saveStoredItems(items);
  renderPanel(items);

  function scanPage() {
    if (performance.setResourceTimingBufferSize) {
      performance.setResourceTimingBufferSize(5000);
    }

    const candidates = new Map();

    const addCandidate = (rawUrl, source, options = {}) => {
      if (!rawUrl || typeof rawUrl !== "string") {
        return;
      }

      const trimmedUrl = normalizeCandidateUrl(rawUrl).trim();
      if (!trimmedUrl || trimmedUrl.startsWith("data:")) {
        return;
      }

      let parsed;
      try {
        parsed = new URL(trimmedUrl, document.baseURI);
      } catch (_error) {
        return;
      }

      if (!["http:", "https:"].includes(parsed.protocol)) {
        return;
      }

      const url = parsed.href.split("#")[0];
      const extension = getExtension(parsed);
      if (ignoredExtensions.has(extension)) {
        return;
      }

      const isAudioExtension = audioExtensions.has(extension);
      const isStreamExtension = streamExtensions.has(extension);
      const hasAudioMime = /^(audio\/|application\/(?:ogg|dash\+xml|vnd\.apple\.mpegurl)|application\/x-mpegurl)/i.test(options.type || "");
      const strongSource = /^(audio|video|audio:source|video:source|network:audio|network:video)/.test(source);

      if (!isAudioExtension && !isStreamExtension && !hasAudioMime && !strongSource && !options.force) {
        return;
      }

      const dedupeKey = getDedupeKey(parsed, url, {
        isAudioExtension,
        isStreamExtension,
        hasAudioMime,
        strongSource
      });
      const existing = candidates.get(dedupeKey);
      if (existing) {
        existing.source = mergeSource(existing.source, source);
        return;
      }

      candidates.set(dedupeKey, {
        url,
        filename: getFilename(parsed, extension, candidates.size + 1),
        extension: extension || "unknown",
        kind: isStreamExtension ? "stream manifest" : isAudioExtension ? "audio file" : "candidate",
        source
      });
    };

    document.querySelectorAll("audio, video").forEach((element) => {
      addCandidate(element.currentSrc, element.localName, { force: true });
      addCandidate(element.getAttribute("src"), element.localName, { force: true });
    });

    document.querySelectorAll("audio source, video source").forEach((element) => {
      const parentName = element.parentElement?.localName || "media";
      const source = `${parentName}:source`;
      const type = element.getAttribute("type") || "";

      addCandidate(element.src, source, { force: true, type });
      addCandidate(element.getAttribute("src"), source, { force: true, type });
      addSrcset(element.getAttribute("srcset"), source);
    });

    document.querySelectorAll("[src], [href], [data-src], [data-url], [data-href], [srcset]").forEach((element) => {
      for (const attr of ["src", "href", "data-src", "data-url", "data-href"]) {
        addCandidate(element.getAttribute(attr), `${element.localName}:${attr}`);
      }
      addSrcset(element.getAttribute("srcset"), "srcset");
    });

    document.querySelectorAll("script").forEach((element) => {
      addUrlsFromText(element.textContent || "", "script:text");
    });

    performance.getEntriesByType("resource").forEach((entry) => {
      if (ignoredNetworkInitiators.has(entry.initiatorType)) {
        return;
      }

      const source = `network:${entry.initiatorType || "resource"}`;
      addCandidate(entry.name, source, {
        force: entry.initiatorType === "audio" || entry.initiatorType === "video"
      });
    });

    return Array.from(candidates.values()).sort(sortCandidates);

    function addSrcset(srcset, source) {
      if (!srcset) {
        return;
      }

      srcset.split(",").forEach((part) => {
        addCandidate(part.trim().split(/\s+/)[0], source);
      });
    }

    function addUrlsFromText(text, source) {
      if (!text) {
        return;
      }

      const normalizedText = normalizeCandidateUrl(text);
      const audioUrlPattern = /https?:\/\/[^\s"'<>`\\]+?\.(?:mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm|aiff|aif|amr|mid|midi|m3u8|mpd)(?:\?[^"'<>`\s\\]*)?/gi;
      const matches = normalizedText.match(audioUrlPattern) || [];
      matches.forEach((url) => addCandidate(url, source));
    }
  }

  function renderPanel(results) {
    ensureStyle();
    let currentResults = results;

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Audio Grabber");
    panel.innerHTML = `
      <div class="ag-header">
        <div>
          <strong>Audio Grabber</strong>
          <span>${results.length} candidates</span>
        </div>
        <div class="ag-actions">
          <button type="button" data-action="rescan">Rescan</button>
          <button type="button" data-action="clear-all">Clear all</button>
          <button type="button" data-action="copy-all">Copy all</button>
          <button type="button" data-action="close" aria-label="Close">x</button>
        </div>
      </div>
      <p class="ag-note">If nothing appears, play the audio for a few seconds, then run this again.</p>
      <div class="ag-list"></div>
    `;

    const list = panel.querySelector(".ag-list");
    renderResultsList(list, currentResults);

    panel.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = target.getAttribute("data-action");
      if (action === "close") {
        panel.remove();
      }

      if (action === "rescan") {
        currentResults = mergeResults(currentResults, scanPage());
        saveStoredItems(currentResults);
        updateCount();
        renderResultsList(list, currentResults);
        target.textContent = "Scanned";
        setTimeout(() => {
          target.textContent = "Rescan";
        }, 1200);
      }

      if (action === "clear-all") {
        currentResults = [];
        clearStoredItems();
        updateCount();
        renderResultsList(list, currentResults);
        target.textContent = "Cleared";
        setTimeout(() => {
          target.textContent = "Clear all";
        }, 1200);
      }

      if (action === "copy-all") {
        await copyText(currentResults.map((item) => item.url).join("\n"));
        target.textContent = "Copied";
        setTimeout(() => {
          target.textContent = "Copy all";
        }, 1200);
      }

      if (action === "download-one") {
        const row = target.closest(".ag-row");
        const url = row?.getAttribute("data-url");
        const filename = row?.getAttribute("data-filename") || "";
        if (url) {
          triggerDownload(url, filename);
          target.textContent = "Started";
          setTimeout(() => {
            target.textContent = "Download";
          }, 1200);
        }
      }
    });

    document.documentElement.append(panel);

    function updateCount() {
      panel.querySelector(".ag-header span").textContent = `${currentResults.length} candidates`;
    }
  }

  function loadStoredItems() {
    try {
      const storedItems = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(storedItems)) {
        return [];
      }

      return storedItems
        .filter((item) => item && typeof item.url === "string")
        .map(normalizeStoredItem);
    } catch (_error) {
      return [];
    }
  }

  function saveStoredItems(items) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(normalizeStoredItem)));
    } catch (_error) {
      // Some pages disable localStorage; keep the in-memory panel usable.
    }
  }

  function clearStoredItems() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      // Some pages disable localStorage; clearing the in-memory list is still useful.
    }
  }

  function mergeResults(leftItems, rightItems) {
    const merged = new Map();

    const addItem = (item) => {
      const normalizedItem = normalizeStoredItem(item);
      if (!normalizedItem.url) {
        return;
      }

      const key = normalizedItem.url;
      const existing = merged.get(key);
      if (existing) {
        existing.source = mergeSource(existing.source, normalizedItem.source);
        existing.filename = existing.filename || normalizedItem.filename;
        existing.extension = existing.extension === "unknown" ? normalizedItem.extension : existing.extension;
        existing.kind = existing.kind === "candidate" ? normalizedItem.kind : existing.kind;
        return;
      }

      merged.set(key, normalizedItem);
    };

    leftItems.forEach(addItem);
    rightItems.forEach(addItem);

    return Array.from(merged.values()).sort(sortCandidates);
  }

  function normalizeStoredItem(item) {
    return {
      url: typeof item.url === "string" ? item.url : "",
      filename: typeof item.filename === "string" && item.filename ? item.filename : "untitled-audio",
      extension: typeof item.extension === "string" && item.extension ? item.extension : "unknown",
      kind: typeof item.kind === "string" && item.kind ? item.kind : "candidate",
      source: typeof item.source === "string" && item.source ? item.source : "stored"
    };
  }

  function renderResultsList(list, results) {
    list.replaceChildren();

    if (results.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ag-empty";
      empty.textContent = "No downloadable http(s) audio URLs were found.";
      list.append(empty);
    } else {
      for (const item of results) {
        list.append(createResultRow(item));
      }
    }
  }

  function createResultRow(item) {
    const row = document.createElement("article");
    row.className = "ag-row";
    row.setAttribute("data-url", item.url);
    row.setAttribute("data-filename", item.filename);

    const title = document.createElement("div");
    title.className = "ag-title";
    title.textContent = item.filename;

    const url = document.createElement("a");
    url.className = "ag-url";
    url.href = item.url;
    url.target = "_blank";
    url.rel = "noreferrer";
    url.textContent = item.url;

    const actions = document.createElement("div");
    actions.className = "ag-row-actions";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.setAttribute("data-action", "download-one");
    downloadButton.textContent = "Download";

    actions.append(downloadButton);
    row.append(title, url, actions);
    return row;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        z-index: 2147483647;
        right: 18px;
        bottom: 18px;
        width: min(520px, calc(100vw - 36px));
        max-height: min(680px, calc(100vh - 36px));
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        gap: 10px;
        padding: 14px;
        color: #171717;
        background: #fffaf0;
        border: 1px solid #d7cbb7;
        border-radius: 8px;
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.28);
        font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      #${PANEL_ID} * {
        box-sizing: border-box;
      }

      #${PANEL_ID} .ag-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      #${PANEL_ID} .ag-header strong {
        display: block;
        font-size: 18px;
        line-height: 1.1;
      }

      #${PANEL_ID} .ag-header span,
      #${PANEL_ID} .ag-note,
      #${PANEL_ID} .ag-url {
        color: #68604f;
      }

      #${PANEL_ID} .ag-actions {
        display: flex;
        gap: 8px;
      }

      #${PANEL_ID} button,
      #${PANEL_ID} .ag-actions a,
      #${PANEL_ID} .ag-row-actions a {
        min-height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
        color: #fff;
        background: #007f7a;
        border: 0;
        border-radius: 6px;
        text-decoration: none;
        font: inherit;
        cursor: pointer;
      }

      #${PANEL_ID} button[data-action="close"] {
        width: 30px;
        padding: 0;
        background: #171717;
      }

      #${PANEL_ID} .ag-note {
        margin: 0;
      }

      #${PANEL_ID} .ag-list {
        display: grid;
        gap: 6px;
        overflow: auto;
        padding-right: 2px;
      }

      #${PANEL_ID} .ag-row,
      #${PANEL_ID} .ag-empty {
        display: grid;
        grid-template-columns: minmax(0, 1fr) max-content;
        grid-template-areas:
          "title actions"
          "url url";
        column-gap: 10px;
        row-gap: 3px;
        align-items: start;
        padding: 8px 9px;
        background: #f6f1e8;
        border: 1px solid #d7cbb7;
        border-radius: 8px;
      }

      #${PANEL_ID} .ag-empty {
        display: block;
      }

      #${PANEL_ID} .ag-title {
        grid-area: title;
        font-weight: 700;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }

      #${PANEL_ID} .ag-url {
        grid-area: url;
        display: block;
        min-height: 0;
        width: 100%;
        padding: 0;
        color: #68604f;
        background: transparent;
        border: 0;
        border-radius: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
        line-height: 1.25;
        max-width: 100%;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      #${PANEL_ID} .ag-url:hover {
        color: #007f7a;
        text-decoration: underline;
      }

      #${PANEL_ID} .ag-row-actions {
        grid-area: actions;
        align-self: start;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        gap: 5px;
        white-space: nowrap;
      }

      #${PANEL_ID} .ag-row-actions button {
        min-height: 24px;
        padding: 0 7px;
        font-size: 11px;
        line-height: 1;
      }
    `;
    document.documentElement.append(style);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function triggerDownload(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
  }

  function getExtension(parsed) {
    const pathname = parsed.pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match) {
      return match[1];
    }

    for (const [_key, value] of parsed.searchParams) {
      const valueMatch = String(value).toLowerCase().match(/(?:^|\.)(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm|m3u8|mpd)(?:$|[?&#])/);
      if (valueMatch) {
        return valueMatch[1];
      }
    }

    return "";
  }

  function normalizeCandidateUrl(rawUrl) {
    return String(rawUrl)
      .replace(/\\u002f/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&");
  }

  function getDedupeKey(parsed, url, evidence) {
    if (evidence.isAudioExtension || evidence.isStreamExtension || evidence.hasAudioMime || evidence.strongSource) {
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase();
    }

    return url;
  }

  function getFilename(parsed, extension, index) {
    const rawName = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    const basename = rawName && rawName.includes(".") ? rawName : `audio-resource-${index}`;
    const withExtension = extension && !basename.toLowerCase().endsWith(`.${extension}`) ? `${basename}.${extension}` : basename;

    return withExtension
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  }

  function mergeSource(left, right) {
    return Array.from(new Set(`${left},${right}`.split(",").map((value) => value.trim()).filter(Boolean))).join(",");
  }

  function sortCandidates(left, right) {
    const score = (item) => {
      if (item.kind === "audio file") {
        return 0;
      }
      if (item.kind === "stream manifest") {
        return 1;
      }
      return 2;
    };

    return score(left) - score(right) || left.filename.localeCompare(right.filename);
  }
}

if (typeof window !== "undefined") {
  window.audioGrabberBookmarklet = audioGrabberBookmarklet;
}
