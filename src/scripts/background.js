import ext from "./utils/ext";
import storage from "./utils/storage";
var axios = require('axios');
var CryptoJS = require("crypto-js");
var configTrees = [];
var nextMessage;
var rawMessages;
var configPlace = "config";
var rectRequestAwaiting = 0;
var processedFeed  ={};
var lastScrolledUntil = 0;
var plugin_active = true;

const WIDTH = 440; //dimensions of popup widow
const HEIGHT = 300;

storage.get("usingDevConfig",function(resp){
   if (resp){
       if (resp.usingDevConfig == true){
           configPlace = "devconfig";
       }
   }
});

storage.get('plugin_uid',function(resp){
    var plugin_uid = resp.plugin_uid;
    if (!plugin_uid){
        ext.tabs.create({'url': ext.extension.getURL('registration.html')});
    }
});



/*requests all new Messages to be shown */
function checkIfMessageUpdate(){
    getRequest('https://fbforschung.de/message',null,handleMessageCheck);
}


function isUsingDevConfig(){
    if (configPlace == "devconfig"){
        return true;
    }else{
        return false;
    }
}

function getDevConfig(){
    getRequest("https://fbforschung.de/config/dev",null,parseConfig);
};


function handleOptionCall(resp){
    storage.get(configPlace,function(response){
        console.log(response);
        var version = response[configPlace].version;

        var isDev = isUsingDevConfig();
        var call = {version:version,
              isdevConfig:isDev}
        resp(call);
    });
}

function handleInformationCall(resp){
    checkIfMessageUpdate();
    storage.get(configPlace,function(response){
        var version = response.config.version;
        storage.get('identifier_human',function(response){
            var human = response.identifier_human;
            if (human){
            var call = {version:version,
                        messages: rawMessages,
                        userID:human,
                        pluginActive: plugin_active
                       };
                resp(call);
            }
        });
    });
}



/* forwards a Message as E-Mail
 * @param (js-object) body - body which specifies messageID and E-Mail Adress
 */
function sendAsEmail(body){
       storage.get('plugin_uid',function(resp){
        var plugin_uid = resp.plugin_uid;
        if (plugin_uid){
            storage.get('identifier_password',function(resp){
                var password = resp.identifier_password;
                if (password){
                    var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                    var sBody = body;
                    var sUrl = 'https://fbforschung.de/message/email'; //serverside url to call
                    const request= axios.post(sUrl,sBody,
                    { headers:{
                        "X-Auth-Key" : sNonce,
                        "X-Auth-Checksum":CryptoJS.HmacSHA1(sUrl + JSON.stringify(sBody)+  sNonce, password).toString(),
                        "X-Auth-Plugin" : plugin_uid
                    }});
                    request.then((response)=>{
                         handleMessageCheck(response.data);
                    });
                }
            });
        } else {
            ext.tabs.create({'url': ext.extension.getURL('registration.html')});
        }

    });
}


/* sends a Message Response such as shown, viewed, clicked
 @param (js-object) body  - specifies action and message ID
*/
function MessageResponse(body){
   storage.get('plugin_uid',function(resp){
        var plugin_uid = resp.plugin_uid;
        if (plugin_uid){
            storage.get('identifier_password',function(resp){
                var password = resp.identifier_password;
                if (password){
                    var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                    var sBody = body;
                    var sUrl = 'https://fbforschung.de/message'; //serverside url to call
                    const request= axios.post(sUrl,sBody,
                    { headers:{
                        "X-Auth-Key" : sNonce,
                        "X-Auth-Checksum":CryptoJS.HmacSHA1(sUrl + JSON.stringify(sBody)+  sNonce, password).toString(),
                        "X-Auth-Plugin" : plugin_uid
                    }});
                    request.then((response)=>{
                        if (body.mark_shown == undefined){
                            handleMessageCheck(response.data);
                        }
                    });
                }
            });
        } else {
            ext.tabs.create({'url': ext.extension.getURL('registration.html')});
        }

    });
}

/* takes the first Message to be shown and creates the popup for it */
function handleMessageCheck(data){

    rawMessages = data.result;
    if (data.result.length > 0){
        nextMessage = data.result[0];

        ext.windows.create({url: ext.extension.getURL("popup.html"),
                            width: WIDTH,
                            height: HEIGHT,
                            type: "popup"});
    }
}

