import ext from "./utils/ext";
import storage from "./utils/storage";

var axios = require('axios');
var CryptoJS = require("crypto-js");
var nextMessage,
    rawMessages,
    configPlace = "config",
    lastScrolledUntil = 0,
    plugin_active = true,
    interactionSelector = [],
    openWindows = [],
    feedToServerQueue = [],
    feedQueueInProgress = false,
    postCssSelector = "",
    runningcssSelector = "";

ext.runtime.onInstalled.addListener(function() {
    ext.storage.sync.clear();
});

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


/**
 * checks for new messages from the server
 */
function checkIfMessageUpdate() {
    console.log('checking for new messages');
    getRequest('https://fbforschung.de/message', null, handleMessageCheck);
}

/**
 * simple check on whether a the currently used config is the DEV config
 * @returns {boolean}
 */
function isUsingDevConfig() {
    return (configPlace == "devconfig");
}

/**
 * checks for the main config from the server
 * @param _fCallback    function to call after finishing
 */
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

/**
 * checks for the DEV config from the server
 * @param _fCallback    function to call after finishing
 */
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

/**
 * responds to the plugin's option request
 * @param resp  object to push response to
 */
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

/**
 * responds to the plugin's information request (the popup without messages)
 * @param resp  object to push response to
 */
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

/**
 * processes a complete DOM feed
 * @param config    current config object to use
 * @param domNode   full DOM
 * @param currentObject recursive necessity
 * @param domRects  rect measures for position calculation
 * @param tabID ID of the contentscript's sender
 * @returns {*}
 */
function processFeed(config, domNode, currentObject, domRects, tabID) {
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
    if(selectedDomNodes != null) {
        if ((config.if === true || parseInt(config.if) == 1) && config.if_css != '' && config.if_attribute != '') {
            var resCss = domNode.querySelectorAll(config.if_css);
            if (resCss != null) {
                var attribute = evaluateDOMreturn(resCss, config.if_attribute, false, domRects);
                if (evaluateConfigIF(config.if_value, config.if_comparison, attribute)) {
                    evaluateThisNode = true;
                }
            }
        } else {
            evaluateThisNode = true;
        }
    }
    if (evaluateThisNode) {
        for (var i = 0; i < selectedDomNodes.length; i++) {
            if (config.nodetype == "post") {
                var post = {};
                post[config.column] = evaluateDOMreturn([selectedDomNodes[i]], config.attribute, config.anonymize, domRects);
                for (var e = 0; e < selectors.length; e++) {
                    post = processFeed(selectors[e], selectedDomNodes[i], post, domRects, tabID);
                }
                if (!isEmpty(post)) {
                    post['position_ordinal'] = i + 1;
                    post['position_onscreen'] = -1;
                    if(typeof(selectedDomNodes[i].id) !== 'undefined' && typeof(domRects[selectedDomNodes[i].id]) !== 'undefined') {
                        post['position_onscreen'] = domRects[selectedDomNodes[i].id].top - domRects['body'].top;
                    }
                    currentObject.posts.push(post);
                }
            } else {
                currentObject[config.column] = evaluateDOMreturn([selectedDomNodes[i]], config.attribute, config.anonymize, domRects);
                for (var e = 0; e < selectors.length; e++) {
                    processFeed(selectors[e], selectedDomNodes[i], currentObject, domRects, tabID);
                }
            }
        }
    }
    runningcssSelector = runningcssSelector.substr(0, runningcssSelector.lastIndexOf("[-~-]"));
    return currentObject;
}

/**
 * sends a given email object to the server to be sent via email
 * @param body  textual body (stringified JSON)
 */
