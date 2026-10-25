/*
 * 龙湖天街自动签到（Surge）
 * - http-response：从 key2token 登录响应中保存当前账号 Token
 * - http-request：从任务请求头或请求体中补充风控凭证
 * - cron：复用已保存凭证执行每日签到
 * - 不上传凭证，不自动破解滑块验证码
 */

const STORE_KEY = "longfor_sign_credentials_v1";
const SIGN_URL = "https://gw2c-hw-open.longfor.com/lmarketing-task-api-mvc-prod/openapi/task/v1/signature/clock";
const DEFAULT_ACTIVITY_NO = "11111111111686241863606037740000";
const DEFAULT_API_KEY = "c06753f1-3e68-437d-b592-b94656ea5517";

function notify(subtitle, body) {
  $notification.post("龙湖天街", subtitle, body, { "auto-dismiss": true });
}

function getHeader(headers, name) {
  if (!headers) return "";
  const key = Object.keys(headers).find(
    (item) => item.toLowerCase() === name.toLowerCase()
  );
  return key ? String(headers[key] || "") : "";
}

function safeJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function compact(value) {
  if (value === null || value === undefined || value === "") return "无";
  if (typeof value === "string") return value;
  try {
    const text = JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
  } catch (_) {
    return String(value);
  }
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[-_]/g, "");
}

function findStringByKeys(value, acceptedKeys, depth) {
  if (depth > 8 || value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length < 200000) {
      const nested = safeJson(trimmed, null);
      if (nested) return findStringByKeys(nested, acceptedKeys, depth + 1);
    }
    return "";
  }
  if (typeof value !== "object") return "";

  for (const [key, child] of Object.entries(value)) {
    if (
      acceptedKeys.includes(normalizeKey(key)) &&
      typeof child === "string" &&
      child.trim().length >= 16
    ) {
      return child.trim();
    }
  }
  for (const child of Object.values(value)) {
    const found = findStringByKeys(child, acceptedKeys, depth + 1);
    if (found) return found;
  }
  return "";
}

function saveCredentials(token, dxriskToken, headers, body, sourceUrl) {
  const previous = safeJson($persistentStore.read(STORE_KEY) || "{}", {});
  const finalToken = token || previous.token || "";
  if (!finalToken) return false;

  const record = {
    token: finalToken,
    dxriskToken: dxriskToken || previous.dxriskToken || "",
    activityNo: body.activity_no || body.activityNo || previous.activityNo || DEFAULT_ACTIVITY_NO,
    userAgent: getHeader(headers, "User-Agent") || previous.userAgent || "",
    apiKey: getHeader(headers, "X-GAIA-API-KEY") || previous.apiKey || DEFAULT_API_KEY,
    buCode: getHeader(headers, "X-LF-Bu-Code") || previous.buCode || "C20400",
    channel: getHeader(headers, "X-LF-Channel") || previous.channel || "C2",
    riskSource: getHeader(headers, "X-LF-DXRisk-Source") || previous.riskSource || "5",
    sourceUrl: sourceUrl || previous.sourceUrl || "",
    capturedAt: new Date().toISOString()
  };

  const written = $persistentStore.write(JSON.stringify(record), STORE_KEY);
  if (!written) {
    notify("保存失败", "Surge 无法写入本地凭证，请检查脚本日志。 ");
    return false;
  }

  const changed =
    previous.token !== record.token ||
    previous.dxriskToken !== record.dxriskToken;
  if (changed) {
    notify(
      previous.token ? "凭证已更新" : "凭证已保存",
      record.dxriskToken
        ? "登录 Token 与风控 Token 已保存，定时签到已经就绪。"
        : "登录 Token 已保存；如签到触发风控，请进入签到页完成一次验证。"
    );
  }
  return true;
}