/* quick check using the config.version to see if the Plugin config is still up to date */
function checkIfConfigUptoDate(){
    if (isUsingDevConfig()){
        storage.get('devconfig',function(resp){
            var config = resp.config;
            if (config){
                getRequest('https://fbforschung.de/config/dev/'+config.version,null,handleConfigCheck);
            } else {
                getDevConfig();
            }
            });
    } else {
        storage.get('config',function(resp){
            var config = resp.config;
            if (config){
                getRequest('https://fbforschung.de/config/'+config.version,null,handleConfigCheck);
            } else {
                getConfig;
            }
        });
    }
}

function handleConfigCheck(data){
    if (data.is_latest_version == false){
        if (isUsingDevConfig){
            getDevConfig();
        } else {
            getConfig();
        }
    }
}


function sendRecRequest(id){
    rectRequestAwaiting++;
    ext.tabs.query({url:'https://www.facebook.com/'}, function(tabs) {
      ext.tabs.sendMessage(tabs[0].id, {greeting: "getRect", id: id}, function(resp) {
            handleRecRequest(resp.id,resp.rect,resp.body);
      });
    });

}


function handleRecRequest(id,Clientrect,bodyRect){

    var proccessedFeedasString =  JSON.stringify(processedFeed);
    proccessedFeedasString = proccessedFeedasString.replace(id+"top",Clientrect.top-bodyRect.top);
    proccessedFeedasString = proccessedFeedasString.replace(id+"width",Clientrect.width);
    proccessedFeedasString = proccessedFeedasString.replace(id+"height",Clientrect.height);
    proccessedFeedasString = proccessedFeedasString.replace(id+"left",Clientrect.left);
    processedFeed = JSON.parse(proccessedFeedasString);

    rectRequestAwaiting--;
    if (rectRequestAwaiting == 0){
         storage.get('session_uid',function(resp){
            var sessionID = resp.session_uid;
            storage.get('session_date',function(resp){
                var session_date = new Date(resp.session_date);
                if ((sessionID) && ( ((new Date) - session_date) < (60 * 60 * 1000))){ //eine Stunde Abstand
                    sendFeedToServer(processedFeed,lastScrolledUntil,sessionID);
                } else {
                    sendFeedToServer(processedFeed,lastScrolledUntil,null);
                }
            });
        });
    }


}


/* Main Messaging centrum of the Extension, all requests get directed to here */

ext.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.action == "activatePLugin"){
          plugin_active = true;
        }
        if (plugin_active == true){
            switch(request.action){
                case "process-config":
                    storage.get(configPlace,function(resp){
                        var config = resp.config;
                        parseConfig(config);
                        sendResponse(configTrees);
                    });
                    break;
                case "register":
                    restRegister(sendResponse);
                    return true;
                    break;
                case "process-feed":
                    storage.get(configPlace,function(resp){
                    var config = resp.config;
                        lastScrolledUntil = request.scrolledUntil;
                        if (config){
                            var div = document.createElement("div");
                            div.innerHTML = request.data;
                            rectRequestAwaiting = 0;
                            processedFeed = processFeed(config.selectors,div, processedFeed);
                        }else{
                            console.log("something went wrong");
                        }
                    });
                    break;
                case "opened-facebook":                 // we need this to update our Messages and Configs
                    checkIfMessageUpdate();
                    checkIfConfigUptoDate();
                    break;
                case "markShown":
                    MessageResponse({mark_shown:request.uid});
                    break;
                case "getPopupMessage":                 //a popup will request the newest message
                    sendResponse(nextMessage);
                    break;

                case "getOption":
                    handleOptionCall(sendResponse);
                    return true;
                    break;
                case "getInformation":
                    handleInformationCall(sendResponse);
                    return true;
                    break;
                case "setDevConfigStatus":
                    if (request.devConfig == true){
                        configPlace = "devconfig";
                    } else {
                        configPlace = "config";
                    }
                    storage.set({usingDevConfig:request.devConfig},function(){});
                    checkIfConfigUptoDate();

                case "markRead":
                    MessageResponse({mark_read:request.uid});
                    break;
                case "markClicked":
                    MessageResponse({mark_clicked:request.uid});
                    break;
                case "emailThis":
                    sendAsEmail({message: request.uid,
                                 email: request.email});
                    break;
                case "putMessageonMessageStack":
                    for (var i=0; i<rawMessages.length; i++){
                      if (rawMessages[i].uid == request.messageID){
                        nextMessage = rawMessages[i];
                      }
                    }
                    ext.windows.create({url: ext.extension.getURL("popup.html"),
                                        width: WIDTH,
                                        height: HEIGHT,
                                        type: "popup"});
                    break;
                case "updateIcon":            // read `newIconPath` from request and read `tab.id` from sender
                  ext.browserAction.setIcon({
                  path: request.newIconPath,
                  tabId: sender.tab.id
                  });
                  break;
                }
            }
        }
);

