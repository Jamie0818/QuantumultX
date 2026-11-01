/* Surge 签到中心 11:00 漏执行提醒：只读本机结果，不读取凭证 */
(function(){
  function today(){var d=new Date();return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);}
  function read(k){try{return $persistentStore.read(k)||"";}catch(e){return "";}}
  function write(k,v){try{return $persistentStore.write(v,k);}catch(e){return false;}}
  function parse(s){try{return JSON.parse(s);}catch(e){return null;}}
  var day=today(), missed=[], services=[["jd","京东京豆"],["chagee","霸王茶姬"],["atour","亚朵"],["huazhu","华住会"]];
  for(var i=0;i<services.length;i++){
    var k=services[i][0],obj=parse(read("checkin_v2_result_"+k));
    if(!obj||obj.date!==day)missed.push(services[i][1]);
  }
  if(missed.length){
    var warnKey="checkin_v2_missed_notified";
    if(read(warnKey)!==day){
      $notification.post("自动签到漏执行提醒","以下项目今天未找到执行记录",missed.join("、")+"。检查 Surge 是否运行、模块是否启用及脚本日志。");
      write(warnKey,day);
    }
  }
  $done();
})();