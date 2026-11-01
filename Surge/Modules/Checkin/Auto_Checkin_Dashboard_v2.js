/* Surge 签到中心：查看当天定时任务执行结果（只读本机简短状态） */
(function(){
  function read(k){try{return $persistentStore.read(k)||"";}catch(e){return "";}}
  function parse(s){try{return JSON.parse(s);}catch(e){return null;}}
  function day(){var d=new Date();return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);}
  var t=day(),services=[["jd","京东"],["chagee","霸王茶姬"],["atour","亚朵"],["huazhu","华住会"]];
  var rows=services.map(function(s){
    var r=parse(read("checkin_v2_result_"+s[0]));
    if(!r || r.date!==t)return s[1]+"：未运行或无记录";
    if(r.status==="success")return s[1]+"：签到成功";
    if(r.status==="already")return s[1]+"：今天已签到";
    return s[1]+"：未确认成功";
  });
  rows.push("建行生活：使用原签到脚本通知/日志");
  rows.push("龙湖：查看原龙湖签到面板");
  rows.push("B站/值得买：未启用自动签到");
  var result=rows.join("\n")+"\n\n若有“未确认成功”，检查 Surge 的失败通知。\n仅显示设备内的执行记录，不代表全部奖励已到账。";
  $done({title:"每日自动签到 · "+t,content:result,style:"info"});
})();