function sendAsEmail(body) {
    console.log('attempting to send message via email');
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


/**
 * sends a message response (read, clicked ...) to the server
 * @param body string body to send (stringified JSON)
 */
function sendMessageResponse(body) {
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

/**
 * whenever a sendMessageResponse returns, new messages might be included;
 * these are handled here
 * @param data
 */
function handleMessageCheck(data) {
    rawMessages = data.result;
    if (data.result.length > 0) {
        nextMessage = data.result[0];
        showNextMessage();
    }
}

/**
 * display a (the next) message from the queue
 */
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

/**
 * close a message window
 * @param messageID
 */
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

/**
 * handle server response for a config request
 * @param _configResponse
 */
function handleConfigCheck(_configResponse) {
    if (_configResponse.is_latest_version == false) {
        if (isUsingDevConfig()) {
            getDevConfig();
        } else {
            getConfig();
        }
    }
}


/**
 * MAIN function here
 * responds to the plugin's contentscript requests
 */
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
                        var processedFeed = {};
                        processFeed(config.selectors, div, processedFeed, JSON.parse(request.rect), sender.tab.id);
                        if (processedFeed != {}) {
                            sendFeedToServer(processedFeed, lastScrolledUntil);
                        }
                    } else {
                        console.log("something went wrong");
                    }
                });
                break;

            case "opened-facebook":                 // update messages and config
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
                console.log('Facebook opened, resetting Facebook session');
                storage.set({session_uid:null}, function() {});
                break;

            case "getInteractionSelectors":
                sendResponse(interactionSelector);
                break;

            case "markShown":
                console.log('marking message shown');
                sendMessageResponse({mark_shown: request.uid});
                break;

            case "getPopupMessage":
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
                return true;
                //break;

            case "markRead":
                console.log('marking message read');
                sendMessageResponse({mark_read: request.uid});
                closeWindow(request.uid);
                break;

            case "markClicked":
                console.log('marking message clicked');
                sendMessageResponse({mark_clicked: request.uid});
                closeWindow(request.uid);
                break;

            case "emailThis":
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
                                                session_uid: response.data.result['uid']
                                            }, function () {});
                                    })
                                    .catch(function(error) {
                                        storage.set({
                                            toBeSent: sBody,
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

/**
 * add a (newly) collected DOM feed to the queue to be sent to the server
 * @param feed  the feed that has been collected (within processFeed(...))
 * @param scrolledUntil amount of pixels the user has scrolled until
 */
function sendFeedToServer(feed, scrolledUntil) {
    feedToServerQueue.push({feed: feed, scrolledUntil: scrolledUntil});
    processFeedQueue();
}

/**
 * internal feed-to-server-queue handling function
 */
function processFeedQueue() {
    if(!feedQueueInProgress && feedToServerQueue.length > 0) {
        feedQueueInProgress = true;
        var feedToServer = feedToServerQueue.shift(),
            manifestData = ext.runtime.getManifest();
        storage.get('session_uid', function (resp) {
            if (typeof(resp.session_uid) !== 'undefined') {
                feedToServer.feed['session_uid'] = resp.session_uid;
            }

            feedToServer.feed['plugin_version'] = manifestData.version;
            storage.get(configPlace, function (resp) {
                if(typeof(resp.config) !== 'undefined') {
                    var config = resp.config;
                    var version = config.version;
                    if (version) {
                        feedToServer.feed['config_version'] = version;
                    }

                    feedToServer.feed['browser'] = navigator.userAgent;
                    feedToServer.feed['language'] = navigator.language;
                    feedToServer.feed['scrolled_until'] = feedToServer.scrolledUntil;

                    storage.get('identifier_password', function (resp) {
                        var password = resp.identifier_password;
                        if (password) {
                            storage.get('plugin_uid', function (resp) {
                                var plugin_uid = resp.plugin_uid;
                                if (plugin_uid) {
                                    console.log('pushing feed data to the server');con
                                    var sNonce = CryptoJS.lib.WordArray.random(16).toString();
                                    var sBody = feedToServer.feed;
                                    var sUrl = 'https://fbforschung.de/posts';
                                    axios.post(sUrl, sBody,
                                        {
                                            headers: {
                                                "X-Auth-Key": sNonce,
                                                "X-Auth-Checksum": CryptoJS.HmacSHA1(sUrl + JSON.stringify(sBody) + sNonce, password).toString(),
                                                "X-Auth-Plugin": plugin_uid,
                                                "Content-Type": "application/json"
                                            }
                                        })
                                        .then(function (response) {
                                            storage.set({
                                                session_uid: response.data.result['uid']
                                            }, function () {
                                                feedQueueInProgress = false;
                                                processFeedQueue();
                                            });
                                        })
                                        .catch(function (error) {
                                            storage.set({
                                                toBeSent: feedToServer.feed,
                                                createdAt: (new Date()).toString()
                                            }, function () {
                                                feedQueueInProgress = false;
                                                processFeedQueue();
                                            });
                                        });
                                }
                            });
                        }
                    });
                }
            });
        });
    }
}

/**
 * simple check if an object is empty
 * @param obj
 * @returns {boolean}
 */
function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}

/**
 * for a given IF comparison (as specified on the server), check if this is true
 * @param ifValue
 * @param comparison
 * @param attribute
 * @returns {boolean}
 */
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

/**
 * return the correct attribute from a DOM node
 * @param domNodes
 * @param attribute
 * @param anonymize
 * @param domRects
 * @returns {*}
 */
function evaluateDOMreturn(domNodes, attribute, anonymize, domRects) {
    var domNode = domNodes.length > 0 ? domNodes[0] : null,
        returnValue = null;
    if (attribute.startsWith("attr-")) {
        returnValue = domNode ? domNode.getAttribute(attribute.substr(5, attribute.length - 5)) : '';
    } else {
        if (attribute.startsWith("data-")) {
            returnValue = domNode ? domNode.dataset[attribute.substr(5, attribute.length - 5)] : '';
        } else {
            if (attribute.startsWith("static-")) {
                returnValue = domNode ? domNode.dataset[attribute.substr(7, attribute.length - 7)] : '';
            } else {
                switch (attribute) {
                    case 'text':
                        returnValue = domNode ? domNode.innerText : '';
                        break;

                    case 'html':
                        returnValue = domNode ? domNode.innerHTML : '';
                        break;

                    case 'exists':
                        returnValue = domNode !== null;
                        break;

                    case 'count':
                        returnValue = domNodes.length;
                        break;

                    case 'width':
                        if(typeof(domNode.id) !== 'undefined' && typeof(domRects[domNode.id]) !== 'undefined') {
                            returnValue = domRects[domNode.id].width;
                        } else {
                            returnValue = -1;
                        }
                        break;

                    case 'height':
                        if(typeof(domNode.id) !== 'undefined' && typeof(domRects[domNode.id]) !== 'undefined') {
                            returnValue = domRects[domNode.id].height;
                        } else {
                            returnValue = -1;
                        }
                        break;

                    case 'top':
                        if(typeof(domNode.id) !== 'undefined' && typeof(domRects[domNode.id]) !== 'undefined') {
                            returnValue = domRects[domNode.id].top - domRects['body'].top;
                        } else {
                            returnValue = -1;
                        }
                        break;

                    case 'left':
                        if(typeof(domNode.id) !== 'undefined' && typeof(domRects[domNode.id]) !== 'undefined') {
                            returnValue = domRects[domNode.id].left;
                        } else {
                            returnValue = -1;
                        }
                        break;

                    default:
                        break;
                }
            }
        }
    }
    if (anonymize == 1 && returnValue !== null) {
        return CryptoJS.SHA3(returnValue, {outputLength: 224}).toString();
    } else {
        return returnValue;
    }
}

/**
 * initially register a plugin, as being requested from the plugin's registration JS
 * @param responseFunction  function to call to return
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

/**
 * set up a GET request with identifying information
 * @param _sUrl
 * @param _sBody
 * @param _fCallback
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
 * actually send a GET request to the server
 * @param _nPlugin
 * @param _sUrl
 * @param _sPassword
 * @param _fCallback
 * @param _sBody
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
