# 龙湖天街自动签到（Surge）

## 一键安装

在 Surge 的“模块”中添加下面的 URL：

`https://raw.githubusercontent.com/Jamie0818/QuantumultX/master/Surge/Modules/Longfor/Longfor_Auto_Sign_v1.3.sgmodule`

启用模块并确认 MITM 证书已安装和信任。v1.3 根据实际请求从 `key2token` 登录响应获取 Token，并从任务请求补充风控凭证；脚本只处理登录和任务接口。首次使用时，完全退出并重开微信，然后进入“龙湖天街”小程序的任务/签到页面。收到“凭证已保存”通知后，模块会在每天手机本地时间 09:18 自动签到。

## 隐私与限制

- Token 和风控 Token 仅保存在 Surge 本机 `$persistentStore`，不会上传到 GitHub 或第三方服务器。
- 遇到滑块、人机验证或登录过期时，脚本只发送通知，需要手动完成一次验证。
- 龙湖修改接口、活动编号或风控规则后，模块可能需要更新。
