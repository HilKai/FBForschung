import ext from "./utils/ext";
import storage from "./utils/storage";

var axios = require('axios');
var CryptoJS = require("crypto-js");
var configTrees = [];
var nextMessage;
var rawMessages;
var configPlace = "config";
var rectRequestAwaiting = 0;
var processedFeed = {};
var lastScrolledUntil = 0;
var plugin_active = true;
var interactionSelector = [];
var openWindows = [];

function handleInstalled(details) {
    ext.storage.sync.clear();
}

ext.runtime.onInstalled.addListener(handleInstalled);

storage.get("registered", function (resp) {
    if (resp.registered != true) {
        ext.tabs.create({'url': ext.extension.getURL('registration.html')});
    }
});

storage.get("usingDevConfig", function (resp) {
    if (resp) {
        if (resp.usingDevConfig == true) {
            configPlace = "devconfig";
        }
    }
});


/*requests all new Messages to be shown */
function checkIfMessageUpdate() {
    console.log('checking for new messages');
    getRequest('https://fbforschung.de/message', null, handleMessageCheck);
}

function isUsingDevConfig() {
    return (configPlace == "devconfig");
}

function getConfig(_fCallback) {
    console.log('fetching current main config');
    getRequest("https://fbforschung.de/config", '', function(response) {
        storage.set({config: response.result}, function () {
            if(_fCallback) {
                _fCallback(response.result);
            }
        });
    });
}

function getDevConfig(_fCallback) {
    console.log('fetching current dev config');
    getRequest("https://fbforschung.de/config/dev", '', function(response) {
        storage.set({devconfig: response.result}, function () {
            if(_fCallback) {
                _fCallback(response.result);
            }
        });
    });
}

function handleOptionCall(resp) {
    storage.get(configPlace, function (response) {
        if(typeof(response[configPlace]) !== 'undefined') {
            var call = {
                version: response[configPlace].version,
                isdevConfig: isUsingDevConfig(),
                identifier_human: null,
                plugin: ext.runtime.getManifest().version,
                pluginActive: plugin_active
            };
            storage.get('identifier_human', function (response) {
                call.identifier_human = response.identifier_human;
                resp(call);
            });
        } else {
            resp({
                version: '-',
                isdevConfig: false,
                identifier_human: 'aktuell nicht registriert',
                plugin: ext.runtime.getManifest().version,
                pluginActive: false
            });
        }
    });
}

function handleInformationCall(resp) {
    storage.get(configPlace, function (configResponse) {
        if(typeof(configResponse[configPlace]) !== 'undefined') {
            storage.get('identifier_human', function (humanResponse) {
                var pluginRegistered = humanResponse.identifier_human ? true : false;
                resp({
                    version: configResponse[configPlace].version,
                    isdevConfig: isUsingDevConfig(),
                    messages: rawMessages,
                    userID: pluginRegistered ? humanResponse.identifier_human : 'aktuell nicht registriert',
                    pluginRegistered: pluginRegistered,
                    pluginActive: plugin_active
                });
            });
        } else {
            resp({
                version: '-',
                isdevConfig: false,
                messages: rawMessages,
                userID: 'aktuell nicht registriert',
                pluginRegistered: false,
                pluginActive: plugin_active
            });
        }
    });
}

