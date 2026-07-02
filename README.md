# Audio Resource Grabber

一个用来从当前网页里发现原始音频资源 URL 的小工具。项目保留了两套方案：

- **Bookmarklet 方案**：不安装 Chrome 扩展，适合公司浏览器禁止加载扩展的环境。
- **Chrome Extension 方案**：Manifest V3 扩展，支持在扩展弹窗里扫描并调用 Chrome 下载 API。

这个工具只读取当前页面已经暴露出来的资源地址，不绕过 DRM、登录权限、加密流或网站访问控制。

## 方案一：Bookmarklet

入口文件：

- `bookmarklet/bookmarklet.html`
- `bookmarklet/bookmarklet-source.js`

使用方式：

1. 在浏览器打开 `bookmarklet/bookmarklet.html`。
2. 显示书签栏。
3. 把页面里的 `Audio Grabber` 链接拖到书签栏。
4. 打开目标网页，先播放音频几秒。
5. 点击书签栏里的 `Audio Grabber`。
6. 页面右下角会出现候选音频资源面板。

结果面板支持：

- 查看候选音频 URL。
- 复制单个 URL。
- 复制全部 URL。
- 打开候选资源链接。

如果浏览器禁止 bookmarklet，可以打开 `bookmarklet/bookmarklet.html`，复制页面下方的 Console 代码，到目标网页的 DevTools Console 中运行。

## 方案二：Chrome Extension

入口文件：

- `chrome-extension/manifest.json`
- `chrome-extension/popup.html`
- `chrome-extension/popup.css`
- `chrome-extension/popup.js`
- `chrome-extension/background.js`

使用方式：

1. 打开 `chrome://extensions`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择 `chrome-extension/` 目录。
5. 打开目标网页，先播放音频几秒。
6. 点击扩展按钮扫描资源。

扩展版会把下载提交给 Chrome 下载管理器，默认下载到 `audio-grabber/` 子目录。

注意：部分公司托管的 Chrome 会阻止本地扩展加载。如果看到管理员拦截提示，使用 Bookmarklet 方案。

## 能发现哪些资源

扫描逻辑会合并这些来源：

- `<audio>` 和 `<video>` 的 `currentSrc`、`src`。
- `<source>` 的 `src`、`srcset`。
- 页面元素上的 `src`、`href`、`data-src`、`data-url`、`data-href`。
- `performance.getEntriesByType("resource")` 中已经加载过的资源。

识别的常见音频格式包括：

- `mp3`
- `m4a`
- `aac`
- `wav`
- `ogg`
- `opus`
- `flac`
- `weba`
- `webm`

也会识别流媒体清单：

- `m3u8`
- `mpd`

## 限制

- 只能发现页面已经加载或暴露出来的 `http`/`https` URL。
- `blob:`、`data:`、DRM、加密分片不会被下载或解密。
- HLS/DASH 目前只列出清单文件，不自动拼接分片。
- 如果页面尚未播放音频，相关网络资源可能还没有出现；先播放几秒再扫描。
- 跨域下载是否成功取决于浏览器和目标服务器响应方式。

## 本地校验

可以运行下面的命令检查主要文件语法：

```sh
cd bookmarklet
node --check bookmarklet-source.js

cd ../chrome-extension
node --check popup.js
node --check background.js
python3 -m json.tool manifest.json >/dev/null
```

当前项目没有构建步骤，也没有外部依赖。
