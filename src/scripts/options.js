import ext from "./utils/ext";

var loading = '<span class="text-muted">lädt ...</span>';
document.getElementById("HumanID").innerHTML = loading;
document.getElementById("PluginVersion").innerHTML = loading;
document.getElementById("ConfigVersion").innerHTML = loading;

//gets config version and devConfig status form background script
ext.runtime.sendMessage({action:"getOption"}, function(response) {
    document.getElementById("HumanID").innerHTML = response.identifier_human;
    if(response.pluginActive) {
        document.getElementById("PluginVersion").innerHTML = response.plugin;
    } else {
        document.getElementById("PluginVersion").innerHTML = response.plugin + ' (inaktiv)';
    }
    document.getElementById("ConfigVersion").innerHTML = response.version;
    document.getElementById("devConfigCheck").checked = response.isdevConfig;
});

document.getElementById("devConfigCheck").onclick = function() {
    document.getElementById("ConfigVersion").innerHTML = loading;
    var usingDevConfig = document.getElementById("devConfigCheck").checked;
    ext.runtime.sendMessage({action:"setDevConfigStatus", devConfig:usingDevConfig}, function(configResponse) {
        document.getElementById("ConfigVersion").innerHTML = configResponse.version;
    });
};

document.getElementById("resetBtn").onclick = function() {
    document.getElementById("HumanID").innerHTML = loading;
    ext.runtime.sendMessage({action:"resetLocalStorage"},function(response) {});
};

document.getElementById("configBtn").onclick = function() {
    document.getElementById("ConfigVersion").innerHTML = loading;
    ext.runtime.sendMessage({action:"setDevConfigStatus", devConfig:document.getElementById("devConfigCheck").checked}, function(configResponse) {
        document.getElementById("ConfigVersion").innerHTML = configResponse.version;
    });
};
