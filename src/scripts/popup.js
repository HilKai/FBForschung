import ext from "./utils/ext";
var uid = null;

//gets the message content from the background script
ext.runtime.sendMessage({action:"getPopupMessage"}, function(response) {
    ext.runtime.sendMessage({action:"markShown", uid: response.uid}, function(response) {});
    document.getElementById("display-container").innerHTML = response.message;
    document.getElementById("Title").innerHTML = response.title;
    uid = response.uid;
});

//marks this message as read
document.getElementById("ReadButton").onclick = function() {
    ext.runtime.sendMessage({action:"markRead", uid:uid}, function(response) {});
};

document.getElementById("showEmailInput").onclick = function() {
    if (document.getElementById("EmailRow").style.visibility == 'hidden') {
        document.getElementById("EmailRow").style.visibility = 'visible';
    } else {
        document.getElementById("EmailRow").style.visibility = 'hidden';
    }
};

document.getElementById("EmailButton").onclick = function() {
    var mail = document.getElementById('email').value;
    if(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(mail)) {
        ext.runtime.sendMessage({
            action: "emailThis",
            uid: uid,
            email: mail
        }, function (response) {});
    } else {
        alert(mail + ' ist keine gültige E-Mail-Adresse.');
    }
};