/* sends the Feed to the server
 * @param (js-object) feed : the feed containing the post, structured using the config
 * @param (int) scrolledUntil : specifies how deep the user scrolled into his feed
 * @param (int) sessionID : session ID of the last session used, can be null if this is the first post today/in the last hour
*/
function sendFeedToServer(feed,scrolledUntil,sessionID){
    if (sessionID != null) {
        feed['session_uid'] = sessionID;
    }

    var manifestData = ext.runtime.getManifest();
    feed['plugin_version'] = manifestData.version;
    storage.get(configPlace,function(resp){
        var config = resp.config;
        var version = config.version;
        if (version){
            feed['config_version'] = version;
        }


        feed['browser']= navigator.userAgent;
        feed['language']= navigator.language;
        feed['scrolled_until'] = scrolledUntil;

        storage.get('identifier_password',function(resp){
            var password = resp.identifier_password;
            if (password){
                storage.get('plugin_uid',function(resp){
                    var plugin_uid = resp.plugin_uid;
                    if (plugin_uid){
                        var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                        var sBody = feed;
                        var sUrl = 'https://fbforschung.de/posts'; //serverside url to call
                        const request= axios.post(sUrl,sBody,
                        { headers:{
                            "X-Auth-Key" : sNonce,
                            "X-Auth-Checksum":CryptoJS.HmacSHA1(sUrl + JSON.stringify(sBody) +  sNonce, password).toString(),
                            "X-Auth-Plugin" : plugin_uid,
                            "Content-Type" : "application/json"
                        }});
                        request.then((response)=>{
                            var timestamp = new Date();
                            timestamp = timestamp.toString();
                            storage.set({session_uid:response.data.result['uid'],
                                         session_date: timestamp},function(){
                            });
                        });
                        request.catch(error => {
                            var timestamp = new Date();
                            timestamp = timestamp.toString();
                            storage.set({toBeSent:feed,
                                         createdAt: timestamp},function(){
                            });
                        });
                    }
                });
            }
        });
    });

}


function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}



/*
 * Processes the user-feed
 * @Param config - config used to evaluate the feed
 * @Param domNodes - user Feed from Facebook
 * @Param currentObject - object in which the Session Package will be stored
 * this will be recursevly called, reducing the config and data in the Process
*/
function processFeed(config,domNode, currentObject){
    var selectors = config.selectors;

    var selectedDomNodes = [domNode];
    if (config.css != "") {
        var selectedDomNodes = domNode.querySelectorAll(config.css);
    }

    if (config.nodetype == "post") {
        currentObject.posts = [];
    }


    for (var i = 0; i < selectedDomNodes.length; i++) {
         if (config.nodetype == "post") {
            var post = {};
            handleActions(config,selectedDomNodes[i], post);
            for (var e = 0; e < selectors.length; e++) {
              post = processFeed(selectors[e],selectedDomNodes[i], post);
            }
            if (!isEmpty(post)){
                post['position_ordinal'] = i+1;
                post['position_onscreen'] = selectedDomNodes[i].id + "top";
                sendRecRequest(selectedDomNodes[i].id);
                currentObject.posts.push(post);
            }
         } else {
            handleActions(config,selectedDomNodes[i], currentObject);
            for (var e = 0; e < selectors.length; e++) {
                if (config.description == "Interaktionen"){

                } else {
                    processFeed(selectors[e],selectedDomNodes[i], currentObject);
                }
            }
        }
    }
    return currentObject;
}

/* handels the Action for a given config node and domNode and appends it to the currentObject */
function handleActions(config, domNode, currentObject){
    if (config.attribute.startsWith("attr-")){
        currentObject[config.column] = domNode.getAttribute(config.attribute.substr(5,config.attribute.length-5));
    } else{
        if (config.attribute.startsWith("data-")){
            var dataObjStr = config.attribute.substr(5,config.attribute.length-5);
            currentObject[config.column] = domNode.dataset.dataObjStr;
        } else {
            if (config.attribute.startsWith("static-")){
                var dataObjStr = config.attribute.substr(7,config.attribute.length-7);
                currentObject[config.column] = domNode.dataset.dataObjStr;
            } else {
                switch (config.attribute) {
                    case 'text':
                        currentObject[config.column] = domNode.innerText;
                        break;
                    case 'html':
                        currentObject[config.column] = domNode.innerHTML;
                        break;
                    case 'exists':
                        currentObject[config.column] = true;
                        break;
                    case 'count':
                        if (currentObject.hasOwnProperty(config.column)) {
                            currentObject[config.column] ++;
                        } else {
                            currentObject[config.column] = 0;
                        }
                        break;
                    case 'width':
                        currentObject[config.column] = domNode.id + "width";
                        sendRecRequest(domNode.id);
                        break;
                    case 'height':
                        currentObject[config.column] = domNode.id + "height";
                        sendRecRequest(domNode.id);
                        break;

                    case 'top':
                        currentObject[config.column] = domNode.id + "top";
                        sendRecRequest(domNode.id);
                        break;

                    case 'left':
                        currentObject[config.column] = domNode.id + "left";
                        sendRecRequest(domNode.id);
                        break;

                    default:
                        break;
                }
            }
        }
    }

    if (config.anonymize == 1){
        currentObject[config.column] = CryptoJS.SHA3(currentObject[config.column], { outputLength: 224 }).toString();
    }
}

