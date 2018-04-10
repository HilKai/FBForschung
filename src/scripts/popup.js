import ext from "./utils/ext";
import storage from "./utils/storage";

var uid = 0;

//gets the message content from the background script
ext.runtime.sendMessage({action:"getPopupMessage"},function(response){
    ext.runtime.sendMessage({action:"markShown", uid:response.uid},function(response){
    });
    var displayContainer = document.getElementById("display-container");
    displayContainer.innerHTML = response.message;
    var PopupTitle = document.getElementById("Title");
    PopupTitle.innerHTML = response.title;
    uid = response.uid;
});

//marks this message as read
document.getElementById("ReadButton").onclick= function markRead(){
    ext.runtime.sendMessage({action:"markRead", uid:uid},function(response){
    });
}


document.getElementById("showEmailInput").onclick = function toggelEmail(){
    if (document.getElementById("EmailRow").style.visibility == 'hidden'){
        document.getElementById("EmailRow").style.visibility = 'visible';
    } else {
        document.getElementById("EmailRow").style.visibility = 'hidden';
    }
}

//marks this message to be emailed to the adress given
document.getElementById("EmailButton").onclick= function sendAsEmail(){
    ext.runtime.sendMessage({action:"emailThis",
                             uid:uid,
                             email:document.getElementById("email").value
                            },function(response){
    });
}
