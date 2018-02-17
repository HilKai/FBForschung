import ext from "./utils/ext";
import storage from "./utils/storage";

var uid = 0;


ext.runtime.sendMessage({action:"isPluginActive"},function(response){
  if (!response.pluginStatus){
      document.getElementById("Text").innerHTML ="Das Plugin ist derzeit inaktiv. Sie können es  <a id='activate' href='#'>hier</a> wieder aktivieren."
      document.getElementById("activate").onclick = function (sender){
        ext.runtime.sendMessage({"action":"activatePLugin"},function(response){
        });
        console.log("activatePLugin");
        location.reload();
      };
  }
});
//gets config version and devConfig status form background script
ext.runtime.sendMessage({action:"getInformation"},function(response){
    console.log(response);
    document.getElementById("PLuginVersion").innerHTML = response.version;
    var messagesToAdd ="";

    for (var i =0;i<response.messages.length;i++){
        messagesToAdd += '<li><a href="#" id="messageLink'+i+'" class="messageLink" value="'+response.messages[i].uid +'">'+response.messages[i].title+'</a></li>';
    }
    document.getElementById("Messages").innerHTML = messagesToAdd;
      if (!response.pluginActive){
        document.getElementById("Text").innerHTML ="Das Plugin ist derzeit inaktiv. Sie können es hier wieder aktivieren."
    }

    document.getElementById("fbforschungLink").href="https://fbforschung.de/login/plugin/"+response.userID;

    var elem = document.getElementsByClassName("messageLink");

    for(var i=0; i<elem.length; i++) {
        elem[i].onclick =function(sender){

          console.log(sender.target.attributes.value.value);
          ext.runtime.sendMessage({action:"putMessageonMessageStack",messageID:sender.target.attributes.value.value},function(reponse){});
        }
    }

    document.getElementById("deactivate").onclick = function (sender){
      ext.runtime.sendMessage({"action":"deactivatePlugin"},function(response){
      });
      location.reload();
    };


});