/**
 * Calls the register function and registers the Plugin.
 *
 *
 */
function restRegister(responseFunction){
    storage.get('identifier_password',function(resp){
    var password = resp.identifier_password;
    if (password){
        storage.get('identifier_human',function(resp){
            var human = resp.identifier_human;
            if (human){
              var sNonce = CryptoJS.lib.WordArray.random(16).toString();
              var sBody = {        //Body to be sent
                  "identifier_human":human,
                  "identifier_password":password};
              var _sUrl = 'https://fbforschung.de/register'; //serverside url to call
              const request= axios.post(_sUrl,sBody,
                { headers:{
                    "X-Auth-Key" : sNonce,
                    "X-Auth-Checksum":CryptoJS.HmacSHA1(_sUrl + JSON.stringify(sBody)+  sNonce, "B6iXyk8XB2DwTOdhnpDO8E8i8cMad1QX9mE6VXC1lWGPitYdb08ft4zDOX3q").toString(),
                    "Content-Type":"application/json",
                }});
              request.then((response)=>{
                  storage.set({plugin_uid:response.data.result['uid']},function(){
                    storage.set({usingDevConfig:false},function(){});
                    responseFunction({worked:true});
                    getConfig();
                    checkIfMessageUpdate();
                  });
              });
              request.catch(error => {
                responseFunction({worked:false});
                if (error.response.status === 403){
                    getConfig();
                } else {

                    return Promise.reject(error.response);
                }
              });
            }
        });
    }
    });
}

/* gets the newest Config */
function getConfig(){
    getRequest("https://fbforschung.de/config",null,parseConfig);
}

/** Performs a restGet where PluginID and Password get loaded form Storage
  *
  * @param {string} _sUrl Url to call
  * @param {function} _fCallback callback function with (at least) one JS object parameter
 */
function getRequest(_sUrl,_sBody,_fCallback){
    storage.get('plugin_uid',function(resp){
        var plugin_uid = resp.plugin_uid;
        if (plugin_uid){
            storage.get('identifier_password',function(resp){
                var password = resp.identifier_password;
                if (password){
                    restGET(plugin_uid,_sUrl,password,_fCallback,_sBody);
                }
            });
        }

    });
}



/**
 * Retrieve data from the REST API using a GET request.
 *
 * @param {integer}  _nPlugin   plugin UID for authentication
 * @param {string}   _sUrl      full URL to call
 * @param {function} _fCallback callback function with (at least) one JS object parameter
 */

function restGET(_nPlugin, _sUrl,_sPassword, _fCallback, _sBody) {
    var strBody ="";
    var sNonce = CryptoJS.lib.WordArray.random(16).toString();
    if (_sBody != null){
        strBody = JSON.stringify(_sBody);
        const request= axios.get(_sUrl, _sBody,
                    { headers:{
                        "X-Auth-Key" : sNonce,
                        "X-Auth-Checksum":CryptoJS.HmacSHA1(_sUrl + strBody+  sNonce, _sPassword).toString(),
                        "X-Auth-Plugin" : _nPlugin
                    }});
        request.then((response)=>{
            _fCallback(response.data);
        });
    } else {
        const request= axios.get(_sUrl,
                    { headers:{
                        "X-Auth-Key" : sNonce,
                        "X-Auth-Checksum":CryptoJS.HmacSHA1(_sUrl +  sNonce, _sPassword).toString(),
                        "X-Auth-Plugin" : _nPlugin
                    }});
        request.then((response)=>{
            _fCallback(response.data);
        });
    }
}



/*
* Saves standart Config to local Storage
*/
function parseConfig(config){

    var isUsingdev = isUsingDevConfig();
    if (isUsingdev == true){
         storage.set({devconfig:config.result},function(){
         });
    } else {
    storage.set({config:config.result},function(){
         });
    }
}
