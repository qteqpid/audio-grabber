<div align="center">

# Audio Resource Grabber

网页音频 URL 抓取工具：Bookmarklet 与 Chrome Extension 两种入口。

Browser audio URL finder with both Bookmarklet and Chrome Extension entry points.

![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)
![Bookmarklet](https://img.shields.io/badge/Mode-Bookmarklet-007f7a)
![No Build](https://img.shields.io/badge/Build-none-555)
![Dependencies](https://img.shields.io/badge/Dependencies-none-555)

[中文](#中文) · [English](#english)

</div>

---

## 中文

Audio Resource Grabber 用来从当前网页中找出可能可直接访问的音频文件或流媒体清单 URL。它只整理浏览器已经拿到、页面已经暴露的信息，不破解 DRM，不绕过登录，不解析网站后端。

### 功能亮点

- **两种入口**：支持 Bookmarklet 和 Manifest V3 Chrome 扩展。
- **无构建步骤**：直接打开 HTML 或加载扩展目录即可使用。
- **无外部依赖**：项目没有 npm、Python 或其他包管理依赖。
- **页面内扫描**：从 DOM 属性和浏览器已加载资源记录中收集候选 URL。
- **下载辅助**：Bookmarklet 可复制、打开、下载候选 URL；扩展版可提交单个或全部下载任务。

### 快速开始

如果只是临时使用，优先试 Bookmarklet；如果希望在弹窗里扫描并批量下载，用 Chrome Extension。

| 方式 | 适合场景 | 入口 |
| --- | --- | --- |
| Bookmarklet | 临时使用、不能安装扩展、公司浏览器受管 | `bookmarklet/bookmarklet.html` |
| Chrome Extension | 弹窗扫描、单个下载、全部下载 | `chrome-extension/` |

### Bookmarklet

1. 打开 `bookmarklet/bookmarklet.html`。
2. 把页面中的 `Audio Grabber` 链接拖到浏览器书签栏。
3. 打开目标网页，先播放音频几秒。
4. 点击书签栏里的 `Audio Grabber`。
5. 在页面右下角面板中下载候选资源，或点击 URL 在新标签页打开。
6. 如果音频请求在面板打开后才出现，点击面板里的 **Rescan**。

如果浏览器策略禁止 bookmarklet，可以在 `bookmarklet/bookmarklet.html` 中复制 Console 代码，然后粘贴到目标网页的 DevTools Console 运行。

### Chrome Extension

1. 打开 `chrome://extensions`。
2. 开启 **Developer mode**。
3. 点击 **Load unpacked**。
4. 选择 `chrome-extension/` 目录。
5. 打开目标网页，先播放音频几秒。
6. 点击扩展按钮扫描当前标签页。

扩展版会通过 Chrome 下载管理器提交下载任务，文件默认进入下载目录下的 `audio-grabber/` 子目录。

扩展声明的权限：

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 访问当前激活标签页 |
| `scripting` | 向当前页面注入扫描函数 |
| `downloads` | 提交下载任务 |

### 扫描范围

工具会从这些位置收集候选资源：

- `<audio>` 和 `<video>` 的 `currentSrc`、`src`。
- 媒体元素内部 `<source>` 的 `src`、`srcset`。
- 页面元素上的 `src`、`href`、`data-src`、`data-url`、`data-href`、`srcset`。
- 页面脚本中直接出现的音频 URL，包括 `https:\/\/...` 这类转义写法。
- `performance.getEntriesByType("resource")` 中浏览器已经加载过的资源。

识别的常见音频后缀：

```text
mp3, m4a, aac, wav, ogg, oga, opus, flac, weba, webm, aiff, aif, amr, mid, midi
```

识别的流媒体清单：

```text
m3u8, mpd
```

### 权限与隐私

- 扫描逻辑在当前页面内运行。
- 项目代码中没有远程上传、统计上报或外部 API 请求逻辑。
- 扩展版只使用 `activeTab`、`scripting`、`downloads` 三个权限。
- 下载是否成功仍取决于浏览器和目标网站服务器响应。

### 限制

- 页面还没播放音频时，相关请求可能尚未出现；建议先播放几秒再扫描。
- 只收集 `http` 和 `https` URL；不处理 `blob:`、`data:` 地址。
- CSS、HTML、JS、图片、字体等非音频资源会按后缀和加载来源过滤掉。
- HLS/DASH 只列出 `.m3u8` 或 `.mpd` 清单，不拼接分片。
- 不破解 DRM、不解密加密音频、不绕过登录或网站访问控制。
- 跨域下载、文件名保留等行为可能被浏览器或服务器策略影响。

### 项目结构

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

### 本地校验

项目没有构建步骤，也不需要安装依赖。修改代码后可以运行：

```sh
cd bookmarklet
node --check bookmarklet-source.js

cd ../chrome-extension
node --check popup.js
node --check background.js
python3 -m json.tool manifest.json >/dev/null
```

---

## English

Audio Resource Grabber finds audio file URLs and streaming manifest URLs that may be directly accessible from the current web page. It only organizes information that the browser has already loaded or the page has already exposed. It does not crack DRM, bypass login, or inspect server-side code.

### Highlights

- **Two entry points**: Bookmarklet and Manifest V3 Chrome extension.
- **No build step**: open the HTML file or load the extension directory directly.
- **No external dependencies**: no npm, Python, or other package dependencies.
- **In-page scanning**: collects candidate URLs from DOM attributes and browser resource timing entries.
- **Download helper**: the Bookmarklet can copy, open, or download candidates; the extension can submit one or all download tasks.

### Quick Start

Use the Bookmarklet for quick one-off scans. Use the Chrome Extension when you want popup scanning and bulk download submission.

| Mode | Best for | Entry point |
| --- | --- | --- |
| Bookmarklet | Temporary use, no extension install, managed browsers | `bookmarklet/bookmarklet.html` |
| Chrome Extension | Popup scanning, single download, bulk download | `chrome-extension/` |

### Bookmarklet

1. Open `bookmarklet/bookmarklet.html`.
2. Drag the `Audio Grabber` link to your browser bookmarks bar.
3. Open the target page and play the audio for a few seconds.
4. Click `Audio Grabber` in the bookmarks bar.
5. Download candidates from the bottom-right panel, or click a URL to open it in a new tab.
6. If the audio request appears after the panel opens, click **Rescan** in the panel.

If browser policy blocks bookmarklets, copy the Console snippet from `bookmarklet/bookmarklet.html` and run it in the target page's DevTools Console.

### Chrome Extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `chrome-extension/` directory.
5. Open the target page and play the audio for a few seconds.
6. Click the extension button to scan the current tab.

The extension submits downloads through Chrome's download manager. Files are saved under the `audio-grabber/` subdirectory in the default downloads folder.

Declared permissions:

| Permission | Purpose |
| --- | --- |
| `activeTab` | Access the active tab |
| `scripting` | Inject the scanner function into the current page |
| `downloads` | Submit download tasks |

### What It Scans

The tool collects candidate resources from:

- `currentSrc` and `src` on `<audio>` and `<video>`.
- `src` and `srcset` on `<source>` inside media elements.
- `src`, `href`, `data-src`, `data-url`, `data-href`, and `srcset` attributes on page elements.
- Audio URLs embedded in page scripts, including escaped forms such as `https:\/\/...`.
- Resources already loaded in `performance.getEntriesByType("resource")`.

Common audio extensions:

```text
mp3, m4a, aac, wav, ogg, oga, opus, flac, weba, webm, aiff, aif, amr, mid, midi
```

Streaming manifests:

```text
m3u8, mpd
```

### Permissions and Privacy

- The scanner runs inside the current page.
- The project code does not contain remote upload, analytics, telemetry, or external API request logic.
- The extension only uses `activeTab`, `scripting`, and `downloads`.
- Download success still depends on the browser and the target server response.

### Limitations

- If playback has not started, the related audio request may not exist yet; play the audio for a few seconds before scanning.
- Only `http` and `https` URLs are collected; `blob:` and `data:` URLs are excluded.
- CSS, HTML, JavaScript, images, fonts, and other non-audio resources are filtered by extension and initiator type.
- HLS/DASH manifests are listed as `.m3u8` or `.mpd` files only. The tool does not stitch media segments.
- The tool does not crack DRM, decrypt protected audio, bypass login, or bypass site access controls.
- Cross-origin downloads and filename preservation may be affected by browser or server policy.

### Project Structure

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

The project has no build step and no installable dependencies. After editing code, run:

```sh
cd bookmarklet
node --check bookmarklet-source.js

cd ../chrome-extension
node --check popup.js
node --check background.js
python3 -m json.tool manifest.json >/dev/null
```
