// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: download;

/**
 * LPL Schedule 一键安装器
 *
 * 使用前请确认项目已上传到：
 * braziliany/LPL-Scriptable
 */

const CONFIG = {
  version: "2.7.0",
  changelogUrl:
    "https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main/CHANGELOG.md",
  resources: [
    {
      scriptName: "LPL-Design-System",
      sourceUrl:
        "https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main/LPL-Design-System.js",
      marker: "LPL Scriptable Design System",
    },
    {
      scriptName: "LPL Schedule 2026",
      sourceUrl:
        "https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main/LPL-Schedule.js",
      marker: 'importModule("LPL-Design-System")',
    },
    {
      scriptName: "LPL Schedule Installer",
      sourceUrl:
        "https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main/Installer.js",
      marker: "LPL Schedule 一键安装器",
    },
  ],
};

function extractVersion(content) {
  const match = String(content || "").match(
    /\bversion\s*:\s*["'](\d+\.\d+\.\d+)["']/
  );
  return match ? match[1] : null;
}

function compareVersions(left, right) {
  const a = String(left || "0.0.0")
    .split(".")
    .map(Number);
  const b = String(right || "0.0.0")
    .split(".")
    .map(Number);
  for (let index = 0; index < 3; index++) {
    if ((a[index] || 0) < (b[index] || 0)) return -1;
    if ((a[index] || 0) > (b[index] || 0)) return 1;
  }
  return 0;
}

function extractReleaseNotes(changelog, version) {
  const lines = String(changelog || "").split(/\r?\n/);
  const heading = `## ${version} `;
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) return "";

  const notes = [];
  for (let index = start + 1; index < lines.length; index++) {
    if (lines[index].startsWith("## ")) break;
    if (lines[index].trim()) notes.push(lines[index].trim());
  }
  return notes.slice(0, 6).join("\n");
}

async function downloadText(url) {
  const request = new Request(url);
  request.timeoutInterval = 20;
  return request.loadString();
}

async function downloadResource(resource) {
  const content = await downloadText(resource.sourceUrl);
  if (!content.includes(resource.marker)) {
    throw new Error(`${resource.scriptName} 下载内容校验失败`);
  }
  return { ...resource, content };
}

async function readExistingFile(fm, path) {
  if (!fm.fileExists(path)) return null;
  if (!fm.isFileDownloaded(path)) {
    await fm.downloadFileFromiCloud(path);
  }
  return fm.readString(path);
}

async function installDownloads(downloads) {
  const fm = FileManager.iCloud();
  const directory = fm.documentsDirectory();
  const backups = [];

  try {
    for (const resource of downloads) {
      const path = fm.joinPath(directory, `${resource.scriptName}.js`);
      backups.push({
        path,
        content: await readExistingFile(fm, path),
      });
      fm.writeString(path, resource.content);
    }
  } catch (error) {
    // 写入中断时恢复安装前状态。
    for (const backup of backups.reverse()) {
      if (backup.content === null) {
        if (fm.fileExists(backup.path)) fm.remove(backup.path);
      } else {
        fm.writeString(backup.path, backup.content);
      }
    }
    throw error;
  }

  return downloads.map((resource) => resource.scriptName);
}

async function main() {
  try {
    // 先下载并校验完整安装包，此时不会改动本地文件。
    const downloads = await Promise.all(CONFIG.resources.map(downloadResource));
    const mainResource = downloads.find(
      (resource) => resource.scriptName === "LPL Schedule 2026"
    );
    const remoteVersion =
      extractVersion(mainResource?.content) || CONFIG.version;

    const fm = FileManager.iCloud();
    const localMainPath = fm.joinPath(
      fm.documentsDirectory(),
      "LPL Schedule 2026.js"
    );
    const localContent = await readExistingFile(fm, localMainPath);
    const localVersion = extractVersion(localContent);
    const comparison = localVersion
      ? compareVersions(localVersion, remoteVersion)
      : -1;

    let releaseNotes = "";
    try {
      releaseNotes = extractReleaseNotes(
        await downloadText(CONFIG.changelogUrl),
        remoteVersion
      );
    } catch (error) {
      console.warn(`更新说明获取失败：${error}`);
    }

    const alert = new Alert();
    alert.title = localVersion
      ? comparison < 0
        ? "发现新版本"
        : comparison === 0
          ? "重新安装"
          : "远端版本较旧"
      : "安装 LPL Schedule";
    alert.message = [
      `本地：${localVersion || "未安装"}`,
      `远端：${remoteVersion}`,
      releaseNotes ? `\n更新内容：\n${releaseNotes}` : "",
      "\n现有设置与 Logo 缓存不会被覆盖。",
    ].join("\n");

    if (comparison > 0) {
      alert.addDestructiveAction("降级安装");
    } else {
      alert.addAction(
        localVersion ? (comparison < 0 ? "更新" : "重新安装") : "安装"
      );
    }
    alert.addCancelAction("取消");

    if ((await alert.present()) === -1) {
      Script.complete();
      return;
    }

    const installed = await installDownloads(downloads);

    const done = new Alert();
    done.title = "安装完成";
    done.message =
      `已安装：\n${installed.join("\n")}\n\n` +
      "以后请运行 LPL Schedule Installer 更新。";
    done.addAction("打开 Scriptable");
    await done.present();

    Safari.open("scriptable://");
  } catch (error) {
    const failed = new Alert();
    failed.title = "安装失败";
    failed.message = String(error?.message || error);
    failed.addAction("确定");
    await failed.present();
  }

  Script.complete();
}

await main();
