# 龙湖天街自动签到（Surge）

## 一键安装

在 Surge 的“模块”中添加下面的 URL：

`https://raw.githubusercontent.com/Jamie0818/QuantumultX/master/Surge/Modules/Longfor/Longfor_Auto_Sign_v1.4.sgmodule`

启用模块并确认 MITM 证书已安装和信任。v1.4 保存用户本人实际发起的 `signature/clock` 签到请求所需请求头与请求体，并由定时任务原样重放，不再依赖猜测 Token 字段名。首次使用时，在模块启用状态下手动签到一次；收到“签到请求已保存”通知后，模块会在每天手机本地时间 09:18 自动签到。

## 隐私与限制

- 签到请求头、请求体、Token 和风控 Token仅保存在 Surge 本机 `$persistentStore`，不会上传到 GitHub 或第三方服务器。
- 遇到滑块、人机验证或登录过期时，脚本只发送通知，需要手动完成一次验证。
- 龙湖修改接口、活动编号或风控规则后，模块可能需要更新。
