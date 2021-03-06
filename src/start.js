const path = require('path');
const fs = require('fs');
//hson2xls
const json2xls = require('json2xls');

//Excel JS
const Excel = require('exceljs');
const workbook = new Excel.Workbook();

const filesJs = require('./files.js');

const readExcel = require('./readExcel.js');
/** 輸出開關
 *  true => 輸出Excel
 *  false => 讀取Excel 輸出 i18n
 */
const EXPORT_EXCEL = false;
(function () {
  if (!EXPORT_EXCEL) {
    filesJs.copyFolder(path.resolve('.', 'i18n'), path.resolve('.', '比對用', 'i18n'), readExcel);
    return;
  }
  //資料夾名字 backstage ,frontstage
  const i18nDirPath = fs.readdirSync(path.resolve('.', 'i18n')).filter((it) => {
    return filesJs.is_dir(path.resolve('.', 'i18n', it));
  });
  //建立輸出日期
  const d = new Date();
  const backupDate = d.getFullYear() + '' + pad(d.getMonth() + 1) + pad(d.getDate());
  //en, zh-cn, zh-tw
  const langList = [];

  //輸出
  const mapJson = {};

  fs.readdirSync(path.resolve('.')).filter((file) => {
    if (/Inspection_/.test(file) && !RegExp(backupDate, 'g').test(file)) {
      filesJs.removeFile(file);
    }
  });

  //正則分類 資料夾區塊--->for mac
  // const jsonFileRegex = new RegExp(`\/([a-z]+)\/([a-z\-]{2,})\/([a-z]+)\.json$`, 'i');
  const jsonFilesPath = walkFilesSync(path.resolve('.', 'i18n'), (fname, dirname) => {
    const fullpath = path.join(dirname, fname);
    return /\.json$/.test(fullpath);
  });
  //以資料當作Key 取出重複的資料
  const repeatAll = {};
  const repeatZhTw = {};
  //組合不重複的語系資料夾名字,做第一階段的過濾,取出全部的語系結構
  i18nDirPath.forEach((dirpath, id) => {
    if (!filesJs.is_dir(path.resolve('.', 'i18n', dirpath))) return;
    fs.readdirSync(path.resolve('.', 'i18n', dirpath)).forEach((pathname) => {
      if (langList.indexOf(pathname) < 0 && filesJs.is_dir(path.resolve('.', 'i18n', dirpath, pathname))) {
        langList.push(pathname);
      }
    });
  });

  jsonFilesPath.forEach((jfPath) => {
    // const match = jfPath.split('i18n')[1].match(jsonFileRegex);
    const match = jfPath.split('i18n')[1].split(/[\\/]/);
    const fileNameRegex = /\.json/;
    const baseName = path.basename(jfPath, '.json');

    if (fileNameRegex.test(match[match.length - 1])) {
      const dirpath = match[1];
      const lang = match[2];
      const fileString = baseName;

      const rawdata = fs.readFileSync(jfPath, 'utf8');
      const data = JSON.parse(rawdata.toString());
      const flatData = flattenObject(data);

      Object.keys(flatData).forEach((k) => {
        mapJson[`${dirpath}.${fileString}.${k}`] = mapJson[`${dirpath}.${fileString}.${k}`] || {};
        mapJson[`${dirpath}.${fileString}.${k}`][lang] = flatData[k];
      });
    }
  });
  //xls json組合用
  const xlsjson = [];
  //id : key 的map表
  const enumID2Key = {};

  //追加紀錄最大字長作為調整Excel欄位寬度
  const maxWordLength = { key: 0, rowid: 5 };

  Object.keys(mapJson).forEach((key) => {
    langList.forEach((lang) => {
      mapJson[key][lang] = escapeCharacterReplace(mapJson[key][lang]) || '';
      //追加紀錄最大字長作為調整Excel欄位寬度
      maxWordLength[lang] = maxWordLength[lang] || 0;
      maxWordLength[lang] =
        mapJson[key][lang].length > maxWordLength[lang] ? mapJson[key][lang].length : maxWordLength[lang];
    });
    //id to key map表
    enumID2Key[xlsjson.length] = key;
    enumID2Key[key] = xlsjson.length;
    //追加紀錄最大字長作為調整Excel欄位寬度
    maxWordLength.key = key.length > maxWordLength.key ? key.length : maxWordLength.key;

    //過濾重複ZH-TW 紀錄id
    repeatZhTw[JSON.stringify(mapJson[key]['zh-tw'])] = repeatZhTw[JSON.stringify(mapJson[key]['zh-tw'])] || [];
    repeatZhTw[JSON.stringify(mapJson[key]['zh-tw'])].push(xlsjson.length);

    //過濾全部重語系內容 紀錄id
    repeatAll[JSON.stringify(mapJson[key])] = repeatAll[JSON.stringify(mapJson[key])] || [];
    repeatAll[JSON.stringify(mapJson[key])].push(xlsjson.length);

    xlsjson.push({ key, ...mapJson[key], rowid: xlsjson.length });
  });

  //過濾出全部的重複內容
  const repeatValue = Object.values(repeatZhTw).filter((it) => {
    return it.length > 1;
  });
  //針對ZH-TW的過濾
  const repeatZhTwValue = [];
  for (const [key, value] of Object.entries(repeatZhTw)) {
    if (value.length > 1) {
      repeatZhTwValue.push({
        key: key,
        repeatid: value,
        repeatkey: value.map((id) => {
          return enumID2Key[id];
        }),
      });
    }
  }

  //重複內容的Map,將重複的內容抓出去 原本位置先清空
  const repeatMap = repeatValue.map((it) => {
    const repeatArray = [];
    it.forEach((langIndex) => {
      repeatArray.push(xlsjson[langIndex]);
      xlsjson[langIndex] = null;
    });

    return repeatArray;
  });
  //將重複內容塞到陣列最後面
  repeatMap.forEach((it) => it.forEach((langValue) => xlsjson.push(langValue)));

  const count = 0;
  //空出來的位置過濾掉
  const xlsJsonFilter = xlsjson.filter((it) => it !== null);
  const xls = json2xls(xlsJsonFilter);
  //原始XLSX
  fs.writeFileSync('langXls.xlsx', xls, 'binary');
  //檢查輸出的JSON是不是自己要的
  fs.writeFile('dirPath.json', JSON.stringify(i18nDirPath, null, 2), errorHandler);
  fs.writeFile('mapJson.json', JSON.stringify(mapJson, null, 2), errorHandler);
  fs.writeFile('langXls.json', JSON.stringify(xlsJsonFilter, null, 2), errorHandler);
  fs.writeFile('repeatMap.json', JSON.stringify(repeatMap, null, 2), errorHandler);
  fs.writeFile('repeatZhTw.json', JSON.stringify(repeatZhTwValue, null, 2), errorHandler);
  fs.writeFile('enumID2Key.json', JSON.stringify(enumID2Key, null, 2), errorHandler);

  //產出有合併欄位的 Excels
  /**
   * 繁體中文	zh-tw
   * 簡體中文	zh-cn
   * 英文	en
   * 越文	vi
   * 泰文	th
   * 馬來文	ms
   * 印尼文	id
   * 印度文	hi
   */
  const headerLangKey = {
    key: 'key',
    'zh-cn': '简体',
    'zh-tw': '繁體',
    en: '英文',
    th: '泰文',
    vi: '越文',
    hi:'印地文',
    rowid: 'rowid',
  };
  langList.forEach((langkey) => {
    headerLangKey[langkey] = headerLangKey[langkey] || '';
  });

  const worksheet = workbook.addWorksheet('MySheet');
  const excelColumn = Object.keys(headerLangKey).map((it) => {
    return { header: headerLangKey[it], key: it, width: maxWordLength[it] };
  });

  worksheet.columns = excelColumn;
  worksheet.addRows(xlsJsonFilter);
  repeatValue.forEach((repeat) => {
    const rowsIndex = xlsJsonFilter.findIndex((it) => {
      return it.rowid === repeat[0];
    });

    const letter = String('bcdefghijklmnopqrstuvwxyz').toUpperCase();
    //因為只看繁體 所以只合併繁簡
    [...letter].slice(0, 2).forEach((key) => {
      worksheet.mergeCells(`${key}${rowsIndex + 2}:${key}${rowsIndex + repeat.length - 1 + 2}`);
    });

    // [...letter].slice(0, langList.length).forEach((key) => {
    //   worksheet.mergeCells(`${key}${rowsIndex + 2}:${key}${rowsIndex + repeat.length - 1 + 2}`);
    // });
  });
  fs.writeFile('columnKeyList.json', JSON.stringify(headerLangKey, null, 2), errorHandler);

  (async function () {
    return await workbook.xlsx.writeFile('Inspection_' + backupDate + '.xlsx').then(async () => {
      // console.log(this);
      filesJs.copyFolder(path.resolve('.', 'i18n'), path.resolve('.', 'backup', backupDate, 'i18n'));
      filesJs.copyFolder(path.resolve('.', 'i18n'), path.resolve('.', '比對用', 'i18n'));
      filesJs.copyFile(
        'Inspection_' + backupDate + '.xlsx',
        path.resolve('.', 'backup', backupDate, 'Inspection_' + backupDate + '.xlsx'),
        errorHandler,
      );
    }, errorHandler);
  })();
})();

function walkFilesSync(dirname, filter = undefined) {
  try {
    let files = [];

    fs.readdirSync(dirname).forEach((fname) => {
      const fpath = path.join(dirname, fname);

      if (filesJs.is_file(fpath)) {
        if (filter && filter(fname, dirname)) {
          files.push(fpath);
        }
      } else if (filesJs.is_dir(fpath)) {
        files = files.concat(walkFilesSync(fpath, filter));
      }
    });

    return files;
  } catch (err) {
    throw err;
  }
}

function flattenObject(ob) {
  var toReturn = {};

  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;

    if (typeof ob[i] == 'object' && ob[i] !== null) {
      var flatObject = flattenObject(ob[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;

        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}

function errorHandler(err) {
  if (err) {
    console.log(err);
    throw err;
  }
}

function escapeCharacterReplace(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.split('\b').join('\\b').split('\t').join('\\t').split('\r').join('\\r').split('\n').join('\\n');
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}
