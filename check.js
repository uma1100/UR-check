const prop = PropertiesService.getScriptProperties().getProperties();
const URL = prop.CHECK_URL;
const headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + prop.CHANNEL_ACCESS_TOKEN
};
const DEV_LINE_ID = prop.DEV_LINE_ID;

function URCheck() {
  const phantomJSCloudKey = prop.PHANTOMJS_CLOUD_KEY;

  const options = {
    url: URL,
    renderType: "html",
    outputAsJson: true,
  }

  const payload = encodeURIComponent(JSON.stringify(options));
  const apiUrl = "https://phantomjscloud.com/api/browser/v2/" + phantomJSCloudKey + "/?request=" + payload;

  const response = UrlFetchApp.fetch(apiUrl);
  const responseJson = JSON.parse(response.getContentText());

  const content = responseJson.content.data;

  const roomNames = Parser.data(content).from('<td class="rep_room-name">').to("</td>").iterate();

  // うまくとれてないときは0を返す
  if (roomNames[0].length > 100) {
    return false;
  }

  return roomNames;
}

// 一旦、スプシ側の部屋番号情報を全部取得
// 一致するやつがあるかどうかをチェック
// 一致すれば通知しない/一致しなければ通知+スプシに保存
// 何も取得できない場合は、スプシ側の値を削除する

function CompareSpreadSheetData() {
  let spreadSheet = SpreadsheetApp.openById(prop.SPREADSHEET_ID).getSheetByName("URCheckLists");
  let spreadSheetData = spreadSheet.getDataRange().getValues();
  const flatData = spreadSheetData.flat();

  try {
    const roomNames = URCheck();
    let count = 0;
    if (roomNames !== false) {
      for (let roomName of roomNames) {
        // 一致するものがなければ通知して、スプシに保存
        if (!flatData.includes(roomName)) {
          console.log(roomName);
          spreadSheetData.push([roomName]);
          broadCast("空き物件が出ました。\n" + String(roomName) + "\n" + URL);
        }
        count++;
      }
    } else {
      // 何も引っかからなければスプシ側のデータクリア+自分に通知
      spreadSheetData = [['チェックした部屋番号']];
      spreadSheet.clear();
      push(DEV_LINE_ID, `チェック済み(空きなし)\n${URL}`);
    }
    // 空きがあるが、既に通知済みの場合も通知する
    if (count > 0) {
      push(DEV_LINE_ID, `チェック済み(空きはあるが既に通知済み)\n${URL}`);
    }
  } catch (error) {
    push(DEV_LINE_ID, error.toString());
  }

  // スプシを更新
  spreadSheet.getRange(
    1,
    1,
    spreadSheetData.length,
    1
  ).setValues(spreadSheetData);

}
// line通知用(全員)
function broadCast(message) {
  console.log(message);
  const LINE_ENDPOINT = "https://api.line.me/v2/bot/message/broadcast";
  let messages;
  if (typeof message === "string") {
    messages = [{ "type": "text", "text": message }];
  } else {
    messages = message;
  }

  const payload = JSON.stringify({
    "messages": messages
  });

  const options = {
    "headers": headers,
    "method": "post",
    "payload": payload
  };
  UrlFetchApp.fetch(LINE_ENDPOINT, options);
}

// line通知用関数(ユーザー指定)
function push(userId, message, type = "text") {
  const LINE_ENDPOINT = "https://api.line.me/v2/bot/message/push";

  let messages;
  if (typeof message === "string") {
    if (type === "text") {
      messages = [{ "type": "text", "text": message }];
    } else {

    }
  }
  const options = {
    "headers": headers,
    "method": "post",
    "payload": JSON.stringify({
      "to": userId,
      "messages": messages,
    }),
  };
  UrlFetchApp.fetch(LINE_ENDPOINT, options);
}

function follow(userId) {
  /**
   *  友達追加時にユーザー情報シートにLINEIDと表示名を追加する関数
   *  @return null
   */
  const LINE_ENDPOINT = "https://api.line.me/v2/bot/profile/" + userId;
  const options = {
    "headers": headers,
    "muteHttpExceptions": true,
  };
  let displayName;
  try {
    const userProfile = UrlFetchApp.fetch(LINE_ENDPOINT, options);

    displayName = JSON.parse(userProfile).displayName;
  } catch (e) {
    throw e;
  }

  const USERS_SHEET = SpreadsheetApp.openById(prop.SPREADSHEET_ID).getSheetByName("users")

  let row = USERS_SHEET.getLastRow() + 1;
  USERS_SHEET.getRange(row, 1, 1, 2).setValues([[userId, displayName]]);
}
