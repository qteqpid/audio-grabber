function audioGrabberBookmarklet() {
  const PANEL_ID = "audio-grabber-bookmarklet-panel";
  const STYLE_ID = "audio-grabber-bookmarklet-style";

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

  const items = scanPage();
  renderPanel(items);

  function scanPage() {
    const candidates = new Map();

    const addCandidate = (rawUrl, source, options = {}) => {
      if (!rawUrl || typeof rawUrl !== "string") {
        return;
      }

      const trimmedUrl = rawUrl.trim();
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
      const lowerUrl = url.toLowerCase();
      const isAudioExtension = audioExtensions.has(extension);
      const isStreamExtension = streamExtensions.has(extension);
      const hasAudioHint = /(?:audio|podcast|sound|media|listen|track|mp3|m4a|aac|wav|ogg|opus|flac|m3u8|mpd)/i.test(lowerUrl);
      const strongSource = /^(audio|video|source|network:audio|network:video|srcset)/.test(source);

      if (!isAudioExtension && !isStreamExtension && !hasAudioHint && !strongSource && !options.force) {
        return;
      }

      const existing = candidates.get(url);
      if (existing) {
        existing.source = mergeSource(existing.source, source);
        return;
      }

      candidates.set(url, {
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

    document.querySelectorAll("source").forEach((element) => {
      addCandidate(element.src, "source", { force: true });
      addCandidate(element.getAttribute("src"), "source", { force: true });
      addSrcset(element.getAttribute("srcset"), "srcset");
    });

    document.querySelectorAll("[src], [href], [data-src], [data-url], [data-href], [srcset]").forEach((element) => {
      for (const attr of ["src", "href", "data-src", "data-url", "data-href"]) {
        addCandidate(element.getAttribute(attr), `${element.localName}:${attr}`);
      }
      addSrcset(element.getAttribute("srcset"), "srcset");
    });

    performance.getEntriesByType("resource").forEach((entry) => {
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
  }

  function renderPanel(results) {
    ensureStyle();

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
          <button type="button" data-action="copy-all">Copy all</button>
          <button type="button" data-action="close" aria-label="Close">x</button>
        </div>
      </div>
      <p class="ag-note">If nothing appears, play the audio for a few seconds, then run this again.</p>
      <div class="ag-list"></div>
    `;

    const list = panel.querySelector(".ag-list");
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

    panel.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = target.getAttribute("data-action");
      if (action === "close") {
        panel.remove();
      }

      if (action === "copy-all") {
        await copyText(results.map((item) => item.url).join("\n"));
        target.textContent = "Copied";
        setTimeout(() => {
          target.textContent = "Copy all";
        }, 1200);
      }

      if (action === "copy-one") {
        const url = target.closest(".ag-row")?.getAttribute("data-url");
        if (url) {
          await copyText(url);
          target.textContent = "Copied";
          setTimeout(() => {
            target.textContent = "Copy";
          }, 1200);
        }
      }
    });

    document.documentElement.append(panel);
  }

  function createResultRow(item) {
    const row = document.createElement("article");
    row.className = "ag-row";
    row.setAttribute("data-url", item.url);

    const title = document.createElement("div");
    title.className = "ag-title";
    title.textContent = item.filename;

    const meta = document.createElement("div");
    meta.className = "ag-meta";
    meta.textContent = [item.kind, item.extension, item.source].filter(Boolean).join(" · ");

    const url = document.createElement("div");
    url.className = "ag-url";
    url.textContent = item.url;

    const actions = document.createElement("div");
    actions.className = "ag-row-actions";

    const openLink = document.createElement("a");
    openLink.href = item.url;
    openLink.download = item.filename;
    openLink.target = "_blank";
    openLink.rel = "noreferrer";
    openLink.textContent = "Open";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.setAttribute("data-action", "copy-one");
    copyButton.textContent = "Copy";

    actions.append(openLink, copyButton);
    row.append(title, meta, url, actions);
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

      #${PANEL_ID} .ag-header,
      #${PANEL_ID} .ag-row-actions {
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
      #${PANEL_ID} .ag-meta,
      #${PANEL_ID} .ag-url {
        color: #68604f;
      }

      #${PANEL_ID} .ag-actions {
        display: flex;
        gap: 8px;
      }

      #${PANEL_ID} button,
      #${PANEL_ID} a {
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
        gap: 8px;
        overflow: auto;
        padding-right: 2px;
      }

      #${PANEL_ID} .ag-row,
      #${PANEL_ID} .ag-empty {
        display: grid;
        gap: 5px;
        padding: 10px;
        background: #f6f1e8;
        border: 1px solid #d7cbb7;
        border-radius: 8px;
      }

      #${PANEL_ID} .ag-title {
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      #${PANEL_ID} .ag-meta {
        font-size: 12px;
      }

      #${PANEL_ID} .ag-url {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
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
