# Audio Resource Grabber

[中文](#中文) · [English](#english)

## 中文

一个轻量的网页音频 URL 抓取工具。它不会解析网站后端，也不会绕过权限；它只在当前页面和浏览器已加载资源记录里，整理出可能可直接访问的音频文件或流媒体清单地址。

项目提供两种入口：

- **Bookmarklet**：拖到书签栏即可用，不需要安装扩展。
- **Chrome Extension**：Manifest V3 本地扩展，支持在弹窗里扫描并批量提交下载。

### 什么时候用它

- 你在网页上能播放音频，但想找到原始音频 URL。
- 你只需要页面已经暴露给浏览器的资源地址。
- 你的 Chrome 被公司策略限制，不能加载本地扩展时，可以改用 Bookmarklet。

### 快速开始

#### Bookmarklet

1. 打开 `bookmarklet/bookmarklet.html`。
2. 把页面里的 `Audio Grabber` 链接拖到浏览器书签栏。
3. 进入目标网页，先播放音频几秒。
4. 点击书签栏里的 `Audio Grabber`。
5. 在页面右下角面板中复制、打开或下载候选 URL。

如果 bookmarklet 被浏览器策略拦截，可以在 `bookmarklet/bookmarklet.html` 里复制 Console 代码，然后粘贴到目标网页的 DevTools Console 运行。

#### Chrome Extension

1. 打开 `chrome://extensions`。
2. 开启 **Developer mode**。
3. 点击 **Load unpacked**。
4. 选择 `chrome-extension/`。
5. 进入目标网页，先播放音频几秒。
6. 点击扩展按钮扫描当前标签页。

扩展会通过 Chrome 下载管理器提交下载任务，文件默认进入下载目录下的 `audio-grabber/` 子目录。

### 两种方案对比

| 方案 | 优点 | 注意事项 |
| --- | --- | --- |
| Bookmarklet | 不需要安装扩展；适合临时使用或受管浏览器 | 下载由页面内临时链接触发 |
| Chrome Extension | 有弹窗界面；支持单个下载和全部下载 | 需要 Chrome 允许加载本地扩展 |

### 能扫描什么

扫描范围来自当前页面可访问的信息：

- `<audio>`、`<video>` 的 `currentSrc` 和 `src`。
- 媒体元素内部 `<source>` 的 `src` 和 `srcset`。
- 页面元素上的 `src`、`href`、`data-src`、`data-url`、`data-href`、`srcset`。
- `performance.getEntriesByType("resource")` 记录的已加载资源。

支持识别的常见音频后缀：

```text
mp3, m4a, aac, wav, ogg, oga, opus, flac, weba, webm, aiff, aif, amr, mid, midi
```

支持识别的流媒体清单：

```text
m3u8, mpd
```

### 不能做什么

- 不能发现页面尚未加载或没有暴露给浏览器的资源。
- 不处理 `blob:`、`data:` 这类非 `http(s)` 地址。
- 不拼接 HLS/DASH 分片，只列出清单文件。
- 不破解 DRM、不解密加密音频、不绕过登录或网站访问控制。
- 跨域资源是否能下载，取决于浏览器和目标服务器响应。

### 文件结构

```text
.
├── bookmarklet/
│   ├── bookmarklet.html
│   └── bookmarklet-source.js
└── chrome-extension/
    ├── background.js
    ├── manifest.json
    ├── popup.css
    ├── popup.html
    └── popup.js
```

### 本地检查

项目没有构建步骤，也不需要安装依赖。

```sh
cd bookmarklet
node --check bookmarklet-source.js

cd ../chrome-extension
node --check popup.js
node --check background.js
python3 -m json.tool manifest.json >/dev/null
```

## English

A lightweight tool for collecting audio URLs from a web page. It does not inspect server-side code or bypass permissions; it only organizes audio files and streaming manifest URLs that are already visible to the current page or recorded by the browser.

The project has two entry points:

- **Bookmarklet**: drag it to the bookmarks bar and run it without installing an extension.
- **Chrome Extension**: a local Manifest V3 extension with popup scanning and bulk download submission.

### When to Use It

- You can play audio on a page and want to find the underlying audio URL.
- You only need resource URLs that the page has already exposed to the browser.
- Your managed Chrome browser blocks local extensions, so you need a bookmarklet fallback.

### Quick Start

#### Bookmarklet

1. Open `bookmarklet/bookmarklet.html`.
2. Drag the `Audio Grabber` link to your browser bookmarks bar.
3. Open the target page and play the audio for a few seconds.
4. Click `Audio Grabber` in the bookmarks bar.
5. Copy, open, or download candidate URLs from the panel at the bottom-right of the page.

If browser policy blocks bookmarklets, copy the Console snippet from `bookmarklet/bookmarklet.html` and run it in the target page's DevTools Console.

#### Chrome Extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `chrome-extension/`.
5. Open the target page and play the audio for a few seconds.
6. Click the extension button to scan the current tab.

The extension submits downloads through Chrome's download manager. Files are saved under the `audio-grabber/` subdirectory in the default downloads folder.

### Version Comparison

| Version | Strength | Notes |
| --- | --- | --- |
| Bookmarklet | No extension install; good for temporary use or managed browsers | Downloads are triggered by temporary in-page links |
| Chrome Extension | Popup UI; supports single-item and bulk downloads | Requires Chrome to allow local extension loading |

### What It Scans

The scanner only uses information available from the current page:

- `currentSrc` and `src` on `<audio>` and `<video>`.
- `src` and `srcset` on `<source>` inside media elements.
- `src`, `href`, `data-src`, `data-url`, `data-href`, and `srcset` attributes on page elements.
- Loaded resource entries from `performance.getEntriesByType("resource")`.

Common audio extensions:

```text
mp3, m4a, aac, wav, ogg, oga, opus, flac, weba, webm, aiff, aif, amr, mid, midi
```

Streaming manifests:

```text
m3u8, mpd
```

### What It Does Not Do

- It cannot discover resources that have not been loaded or exposed to the browser.
- It does not handle non-`http(s)` URLs such as `blob:` or `data:`.
- It does not stitch HLS/DASH media segments; it only lists manifest files.
- It does not crack DRM, decrypt protected audio, bypass login, or bypass site access controls.
- Cross-origin downloads depend on the browser and the target server response.

### Project Layout

```text
.
├── bookmarklet/
│   ├── bookmarklet.html
│   └── bookmarklet-source.js
└── chrome-extension/
    ├── background.js
    ├── manifest.json
    ├── popup.css
    ├── popup.html
    └── popup.js
```

### Local Checks

The project has no build step and no installable dependencies.

```sh
cd bookmarklet
node --check bookmarklet-source.js

cd ../chrome-extension
node --check popup.js
node --check background.js
python3 -m json.tool manifest.json >/dev/null
```