/*
 * Processes the user-feed
 * @Param config - config used to evaluate the feed
 * @Param domNodes - user Feed from Facebook
 * @Param currentObject - object in which the Session Package will be stored
 * this will be recursevly called, reducing the config and data in the Process
*/
var postCssSelector = "";
function processFeed(config, domNode, currentObject) {
    var selectors = config.selectors;
    var selectedDomNodes = [domNode];
    if (config.css != "") {
        selectedDomNodes = domNode.querySelectorAll(config.css);

    }
    runningcssSelector += "[-~-]" + config.css;
    if (config.nodetype == "post") {
        currentObject.posts = [];
        postCssSelector = config.css;
    }

    if (config.type == "interaction") {
        var foundSelector = false;
        for (var i = 0; i < interactionSelector.length; i++) {
            if (config.uid == interactionSelector[i].id) {
                foundSelector = true;
            }
        }
        if (foundSelector == false) {
            interactionSelector.push({
                'css': runningcssSelector.split('[-~-]').join(' '),
                'id': config.uid,
                'event': config.event,
                'parentCss': postCssSelector,
                'attribute': config.attribute,
                'configColumn': config.column
            });
        }
    }
    var evaluateThisNode = false;
    if (config.if == true && selectedDomNodes != null) {
        if (config.hasOwnProperty('if_css') && config.hasOwnProperty('if_attribute') && config.hasOwnProperty('if_value')) {
            var resCss = domNode.querySelector(config.if_css);
            if (resCss != null) {
                var attribute = getAttribute(config.if_attribute, resCss);
                if (evaluateConfigIF(config.if_value, config.if_comparison, attribute)) {
                    evaluateThisNode = true;
                }
            } else {
                evaluateThisNode = true;
            }
        } else {
            evaluateThisNode = true;
        }
    } else {
        evaluateThisNode = true;
    }
    if (evaluateThisNode) {
        for (var i = 0; i < selectedDomNodes.length; i++) {
            if (config.nodetype == "post") {
                var post = {};
                handleActions(config, selectedDomNodes[i], post);
                for (var e = 0; e < selectors.length; e++) {
                    post = processFeed(selectors[e], selectedDomNodes[i], post);
                }
                if (!isEmpty(post)) {
                    post['position_ordinal'] = i + 1;
                    post['position_onscreen'] = selectedDomNodes[i].id + "top";
                    sendRecRequest(selectedDomNodes[i].id);
                    currentObject.posts.push(post);
                }
            } else {
                handleActions(config, selectedDomNodes[i], currentObject);
                for (var e = 0; e < selectors.length; e++) {
                    processFeed(selectors[e], selectedDomNodes[i], currentObject);
                }
            }
        }
    }
    runningcssSelector = runningcssSelector.substr(0, runningcssSelector.lastIndexOf("[-~-]"));
    return currentObject;
}


/* forwards a Message as E-Mail
 * @param (js-object) body - body which specifies messageID and E-Mail Adress
 */
