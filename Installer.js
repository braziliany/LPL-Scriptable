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
  version: "2.0.1",
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

async function downloadResource(resource) {
  const request = new Request(resource.sourceUrl);
  request.timeoutInterval = 20;
  const content = await request.loadString();
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

async function installResources(resources) {
  // 先完成全部下载和校验，避免只更新一半依赖。
  const downloads = await Promise.all(resources.map(downloadResource));
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
  const alert = new Alert();
  alert.title = "安装 LPL Schedule";
  alert.message =
    `将安装组件和共享设计系统（v${CONFIG.version}）。\n` +
    "现有设置与 Logo 缓存不会被覆盖。";
  alert.addAction("安装");
  alert.addCancelAction("取消");

  const choice = await alert.present();
  if (choice === -1) {
    Script.complete();
    return;
  }

  try {
    const installed = await installResources(CONFIG.resources);

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
