/*
 * Surge 签到中心 v2：只操作指定平台的签到接口
 * 所有凭证和结果保存在设备的 $persistentStore；没有对第三方的回传
 * 部署：同目录 Auto_Checkin_v2.sgmodule，每个任务通过 $argument 区分。
 */
(function () {
  "use strict";
  var arg = typeof $argument === "string" ? $argument : "";
  var parts = arg.split(":");
  var operation = parts[0] || "";
  var service = parts[1] || "";
  var names = { jd:"京东京豆", chagee:"霸王茶姬", atour:"亚朵", huazhu:"华住会", bili:"B站" };
  var name = names[service] || service || "签到";
  var completed = false;
  var requestTimeout = 16000;
  function read(k) { try { return $persistentStore.read(k) || ""; } catch (_) { return ""; } }
  function write(k,v) { try { return !!$persistentStore.write(String(v),k); } catch (_) { return false; } }
  function safeJSON(s) { try { return JSON.parse(s); } catch (_) { return null; } }
  function header(headers,key) {
    var ks=Object.keys(headers||{});
    for(var i=0;i<ks.length;i++) if(ks[i].toLowerCase()===key.toLowerCase()) return String(headers[ks[i]]||"");
    return "";
  }
  function cleanHeaders(headers) {
    var r={}, deny=/^(host|content-length|connection|transfer-encoding|accept-encoding|proxy-connection|:method|:scheme|:authority|:path)$/i;
    Object.keys(headers||{}).forEach(function(k){if(!deny.test(k) && typeof headers[k]==="string")r[k]=headers[k];});
    return r;
  }
  function today() {
    var d=new Date();return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  }
  function notify(sub,msg) { $notification.post("签到提醒·"+name,sub,msg,{"auto-dismiss":false}); }
  function end() {if(completed)return;completed=true;$done();}
  function captureOk(msg) { notify("凭证获取成功",msg+"；自动签到前仍需要验证接口是否可用。");end(); }
  function result(outcome,reason) {
    if(completed)return;
    var status={date:today(),time:new Date().toISOString(),status:outcome,detail:String(reason||"").slice(0,160)};
    write("checkin_v2_result_"+service,JSON.stringify(status));
    if(outcome==="fail") notify("未成功，请检查",String(reason||"未知错误").slice(0,180));
    console.log(name+" "+outcome+": "+String(reason||"").slice(0,150));
    end();
  }
  function network(url,method,headers,body,callback) {
    var options={url:url,headers:headers||{},timeout:requestTimeout/1000,"auto-cookie":false};
    if(body!==undefined)options.body=body;
    var done=false;
    var job=function(err,res,data){
      if(done)return;done=true;
      if(err)return callback("网络错误或连接超时");
      var status=Number(res&& (res.status||res.statusCode)||0);
      if(status===401||status===403)return callback("登录失效或权限被拒绝（HTTP "+status+"）");
      if(status<200||status>=300)return callback("服务器返回 HTTP "+status);
      var json=safeJSON(data||"");
      if(!json)return callback("返回内容不是 JSON，请查看 Surge 日志");
      callback(null,json,data);
    };
    try{
      if(method==="POST")$httpClient.post(options,job);
      else $httpClient.get(options,job);
    }catch(e){callback("脚本请求异常");}
  }
  function capture(){
    try{
      if(typeof $request==="undefined"||!$request.url||!$request.headers)return end();
      var h=$request.headers, url=String($request.url);
      if(service==="jd"){
        var c=header(h,"cookie");
        if(/(?:^|;\s*)pt_key=[^;]+/.test(c)&&/(?:^|;\s*)pt_pin=[^;]+/.test(c)) {
          if(read("checkin_v2_jd_cookie")===c)return end();
          if(write("checkin_v2_jd_cookie",c))return captureOk("京东 Cookie 已保存");
        }
        return end();
      }
      if(service==="chagee"){
        var token=header(h,"Qm-User-Token"), body=String($request.body||"");
        if(!token||!body)return end();
        var payload={headers:cleanHeaders(h),body:body,url:url};
        if(write("checkin_v2_chagee",JSON.stringify(payload))){
          write("bw_token",token);write("bw_body",body);
          return captureOk("霸王茶姬签到请求已保存");
        }
        return end();
      }
      if(service==="atour"){
        var qs=url.split("?")[1]||"";
        if(!qs)return end();
        write("adjd_header",JSON.stringify(h));write("adjd_url",qs);
        return captureOk("亚朵签到请求头与参数已保存");
      }
      if(service==="huazhu"){
        var tk=header(h,"user-token");
        if(tk&&read("HZH_Token")===tk)return end();
        if(tk&&write("HZH_Token",tk))return captureOk("华住会会员 Token 已保存");
        return end();
      }
      if(service==="bili"){
        var cookie=header(h,"cookie");
        if(cookie.indexOf("DedeUserID=")>=0 && cookie.indexOf("SESSDATA=")>=0 && cookie.indexOf("bili_jct=")>=0){
          if(write("checkin_v2_bili_cookie",cookie))return captureOk("B站 Cookie 已保存（未启用旧版自动投币任务）");
        }
        return end();
      }
      end();
    }catch(e){console.log("抓取检查失败："+String(e));end();}
  }
  function sign(){
    if(service==="atour"){
      var qs=read("adjd_url"), h=safeJSON(read("adjd_header"));
      if(!qs||!h)return result("fail","未抓到完整凭证：进入亚朵 App → 会员 → 每日签到，手动签到一次。");
      return network("https://miniapp.yaduo.com/atourlife/signIn/signIn?"+qs,"GET",cleanHeaders(h),undefined,function(err,o){
        if(err)return result("fail",err);
        if(String(o.retcode)==="0")return result("success",String((o.result&&o.result.debrisDesc)||"签到成功"));
        if(/已签到|重复|already/i.test(String(o.retmsg||"")))return result("already","今日已经签到");
        result("fail","接口未确认成功："+String(o.retmsg||o.retcode||"未知原因").slice(0,90));
      });
    }
    if(service==="huazhu"){
      var token=read("HZH_Token");
      if(!token)return result("fail","会员 Token 未抓到：请重新打开华住会 App 并登录。");
      var day=("0"+new Date().getDate()).slice(-2);
      var h={"Content-Type":"application/x-www-form-urlencoded","Client-Platform":"APP-IOS","User-Token":token};
      return network("https://hweb-mbf.huazhu.com/api/signIn","POST",h,"state=1&day="+day,function(err,o){
        if(err)return result("fail",err);
        if(String(o.businessCode)==="1000"){
          if(o.content&&o.content.success===true)return result("success","签到成功");
          if(o.content&&o.content.isSign===true)return result("already","今日已经签到");
        }
        result("fail","平台未确认签到成功："+String(o.message||o.msg||o.businessCode||"未知原因").slice(0,90));
      });
    }
    if(service==="chagee"){
      var obj=safeJSON(read("checkin_v2_chagee"));
      if(!obj||!obj.body||!obj.headers)return result("fail","未保存完整请求：打开霸王茶姬微信小程序 → 积分商城 → 积分签到，手动签到一次。");
      if(!/^https:\/\/webapi\.qmai\.cn\/web\/catering\/integral\/sign\/signIn(?:\?|$)/.test(obj.url||""))return result("fail","原始签到请求地址不匹配，拒绝执行。");
      return network(obj.url,"POST",cleanHeaders(obj.headers),obj.body,function(err,o){
        if(err)return result("fail",err);
        var code=String(o.code===undefined?"":o.code);
        if(code==="0")return result("success","积分签到成功");
        if(code==="400041"||/已签|重复签到|already/i.test(String(o.message||o.msg||"")))return result("already","今日已经签到");
        result("fail","平台未确认成功："+String(o.message||o.msg||code||"未知原因").slice(0,90));
      });
    }
    if(service==="jd"){
      var cookie=read("checkin_v2_jd_cookie");
      if(!cookie||cookie.indexOf("pt_key=")<0||cookie.indexOf("pt_pin=")<0)return result("fail","未获取京东登录凭证：用 Safari 登录京东个人中心触发 Cookie 抓取。");
      return network("https://api.m.jd.com/client.action","POST",{"Cookie":cookie,"Content-Type":"application/x-www-form-urlencoded"},"functionId=signBeanIndex&appid=ld",function(err,o,raw){
        if(err)return result("fail",err);
        var s=String(raw||"");
        if(String(o.code)==="3")return result("fail","京东登录 Cookie 已过期");
        if(/已签到|今天已经签到|今日已签/.test(s))return result("already","今日已经签到");
        if(/"status"\s*:\s*"?1"?/.test(s))return result("success","京豆接口返回签到成功");
        result("fail","京豆接口未确认成功，可能已更换规则或需要验证");
      });
    }
    result("fail","该平台未接入自动签到");
  }
  if(operation==="capture")capture();
  else if(operation==="sign")sign();
  else end();
})();