function sendAsEmail(body) {
    storage.get('plugin_uid', function (resp) {
        var plugin_uid = resp.plugin_uid;
        if (plugin_uid) {
            storage.get('identifier_password', function (resp) {
                var password = resp.identifier_password;
                if (password) {
                    var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                    var sBody = body;
                    var sUrl = 'https://fbforschung.de/message/email'; //serverside url to call
                    axios.post(sUrl, sBody,
                        {
                            headers: {
                                "X-Auth-Key": sNonce,
                                "X-Auth-Checksum": CryptoJS.HmacSHA1(sUrl + JSON.stringify(sBody) + sNonce, password).toString(),
                                "X-Auth-Plugin": plugin_uid
                            }
                        })
                        .then(function(response) {
                            handleMessageCheck(response.data);
                        })
                        .catch(function(error) {
                            console.log('error during sending the email');
                            console.log(error);
                            console.log(error.response);
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
function MessageResponse(body) {
    storage.get('plugin_uid', function (resp) {
        var plugin_uid = resp.plugin_uid;
        if (plugin_uid) {
            storage.get('identifier_password', function (resp) {
                var password = resp.identifier_password;
                if (password) {
                    var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                    var sBody = body;
                    var sUrl = 'https://fbforschung.de/message'; //serverside url to call
                    axios.post(sUrl, sBody,
                        {
                            headers: {
                                "X-Auth-Key": sNonce,
                                "X-Auth-Checksum": CryptoJS.HmacSHA1(sUrl + JSON.stringify(sBody) + sNonce, password).toString(),
                                "X-Auth-Plugin": plugin_uid
                            }
                        })
                        .then(function(response) {
                            if(typeof(body.mark_shown) == 'undefined') {
                                handleMessageCheck(response.data);
                            }
                        })
                        .catch(function(error) {
                            console.log('error during message loading');
                            console.log(error);
                            console.log(error.response);
                        });
                }
            });
        } else {
            ext.tabs.create({'url': ext.extension.getURL('registration.html')});
        }

    });
}

/* takes the first Message to be shown and creates the popup for it */
function handleMessageCheck(data) {
    rawMessages = data.result;
    if (data.result.length > 0) {
        nextMessage = data.result[0];
        showNextMessage();
    }
}

function showNextMessage() {
    ext.windows.create({
        url: ext.extension.getURL("popup.html"),
        width: 440,
        height: 300,
        type: "popup"
    }, function (window) {
        openWindows.push({'windowID': window.id, 'messageID': nextMessage.uid})
    });
}

function closeWindow(messageID) {
    var index = -1;
    for (var i = 0; i < openWindows.length; i++) {
        if (openWindows[i].messageID === messageID) {
            index = i;
            break;
        }
    }
    if (index > -1) {
        ext.windows.remove(openWindows[index].windowID);
        openWindows.splice(index, 1);
    }
}

function handleConfigCheck(_configResponse) {
    if (_configResponse.is_latest_version == false) {
        if (isUsingDevConfig()) {
            getDevConfig();
        } else {
            getConfig();
        }
    }
}


function sendRecRequest(id) {
    rectRequestAwaiting++;
    ext.tabs.query({url: 'https://www.facebook.com/'}, function (tabs) {
        ext.tabs.sendMessage(tabs[0].id, {greeting: "getRect", id: id}, function (resp) {
            if(resp) {
                handleRecRequest(resp.id, resp.rect, resp.body);
            } else {
                console.log('error during RecRequest');
            }
        });
    });
}


function handleRecRequest(id, Clientrect, bodyRect) {
    var proccessedFeedasString = JSON.stringify(processedFeed);
    proccessedFeedasString = proccessedFeedasString.replace(id + "top", Clientrect.top - bodyRect.top);
    proccessedFeedasString = proccessedFeedasString.replace(id + "width", Clientrect.width);
    proccessedFeedasString = proccessedFeedasString.replace(id + "height", Clientrect.height);
    proccessedFeedasString = proccessedFeedasString.replace(id + "left", Clientrect.left);
    processedFeed = JSON.parse(proccessedFeedasString);
    rectRequestAwaiting--;
    if (rectRequestAwaiting == 0) {
        storage.get('session_uid', function (resp) {
            var sessionID = resp.session_uid;
            storage.get('session_date', function (resp) {
                var session_date = new Date(resp.session_date);
                if ((sessionID) && (((new Date) - session_date) < (60 * 60 * 1000))) { //eine Stunde Abstand
                    sendFeedToServer(processedFeed, lastScrolledUntil, sessionID);
                    processedFeed = {};
                } else {
                    sendFeedToServer(processedFeed, lastScrolledUntil, null);
                    processedFeed = {};
                }
            });
        });
    }


}


/* Main Messaging centrum of the Extension, all requests get directed to here */
var runningcssSelector = "";
ext.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        switch (request.action) {
            case "updateIcon":
                var iconPath = "images/icon-16-inactive.png";
                if (request.facebookopen == 'true' && plugin_active == true) {
                    iconPath = "images/icon-16.png";
                }
                ext.browserAction.setIcon({
                    path: iconPath,
                    tabId: sender.tab.id
                });
                break;

            case "register":
                restRegister(sendResponse);
                return true;
                //break;

            case "resetLocalStorage":
                ext.storage.sync.clear();
                ext.tabs.create({'url': ext.extension.getURL('registration.html')});
                break;

            case "isPluginActive":
                sendResponse({pluginStatus: plugin_active});
                break;

            case "activatePlugin":
                console.log('activating plugin');
                plugin_active = true;
                ext.tabs.query({url: "https://www.facebook.com/"}, function (results) {
                    for (var i = 0; i < results.length; i++) {
                        ext.browserAction.setIcon({
                            path: 'images/icon-16.png',
                            tabId: results[i].id
                        });
                    }
                });
                sendResponse({pluginStatus: plugin_active});
                break;

            case "deactivatePlugin":
                console.log('deactivating the plugin');
                plugin_active = false;
                chrome.tabs.query({url: "https://www.facebook.com/"}, function (results) {
                    for (var i = 0; i < results.length; i++) {
                        ext.browserAction.setIcon({
                            path: 'images/icon-16-inactive.png',
                            tabId: results[i].id
                        });
                    }
                });
                sendResponse({pluginStatus: plugin_active});
                break;

            case "process-feed":
                runningcssSelector = "";
                storage.get(configPlace, function (resp) {
                    var config = resp[configPlace];
                    lastScrolledUntil = request.scrolledUntil;
                    if (config) {
                        var div = document.createElement("div");
                        div.innerHTML = request.data;
                        rectRequestAwaiting = 0;
                        processFeed(config.selectors, div, processedFeed);
                        if (processedFeed != {}) {
                            if (rectRequestAwaiting == 0) {
                                storage.get('session_uid', function (resp) {
                                    var sessionID = resp.session_uid;
                                    storage.get('session_date', function (resp) {
                                        var session_date = new Date(resp.session_date);
                                        if ((sessionID) && (((new Date) - session_date) < (60 * 60 * 1000))) { //eine Stunde Abstand
                                            sendFeedToServer(processedFeed, lastScrolledUntil, sessionID);
                                        } else {
                                            sendFeedToServer(processedFeed, lastScrolledUntil, null);
                                        }
                                    });
                                });
                            }
                        }
                    } else {
                        console.log("something went wrong");
                    }
                });
                break;

            case "opened-facebook":                 // we need this to update our Messages and Configs
                storage.set({"session_date": 0}, function () {});
                checkIfMessageUpdate();
                if (isUsingDevConfig()) {
                    storage.get('devconfig', function (resp) {
                        var config = resp.config;
                        if (config) {
                            console.log('checking if dev config is up to date');
                            getRequest('https://fbforschung.de/config/dev/' + config.version, null, handleConfigCheck);
                        } else {
                            getDevConfig();
                        }
                    });
                } else {
                    storage.get('config', function (resp) {
                        var config = resp.config;
                        if (config) {
                            console.log('checking if main config is up to date');
                            getRequest('https://fbforschung.de/config/' + config.version, null, handleConfigCheck);
                        } else {
                            getConfig();
                        }
                    });
                }
                break;

            case "getInteractionSelectors":
                sendResponse(interactionSelector);
                break;

            case "markShown":
                console.log('marking message shown');
                MessageResponse({mark_shown: request.uid});
                break;

            case "getPopupMessage":                 //a popup will request the newest message
                sendResponse(nextMessage);
                break;

            case "getOption":
                handleOptionCall(sendResponse);
                return true;
                //break;

            case "getInformation":
                handleInformationCall(sendResponse);
                return true;
                //break;

            case "setDevConfigStatus":
                if (request.devConfig == true) {
                    configPlace = "devconfig";
                } else {
                    configPlace = "config";
                }
                storage.set({usingDevConfig: request.devConfig}, function() {
                    if (request.devConfig) {
                        getDevConfig(function(_config) {
                            sendResponse({version:_config.version});
                        });
                    } else {
                        getConfig(function(_config) {
                            sendResponse({version:_config.version});
                        });
                    }
                });
                break;

            case "markRead":
                console.log('marking message read');
                MessageResponse({mark_read: request.uid});
                closeWindow(request.uid);
                break;

            case "markClicked":
                console.log('marking message clicked');
                MessageResponse({mark_clicked: request.uid});
                closeWindow(request.uid);
                break;

            case "emailThis":
                console.log('attempting to send message via email');
                sendAsEmail({
                    message: request.uid,
                    email: request.email
                });
                closeWindow(request.uid);
                break;

            case "putMessageonMessageStack":
                for (var i = 0; i < rawMessages.length; i++) {
                    if (rawMessages[i].uid == request.messageID) {
                        nextMessage = rawMessages[i];
                    }
                }
                showNextMessage();
                break;

            case "interaction":
                var interactionPost = {};
                storage.get('session_uid', function (resp) {
                    if (resp.session_uid) {
                        interactionPost['session_uid'] = resp.session_uid;
                    }
                });
                interactionPost['facebook_id'] = request.id;
                interactionPost['type'] = request.column.split('_')[1];
                if (request.attribute != null) {
                    interactionPost['attribute'] = request.attribute;
                }
                storage.get('identifier_password', function (resp) {
                    var password = resp.identifier_password;
                    if (password) {
                        storage.get('plugin_uid', function (resp) {
                            var plugin_uid = resp.plugin_uid;
                            if (plugin_uid) {
                                var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                                var sBody = interactionPost;
                                var sUrl = 'https://fbforschung.de/interaction'; //serverside url to call
                                axios.post(sUrl, sBody,
                                    {
                                        headers: {
                                            "X-Auth-Key": sNonce,
                                            "X-Auth-Checksum": CryptoJS.HmacSHA1(sUrl + JSON.stringify(sBody) + sNonce, password).toString(),
                                            "X-Auth-Plugin": plugin_uid,
                                            "Content-Type": "application/json"
                                        }
                                    })
                                    .then(function(response) {
                                        storage.set({
                                                session_uid: response.data.result['uid'],
                                                session_date: (new Date()).toString()
                                            }, function () {});
                                    })
                                    .catch(function(error) {
                                        storage.set({
                                            toBeSent: feed,
                                            createdAt: (new Date()).toString()
                                        }, function () {});
                                    });
                            }
                        });
                    }
                });
                break;
        }
    }
);

/* sends the Feed to the server
 * @param (js-object) feed : the feed containing the post, structured using the config
 * @param (int) scrolledUntil : specifies how deep the user scrolled into his feed
 * @param (int) sessionID : session ID of the last session used, can be null if this is the first post today/in the last hour
*/
function sendFeedToServer(feed, scrolledUntil, sessionID) {
    if (sessionID != null) {
        feed['session_uid'] = sessionID;
    }

    var manifestData = ext.runtime.getManifest();
    feed['plugin_version'] = manifestData.version;
    storage.get(configPlace, function (resp) {
        var config = resp.config;
        var version = config.version;
        if (version) {
            feed['config_version'] = version;
        }

        feed['browser'] = navigator.userAgent;
        feed['language'] = navigator.language;
        feed['scrolled_until'] = scrolledUntil;

        storage.get('identifier_password', function (resp) {
            var password = resp.identifier_password;
            if (password) {
                storage.get('plugin_uid', function (resp) {
                    var plugin_uid = resp.plugin_uid;
                    if (plugin_uid) {
                        var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                        var sBody = feed;
                        var sUrl = 'https://fbforschung.de/posts'; //serverside url to call
                        axios.post(sUrl, sBody,
                            {
                                headers: {
                                    "X-Auth-Key": sNonce,
                                    "X-Auth-Checksum": CryptoJS.HmacSHA1(sUrl + JSON.stringify(sBody) + sNonce, password).toString(),
                                    "X-Auth-Plugin": plugin_uid,
                                    "Content-Type": "application/json"
                                }
                            })
                            .then(function(response) {
                                storage.set({
                                    session_uid: response.data.result['uid'],
                                    session_date: (new Date()).toString()
                                }, function () {});
                            })
                            .catch(function(error) {
                                storage.set({
                                    toBeSent: feed,
                                    createdAt: (new Date()).toString()
                                }, function () {});
                            });
                    }
                });
            }
        });
    });
}


function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}


function evaluateConfigIF(ifValue, comparison, attribute) {
    switch (comparison) {
        case 'equal':
            return (ifValue == attribute);

        case 'unequal':
            return (ifValue != attribute);

        case 'gt':
            return (attribute > ifValue);

        case 'gteq':
            return (attribute >= ifValue);

        case 'lt':
            return (attribute < ifValue);

        case 'lteq':
            return (attribute <= ifValue);

        case 'notcontains':
            return (attribute.indexOf(ifValue) < 0);

        case 'contains':
            return (attribute.indexOf(ifValue) >= 0);

        case 'regex':
            return ((new RegExp(ifValue)).test(attribute) == true);

        case 'notregex':
            return ((new RegExp(ifValue)).test(attribute) == false);

        default:
            return false;
    }
}

function getAttribute(attribute, domNode) {
    if (attribute.startsWith("attr-")) {
        return domNode.getAttribute(attribute.substr(5, attribute.length - 5));
    } else {
        if (attribute.startsWith("data-")) {
            return domNode.dataset[attribute.substr(5, attribute.length - 5)];
        } else {
            if (attribute.startsWith("static-")) {
                return domNode.dataset[attribute.substr(7, attribute.length - 7)];
            } else {
                switch (attribute) {
                    case 'text':
                        return domNode.innerText;

                    case 'html':
                        return domNode.innerHTML;

                    case 'exists':
                        return true;

                    default:
                        break;
                }
            }
        }
    }
}


/* handels the Action for a given config node and domNode and appends it to the currentObject */
function handleActions(config, domNode, currentObject) {
    if (config.attribute.startsWith("attr-")) {
        currentObject[config.column] = domNode.getAttribute(config.attribute.substr(5, config.attribute.length - 5));
    } else {
        if (config.attribute.startsWith("data-")) {
            currentObject[config.column] = domNode.dataset[config.attribute.substr(5, config.attribute.length - 5)];
        } else {
            if (config.attribute.startsWith("static-")) {
                currentObject[config.column] = domNode.dataset[config.attribute.substr(7, config.attribute.length - 7)];
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
                            currentObject[config.column] = currentObject[config.column] + 1;
                        } else {
                            currentObject[config.column] = 1;
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

    if (config.anonymize == 1) {
        currentObject[config.column] = CryptoJS.SHA3(currentObject[config.column], {outputLength: 224}).toString();
    }
}

/**
 * Calls the register function and registers the Plugin.
 *
 *
 */
function restRegister(responseFunction) {
    storage.get('identifier_password', function (resp) {
        var password = resp.identifier_password;
        if (password) {
            storage.get('identifier_human', function (resp) {
                var human = resp.identifier_human;
                if (human) {
                    var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                    var sBody = {        //Body to be sent
                        "identifier_human": human,
                        "identifier_password": password
                    };
                    var _sUrl = 'https://fbforschung.de/register'; //serverside url to call
                    axios.post(_sUrl, sBody,
                        {
                            headers: {
                                "X-Auth-Key": sNonce,
                                "X-Auth-Checksum": CryptoJS.HmacSHA1(_sUrl + JSON.stringify(sBody) + sNonce, "B6iXyk8XB2DwTOdhnpDO8E8i8cMad1QX9mE6VXC1lWGPitYdb08ft4zDOX3q").toString(),
                                "Content-Type": "application/json"
                            }
                        }
                    ).then(function(response) {
                        console.log('installation successful');
                        storage.set({plugin_uid: response.data.result['uid']}, function () {
                            storage.set({usingDevConfig: false}, function () {});
                            responseFunction({worked: true});
                            getConfig();
                            storage.set({"registered": true}, function () {});
                        });
                    }).catch(function(error) {
                        if (error.response.status === 403) {
                            console.log('plugin has been previously installed, reactivating');
                            if (error.response.data.hasOwnProperty('uid')) {
                                storage.set({plugin_uid: parseInt(error.response.data.uid)}, function () {
                                    responseFunction({worked: true});
                                    getConfig();
                                    storage.set({"registered": true}, function () {});
                                });
                                return true;
                            } else {
                                console.log('already registered, no chance to activate');
                                responseFunction({worked: false});
                                alert("Sie sind bereits mit dieser Kennung registriert. Bitte geben Sie zur weiteren Teilnahme dasselbe Passwort ein, das Sie auch bisher verwendet haben. Das gerade eingegebene Passwort ist falsch.");
                                return Promise.reject(error.response);
                            }
                        } else {
                            console.log('unknown installation error');
                            responseFunction({worked: false});
                            return Promise.reject(error.response);
                        }
                    });
                }
            });
        }
    });
}

/** Performs a restGet where PluginID and Password get loaded form Storage
 *
 * @param {string} _sUrl Url to call
 * @param {string} _sBody HTTP body to send
 * @param {function} _fCallback callback function with (at least) one JS object parameter
 */
function getRequest(_sUrl, _sBody, _fCallback) {
    storage.get('plugin_uid', function (resp) {
        var plugin_uid = resp.plugin_uid;
        if (plugin_uid) {
            storage.get('identifier_password', function (resp) {
                var password = resp.identifier_password;
                if (password) {
                    restGET(plugin_uid, _sUrl, password, _fCallback, _sBody);
                }
            });
        }
    });
}


/**
 * Retrieve data from the REST API using a GET request.
 *
 * @param {int}  _nPlugin   plugin UID for authentication
 * @param {string}   _sUrl      full URL to call
 * @param {string}   _sPassword currently logged in user's password
 * @param {function} _fCallback callback function with (at least) one JS object parameter
 * @param {string} _sBody HTTP body to send
 */
function restGET(_nPlugin, _sUrl, _sPassword, _fCallback, _sBody) {
    var strBody = "";
    var sNonce = CryptoJS.lib.WordArray.random(16).toString();
    if (_sBody != null && _sBody != '') {
        strBody = JSON.stringify(_sBody);
        axios.get(_sUrl, _sBody,
            {
                headers: {
                    "X-Auth-Key": sNonce,
                    "X-Auth-Checksum": CryptoJS.HmacSHA1(_sUrl + strBody + sNonce, _sPassword).toString(),
                    "X-Auth-Plugin": _nPlugin
                }
            })
            .then(function(response) {
                _fCallback(response.data);
            })
            .catch(function(error) {
                console.log('error during data fetch');
                console.log(error);
                console.log(error.response);
            });
    } else {
        axios.get(_sUrl,
            {
                headers: {
                    "X-Auth-Key": sNonce,
                    "X-Auth-Checksum": CryptoJS.HmacSHA1(_sUrl + sNonce, _sPassword).toString(),
                    "X-Auth-Plugin": _nPlugin
                }
            })
            .then(function(response) {
                _fCallback(response.data);
            })
            .catch(function(error) {
                console.log('error during data fetch');
                console.log(error);
                console.log(error.response);
            });
    }
}