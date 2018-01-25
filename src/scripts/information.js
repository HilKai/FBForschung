import ext from "./utils/ext";
import storage from "./utils/storage";

var uid = 0;

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
            console.log(sender);
        }
    }
});










