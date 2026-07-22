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
  scriptName: "LPL Schedule 2026",
  sourceUrl:
    "https://raw.githubusercontent.com/braziliany/LPL-Scriptable/main/LPL-Schedule.js",
};

async function main() {
  const alert = new Alert();
  alert.title = "安装 LPL Schedule";
  alert.message = "将从 GitHub 下载并写入 Scriptable。";
  alert.addAction("安装");
  alert.addCancelAction("取消");

  const choice = await alert.present();
  if (choice === -1) {
    Script.complete();
    return;
  }

  try {
    const request = new Request(CONFIG.sourceUrl);
    request.timeoutInterval = 20;
    const content = await request.loadString();

    if (!content.includes("LPL SCHEDULE")) {
      throw new Error("下载内容不是有效的 LPL 脚本");
    }

    const fm = FileManager.iCloud();
    const path = fm.joinPath(
      fm.documentsDirectory(),
      `${CONFIG.scriptName}.js`
    );

    fm.writeString(path, content);

    const done = new Alert();
    done.title = "安装完成";
    done.message = `已创建脚本：${CONFIG.scriptName}`;
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
