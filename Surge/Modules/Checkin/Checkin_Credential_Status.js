/*
 * Surge 签到凭证检测 v1.0
 * 只读本机 $persistentStore，绝不读取后上传、输出或记录凭证原文。
 * 本工具只确认指定旧版脚本曾保存数据，不确认凭证有效性或签到成功。
 */
function stored(key) {
  try {
    return String($persistentStore.read(key) || "");
  } catch (e) {
    return "";
  }
}
function parse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}
function nonempty(v) {
  return typeof v === "string" ? v.trim().length > 0 : !!v;
}
function jdSaved() {
  var current = stored("checkin_v2_jd_cookie");
  if (current.indexOf("pt_key=") !== -1 && current.indexOf("pt_pin=") !== -1) return true;
  var multi = parse(stored("CookiesJD"));
  if (Array.isArray(multi) && multi.some(function (x) {
    var c = String((x && x.cookie) || "");
    return c.indexOf("pt_key=") !== -1 && c.indexOf("pt_pin=") !== -1;
  })) return true;
  return ["CookieJD", "CookieJD2"].some(function (k) {
    var c = stored(k);
    return c.indexOf("pt_key=") !== -1 && c.indexOf("pt_pin=") !== -1;
  });
}
function biliSaved() {
  var recent = stored("checkin_v2_bili_cookie");
  if (recent.indexOf("DedeUserID=")!==-1 && recent.indexOf("SESSDATA=")!==-1 && recent.indexOf("bili_jct=")!==-1) return true;
  var data = parse(stored("bilibili_daily_bonus")) || {};
  var c = data.cookie || {};
  var raw = data.cookieStr || "";
  return !!(nonempty(c.DedeUserID) && nonempty(c.SESSDATA) && nonempty(c.bili_jct))
    || (raw.indexOf("DedeUserID=") !== -1 && raw.indexOf("SESSDATA=") !== -1 && raw.indexOf("bili_jct=") !== -1);
}
function longforStatus() {
  var obj = parse(stored("longfor_sign_credentials_v1")) || {};
  var token = nonempty(obj.token);
  var replay = obj.replayHeaders && typeof obj.replayHeaders === "object" && nonempty(obj.replayBody);
  if (token && replay) return "已存令牌及签到请求";
  if (token) return "仅有令牌，未存签到请求";
  if (replay) return "仅有请求，未找到令牌";
  return "未检测到";
}
function ccbStatus() {
  var a = nonempty(stored("JHSH_BODY"));
  var b = nonempty(stored("JHSH_LOGIN_INFO"));
  if (a && b) return "签到数据及登录数据已存";
  if (a) return "只抓到签到数据";
  if (b) return "只抓到登录数据";
  return "未检测到";
}
function chageeStatus() {
  var a = nonempty(stored("bw_token")) || nonempty(stored("checkin_v2_chagee"));
  var b = nonempty(stored("bw_body"));
  return a && b ? "Token及请求体已存" : (a || b ? "只存了部分凭证" : "未检测到");
}
function atourStatus() {
  var a = nonempty(stored("adjd_header"));
  var b = nonempty(stored("adjd_url"));
  return a && b ? "请求头及URL参数已存" : (a || b ? "只存了部分凭证" : "未检测到");
}
function status(s) {
  if (s === "未检测到") return "○ " + s;
  if (/^只|^仅/.test(s)) return "△ " + s;
  return "✓ " + s;
}
var rows = [
  "龙湖：" + status(longforStatus()),
  "值得买：? 旧模块脚本失效，无法可靠判断",
  "京东：" + status(jdSaved() ? "京东Cookie已存" : "未检测到"),
  "建行生活：" + status(ccbStatus()),
  "霸王茶姬：" + status(chageeStatus()),
  "B站：" + status(biliSaved() ? "B站Cookie已存" : "未检测到"),
  "亚朵：" + status(atourStatus()),
  "华住会：" + status(nonempty(stored("HZH_Token")) ? "会员Token已存" : "未检测到")
];
var content = rows.join("\n") +
  "\n\n只表示本机有无缓存；过期凭证也会显示已存。" +
  "\n要确认成功，须手动执行签到并查看平台积分或记录。";
try {
  console.log("签到凭证检测完成（不输出敏感数据）");
  $done({title:"签到凭证检测", content:content, style:"info"});
} catch (e) {
  $done();
}