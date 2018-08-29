import ext from "./utils/ext";

/**
 * On load, load message and set onclick handlers
 */
window.onload = function() {
    ext.runtime.sendMessage({action:"getMessageToShow" }, function(response) {
        ext.runtime.sendMessage({action:"markShown", uid: response.uid}, function(response) {});
        document.getElementById('message').dataset.message = response.uid;
        document.getElementById("display-container").innerHTML = response.message;
        document.getElementById("Title").innerHTML = response.title;
        document.getElementById('EmailRow').style.display = 'none';

        /**
         * Handle link-clicking inside the message
         * @param _oEvent
         * @returns {boolean}
         */
        var links = document.getElementById('display-container').getElementsByTagName('a');
        for(var j = 0; j < links.length; j++) {
            links[j].onclick = function (_oEvent) {
                ext.runtime.sendMessage({
                    action: "markClicked",
                    uid: document.getElementById('message').dataset.message
                }, function (response) {});
                return true;
            };
        }

        /**
         * Click "mark read" (shown in message detail view).
         * @param _oEvent
         * @returns {boolean}
         */
        document.getElementById("ReadButton").onclick = function(_oEvent) {
            _oEvent.preventDefault();
            var message_uid = document.getElementById('message').dataset.message;
            ext.runtime.sendMessage({action:"markRead", uid: message_uid}, function(response) {});
            return false;
        };

        /**
         * Click "send via email" in order to display the email input field (shown in message detail view).
         * @param _oEvent
         * @returns {boolean}
         */
        document.getElementById("showEmailInput").onclick = function(_oEvent) {
            _oEvent.preventDefault();
            if (document.getElementById("EmailRow").style.display == 'none') {
                document.getElementById('EmailRow').style.display = 'block';
            } else {
                document.getElementById('EmailRow').style.display = 'none';
            }
            return false;
        };

        /**
         * Send an email (shown in message detail view).
         * @param _oEvent
         * @returns {boolean}
         */
        document.getElementById("EmailButton").onclick = function(_oEvent) {
            _oEvent.preventDefault();
            var mail = document.getElementById('email').value,
                message_uid = document.getElementById('message').dataset.message;
            if(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(mail)) {
                ext.runtime.sendMessage({
                    action: "emailThis",
                    uid: message_uid,
                    email: mail
                }, function (response) {});
            } else {
                alert(mail + ' ist keine gültige E-Mail-Adresse.');
            }
            return false;
        };
    });
};
