import ext from "./utils/ext";
import storage from "./utils/storage";


//gets config version and devConfig status form background script
ext.runtime.sendMessage({action:"getOption"},function(response){
    document.getElementById("PluginVersion").innerHTML = response.version;
    document.getElementById("devConfigCheck").checked = response.isdevConfig;
});



document.getElementById("devConfigCheck").onclick= function toggleDev(){
    var usingDevConfig = document.getElementById("devConfigCheck").checked
    ext.runtime.sendMessage({action:"setDevConfigStatus",devConfig:usingDevConfig},function(response){
    });
}

document.getElementById("resetBtn").onclick= function toggleDev(){
    ext.runtime.sendMessage({action:"resetLocalStorage"},function(response){
    });
}
