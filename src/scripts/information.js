import ext from "./utils/ext";

function toggleActiveStatus(_bIsActive) {
    if(_bIsActive) {
        document.getElementById('active-activate').classList.add('btn-secondary');
        document.getElementById('active-activate').classList.remove('btn-outline-secondary');
        document.getElementById('active-activate').innerText = '(aktiv)';
        document.getElementById('active-deactivate').classList.add('btn-outline-secondary');
        document.getElementById('active-deactivate').classList.remove('btn-secondary');
        document.getElementById('active-deactivate').innerText = 'deaktivieren';
    } else {
        document.getElementById('active-activate').classList.add('btn-outline-secondary');
        document.getElementById('active-activate').classList.remove('btn-secondary');
        document.getElementById('active-activate').innerText = 'aktivieren';
        document.getElementById('active-deactivate').classList.add('btn-secondary');
        document.getElementById('active-deactivate').classList.remove('btn-outline-secondary');
        document.getElementById('active-deactivate').innerText = '(inaktiv)';
    }
}

//gets config version and devConfig status form background script
window.onload = function() {
    document.getElementById('loggedin').style.display = 'none';
    document.getElementById('loggedout').style.display = 'none';
    ext.runtime.sendMessage({action: "getInformation"}, function (response) {
        if(response.pluginRegistered) {
            document.getElementById('loggedin').style.display = 'block';
            document.getElementById("PluginVersion").innerHTML = response.version;
            document.getElementById("fbforschungLink").href = "https://fbforschung.de/login/plugin/" + response.userID;
            toggleActiveStatus(response.pluginActive);

            var messagesToAdd = "";
            if (typeof(response.messages) != 'undefined') {
                for (var i = 0; i < response.messages.length; i++) {
                    messagesToAdd += '<li><a href="#" id="messageLink' + i + '" class="messageLink" value="' + response.messages[i].uid + '">' + response.messages[i].title + '</a></li>';
                }
            }
            if (messagesToAdd == '') {
                messagesToAdd = '<li class="text-muted">derzeit keine Mitteilungen</li>';
            }
            document.getElementById("Messages").innerHTML = messagesToAdd;
            var elem = document.getElementsByClassName("messageLink");
            for (var i = 0; i < elem.length; i++) {
                elem[i].onclick = function (sender) {
                    ext.runtime.sendMessage({
                        action: "putMessageonMessageStack",
                        messageID: sender.target.attributes.value.value
                    }, function (reponse) {
                    });
                }
            }
        } else {
            document.getElementById('loggedout').style.display = 'block';
        }
    });

    document.getElementById('login').onclick = function(_oEvent) {
        _oEvent.preventDefault();
        ext.runtime.sendMessage({action: "resetLocalStorage"}, function (response) {
        });
    };

    document.getElementById('active-activate').onclick = function(_oEvent) {
        _oEvent.preventDefault();
        ext.runtime.sendMessage({"action":"activatePlugin"}, function(response) {
            toggleActiveStatus(response.pluginStatus);
        });
        return false;
    };
    document.getElementById('active-deactivate').onclick = function(_oEvent) {
        _oEvent.preventDefault();
        ext.runtime.sendMessage({"action":"deactivatePlugin"},function(response){
            toggleActiveStatus(response.pluginStatus);
        });
        return false;
    };
};
