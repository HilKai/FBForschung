import ext from "./utils/ext";

/**
 * Toggle OWL active state (visually)
 * @param _bIsActive
 */
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

/**
 * List the messages on the overview page and set their click handler
 * @param _messages
 */
function listMessages(_messages) {
    var messagesToAdd = "";
    if (typeof(_messages) != 'undefined') {
        for (var i = 0; i < _messages.length; i++) {
            messagesToAdd += '<li><a href="#' + _messages[i].uid + '" id="messageLink' + i + '" class="message">' + _messages[i].title + '</a></li>';
        }
    }
    if (messagesToAdd == '') {
        messagesToAdd = '<li class="text-muted">derzeit keine Mitteilungen</li>';
    }
    document.getElementById("Messages").innerHTML = messagesToAdd;

    //message on-click handlers
    var elem = document.getElementsByClassName("message");
    for (var i = 0; i < elem.length; i++) {
        /**
         * Message click handler
         * @param _oEvent
         * @returns {boolean}
         */
        elem[i].onclick = function (_oEvent) {
            _oEvent.preventDefault();
            ext.runtime.sendMessage({action:"showMessage", uid: this.href.split('#')[1] }, function(response) {});
            return false;
        };
    }
}

/**
 * On load, load messages, config, status, ... and set onclick handlers
 */
function init() {
    //hide initial login/logout in order to let it be set through the config (after loading ...)
    document.getElementById('loggedin').style.display = 'none';
    document.getElementById('loggedout').style.display = 'none';

    //get initial information
    ext.runtime.sendMessage({action: "getInformation"}, function (response) {
        if(response.pluginRegistered) {
            //plugin is registered

            //add some config information
            document.getElementById('loggedin').style.display = 'block';
            document.getElementById("PluginVersion").innerHTML = response.version;
            document.getElementById("fbforschungLink").href = "https://fbforschung.de/login/plugin/" + response.userID;
            toggleActiveStatus(response.pluginActive);

            //display the messages
            listMessages(response.messages);
        } else {
            //the plugin is not yet registered
            document.getElementById('loggedout').style.display = 'block';
        }
    });

    /**
     * Click login (shown when logged out).
     * @param _oEvent
     * @returns {boolean}
     */
    document.getElementById('login').onclick = function(_oEvent) {
        _oEvent.preventDefault();
        ext.runtime.sendMessage({action: "resetLocalStorage"}, function (response) {});
        return false;
    };

    /**
     * Click activate (shown when deactivated).
     * @param _oEvent
     * @returns {boolean}
     */
    document.getElementById('active-activate').onclick = function(_oEvent) {
        _oEvent.preventDefault();
        ext.runtime.sendMessage({"action":"activatePlugin"}, function(response) {
            toggleActiveStatus(response.pluginStatus);
        });
        return false;
    };

    /**
     * Click deactivate (shown when active).
     * @param _oEvent
     * @returns {boolean}
     */
    document.getElementById('active-deactivate').onclick = function(_oEvent) {
        _oEvent.preventDefault();
        ext.runtime.sendMessage({"action":"deactivatePlugin"},function(response){
            toggleActiveStatus(response.pluginStatus);
        });
        return false;
    };
}

//window.onload = init;
(function() {
    init();
})();
