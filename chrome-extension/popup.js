const scanButton = document.querySelector("#scanButton");
const downloadAllButton = document.querySelector("#downloadAllButton");
const countLabel = document.querySelector("#countLabel");
const pageLabel = document.querySelector("#pageLabel");
const statusBox = document.querySelector("#status");
const resultsList = document.querySelector("#results");
const resultTemplate = document.querySelector("#resultTemplate");

let currentItems = [];

scanButton.addEventListener("click", scanCurrentTab);
downloadAllButton.addEventListener("click", downloadAll);
document.addEventListener("DOMContentLoaded", scanCurrentTab);

async function scanCurrentTab() {
  setBusy(true);
  setStatus("正在扫描页面里的 DOM 和已加载网络资源。");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("没有找到当前标签页。");
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanPageForAudioResources
    });

    currentItems = Array.isArray(result?.items) ? result.items : [];
    pageLabel.textContent = result?.title || tab.title || "当前标签页";
    renderResults(currentItems);

    if (currentItems.length === 0) {
      setStatus("没有发现可下载的音频 URL。可以先播放音频，再点重新扫描。");
    } else {
      setStatus("已合并去重。HLS/DASH 会显示为清单文件，暂不自动拼接分片。");
    }
  } catch (error) {
    currentItems = [];
    renderResults(currentItems);
    setStatus(error.message || "扫描失败。", true);
  } finally {
    setBusy(false);
  }
}

function renderResults(items) {
  countLabel.textContent = String(items.length);
  downloadAllButton.disabled = items.length === 0;
  resultsList.replaceChildren();

  for (const item of items) {
    const row = resultTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector(".resource-title").textContent = item.filename || "untitled-audio";
    row.querySelector(".resource-meta").textContent = [item.kind, item.extension, item.source]
      .filter(Boolean)
      .join(" · ");
    row.querySelector(".resource-url").textContent = item.url;

    const downloadButton = row.querySelector(".download-button");
    downloadButton.addEventListener("click", () => downloadItem(item, downloadButton));

    resultsList.append(row);
  }
}

async function downloadAll() {
  downloadAllButton.disabled = true;
  setStatus(`开始下载 ${currentItems.length} 个资源。`);

  let successCount = 0;
  for (const item of currentItems) {
    const result = await requestDownload(item);
    if (result.ok) {
      successCount += 1;
    }
  }

  setStatus(`已提交 ${successCount}/${currentItems.length} 个下载任务。`);
  downloadAllButton.disabled = currentItems.length === 0;
}

async function downloadItem(item, button) {
  button.disabled = true;
  button.textContent = "提交中";

  const result = await requestDownload(item);
  if (result.ok) {
    button.textContent = "已提交";
    setStatus(`已提交下载：${item.filename}`);
  } else {
    button.disabled = false;
    button.textContent = "下载";
    setStatus(result.error || "下载失败。", true);
  }
}

function requestDownload(item) {
  return chrome.runtime.sendMessage({
    type: "download-audio-resource",
    url: item.url,
    filename: item.filename
  });
}

function setBusy(isBusy) {
  scanButton.disabled = isBusy;
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function scanPageForAudioResources() {
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

    const filename = getFilename(parsed, extension, candidates.size + 1);
    const kind = isStreamExtension ? "stream manifest" : isAudioExtension ? "audio file" : "candidate";
    const existing = candidates.get(url);

    if (existing) {
      existing.source = mergeSource(existing.source, source);
      return;
    }

    candidates.set(url, {
      url,
      filename,
      extension: extension || "unknown",
      kind,
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

  return {
    title: document.title,
    items: Array.from(candidates.values()).sort(sortCandidates)
  };

  function addSrcset(srcset, source) {
    if (!srcset) {
      return;
    }

    srcset.split(",").forEach((part) => {
      addCandidate(part.trim().split(/\s+/)[0], source);
    });
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