function captureResponse() {
  const requestHeaders = ($request && $request.headers) || {};
  const responseHeaders = ($response && $response.headers) || {};
  const body = safeJson(($response && $response.body) || "", {});
  const tokenKeys = ["token", "usertoken", "xlfusertoken", "lfusertoken", "accesstoken"];
  const dxriskKeys = ["dxrisktoken", "xlfdxrisktoken"];
  const token =
    getHeader(responseHeaders, "X-LF-UserToken") ||
    getHeader(responseHeaders, "token") ||
    findStringByKeys(body, tokenKeys, 0);
  const dxriskToken =
    getHeader(responseHeaders, "X-LF-DXRisk-Token") ||
    findStringByKeys(body, dxriskKeys, 0);

  saveCredentials(token, dxriskToken, requestHeaders, body, $request.url || "");
  $done({});
}

function captureRequest() {
  const headers = $request.headers || {};
  const body = safeJson($request.body || "{}", {});
  const token =
    getHeader(headers, "X-LF-UserToken") ||
    getHeader(headers, "token") ||
    findStringByKeys(body, ["token", "usertoken", "xlfusertoken", "lfusertoken", "accesstoken"], 0);
  const dxriskToken =
    getHeader(headers, "X-LF-DXRisk-Token") ||
    findStringByKeys(body, ["dxrisktoken", "xlfdxrisktoken"], 0);

  if (!token) {
    $done({});
    return;
  }
  saveCredentials(token, dxriskToken, headers, body, $request.url || "");
  $done({});
}

function runSign() {
  const record = safeJson($persistentStore.read(STORE_KEY) || "", null);
  if (!record || !record.token) {
    notify("尚未配置", "请先打开龙湖天街微信小程序，手动签到一次以获取凭证。 ");
    $done();
    return;
  }

  const headers = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    Origin: "https://longzhu.longfor.com",
    Referer: "https://longzhu.longfor.com/",
    "User-Agent": record.userAgent || "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger miniProgram",
    token: record.token,
    "X-LF-UserToken": record.token,
    "X-GAIA-API-KEY": record.apiKey || DEFAULT_API_KEY,
    "X-LF-Bu-Code": record.buCode || "C20400",
    "X-LF-Channel": record.channel || "C2",
    "X-LF-DXRisk-Source": record.riskSource || "5"
  };
  if (record.dxriskToken) headers["X-LF-DXRisk-Token"] = record.dxriskToken;

  $httpClient.post(
    {
      url: SIGN_URL,
      headers,
      body: JSON.stringify({ activity_no: record.activityNo || DEFAULT_ACTIVITY_NO }),
      timeout: 15,
      "auto-cookie": false
    },
    (error, response, data) => {
      if (error) {
        notify("签到失败", `网络错误：${error}`);
        $done();
        return;
      }

      const status = response && response.status;
      const result = safeJson(data || "", null);
      if (!result) {
        notify("签到失败", `服务器返回非 JSON 内容（HTTP ${status || "未知"}）。`);
        $done();
        return;
      }

      const code = String(result.code === undefined ? "" : result.code);
      const message = String(result.message || result.msg || "");
      if (code === "0000" || code === "0") {
        const reward = result.data && result.data.reward_info;
        notify("签到成功", `奖励：${compact(reward)}${message ? `\n${message}` : ""}`);
      } else if (/已签到|重复签到|今日已/.test(message)) {
        notify("今日已签到", message);
      } else if (code === "8040012" || code === "8040016" || /验证|滑块|人机/.test(message)) {
        notify("需要人工验证", "请进入龙湖天街小程序完成一次滑块或手动签到，模块会自动刷新凭证。 ");
      } else if (status === 401 || /登录|token|Token|授权|过期/.test(message)) {
        notify("登录凭证失效", "请重新进入龙湖天街小程序并手动签到一次。 ");
      } else {
        notify("签到未成功", `代码：${code || status || "未知"}\n${message || compact(result)}`);
      }
      $done();
    }
  );
}

if (typeof $response !== "undefined") {
  captureResponse();
} else if (typeof $request !== "undefined") {
  captureRequest();
} else {
  runSign();
}
