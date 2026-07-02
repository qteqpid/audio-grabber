const DOWNLOAD_FOLDER = "audio-grabber";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "download-audio-resource") {
    return false;
  }

  const url = typeof message.url === "string" ? message.url : "";
  if (!/^https?:\/\//i.test(url)) {
    sendResponse({ ok: false, error: "Only http(s) URLs are supported." });
    return false;
  }

  const filename = buildDownloadFilename(url, message.filename);

  chrome.downloads.download(
    {
      url,
      filename: `${DOWNLOAD_FOLDER}/${filename}`,
      conflictAction: "uniquify",
      saveAs: false
    },
    (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error) {
        sendResponse({ ok: false, error: error.message });
        return;
      }

      sendResponse({ ok: true, downloadId });
    }
  );

  return true;
});

function buildDownloadFilename(url, providedName) {
  const cleanProvided = sanitizeFilename(providedName || "");
  if (cleanProvided) {
    return cleanProvided;
  }

  try {
    const parsed = new URL(url);
    const pathnameName = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    const cleanPathnameName = sanitizeFilename(pathnameName);

    if (cleanPathnameName) {
      return cleanPathnameName;
    }
  } catch (_error) {
    // Fall through to a timestamped default.
  }

  return `audio-${Date.now()}.bin`;
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
