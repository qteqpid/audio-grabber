# Audio Resource Grabber

Audio Resource Grabber 是一个从当前网页里发现音频资源 URL 的小工具。先让网页里的音频播放几秒，再运行它；工具会从页面 DOM 和浏览器已记录的资源列表中找出可能的 `.mp3`、`.m4a`、`.m3u8`、`.mpd` 等地址。

**Bookmarklet · Chrome Extension · 无构建步骤 · 无外部依赖**

## 适用场景

- 想从网页里找出浏览器已经拿到的音频文件或流媒体清单 URL。
- 公司 Chrome 禁止加载本地扩展时，可以用 Bookmarklet 版本。
- 需要批量提交下载任务时，可以用 Manifest V3 Chrome 扩展版本。

这个项目只读取页面已经暴露出来的 `http` 和 `https` 地址。它不会破解 DRM、解密分片、绕过登录权限，或处理网站没有交给浏览器的文件。

## 快速选择

| 方案 | 适合场景 | 下载方式 | 入口 |
| --- | --- | --- | --- |
| Bookmarklet | 不能安装本地扩展，或只想临时扫描一次 | 页面内触发浏览器下载链接 | `bookmarklet/bookmarklet.html` |
| Chrome Extension | 想要弹窗扫描、批量下载、交给 Chrome 下载管理器处理 | `chrome.downloads` API，保存到 `audio-grabber/` | `chrome-extension/` |

## Bookmarklet

Bookmarklet 版本不用安装扩展，只需要把一个 `Audio Grabber` 链接拖到书签栏。

### 安装

1. 在浏览器打开 `bookmarklet/bookmarklet.html`。
2. 显示浏览器书签栏。
3. 把页面里的 `Audio Grabber` 链接拖到书签栏。

### 使用

1. 打开目标网页。
2. 播放音频几秒，让浏览器先加载相关资源。
3. 点击书签栏里的 `Audio Grabber`。
4. 在页面右下角的结果面板里查看候选资源。

结果面板支持：

- 下载单个候选资源。
- 打开候选 URL。
- 复制单个 URL。
- 复制全部 URL。

如果浏览器禁止 bookmarklet，可以打开 `bookmarklet/bookmarklet.html`，复制页面下方的 Console 代码，到目标网页的 DevTools Console 里运行。

## Chrome Extension

Chrome 扩展版本是一个 Manifest V3 扩展，弹窗会扫描当前标签页，并把下载任务提交给 Chrome 下载管理器。

### 加载

1. 打开 `chrome://extensions`。
2. 开启 **Developer mode**。
3. 点击 **Load unpacked**。
4. 选择 `chrome-extension/` 目录。

### 使用

1. 打开目标网页。
2. 播放音频几秒。
3. 点击扩展按钮，弹窗会自动扫描当前页面。
4. 对单个结果点击 **下载**，或点击 **全部下载**。

扩展会把文件保存到默认下载目录下的 `audio-grabber/` 子目录。文件名会根据 URL 路径或扫描结果生成；如果重名，Chrome 会自动改名避免覆盖。

扩展声明的权限：

- `activeTab`：访问当前激活标签页。
- `scripting`：向当前页面注入扫描函数。
- `downloads`：提交下载任务。

公司托管的 Chrome 可能会拦截本地扩展加载。遇到管理员拦截提示时，用 Bookmarklet 版本。

## 扫描逻辑

工具会从这些位置收集候选 URL：

- `<audio>` 和 `<video>` 的 `currentSrc`、`src`。
- `<audio>`、`<video>` 里的 `<source>` 的 `src`、`srcset`。
- 页面元素上的 `src`、`href`、`data-src`、`data-url`、`data-href`、`srcset`。
- `performance.getEntriesByType("resource")` 中浏览器已经加载过的资源。

候选结果会合并去重，并优先展示直接音频文件，其次是流媒体清单，再其次是带音频线索的候选 URL。

### 常见音频格式

- `mp3`
- `m4a`
- `aac`
- `wav`
- `ogg`
- `oga`
- `opus`
- `flac`
- `weba`
- `webm`
- `aiff`
- `aif`
- `amr`
- `mid`
- `midi`

### 流媒体清单

- `m3u8`
- `mpd`

## 项目结构

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

## 边界

- 页面没开始播放时，音频请求可能还没出现。先播放几秒再扫描。
- 只收集 `http` 和 `https` URL；`blob:`、`data:` 等地址不会进入结果列表。
- HLS 和 DASH 只显示清单文件，工具不拼接分片。
- 跨域资源能不能直接下载，取决于浏览器和目标服务器响应。
- 浏览器或服务器可能忽略工具给出的文件名。
- 加密音频、DRM 内容、需要额外鉴权但当前页面没有暴露的资源不在处理范围内。

## 开发校验

项目没有构建步骤，也不需要安装依赖。修改代码后可以运行：

```sh
cd bookmarklet
node --check bookmarklet-source.js

cd ../chrome-extension
node --check popup.js
node --check background.js
python3 -m json.tool manifest.json >/dev/null
```
