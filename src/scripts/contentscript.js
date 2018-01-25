import ext from "./utils/ext";

var axios = require('axios');
var CryptoJS = require("crypto-js");




ext.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.greeting == "getRect"){
        var response = {id: request.id,
                        rect:document.getElementById(request.id).getBoundingClientRect(),
                        body: document.body.getBoundingClientRect()}
        sendResponse(response);
    }
  });


document.head.appendChild(document.createElement('script')).text = '(' +
    function () {
        // injected DOM script is not a content script anymore, 
        // it can modify objects and functions of the page
        var _pushState = history.pushState;
        history.pushState = function (state, title, url) {
            _pushState.call(this, state, title, url);
            window.dispatchEvent(new CustomEvent('state-changed', {
                detail: state
            }));
        };
        // repeat the above for replaceState too
    } + ')(); this.remove();'; // remove the DOM script element

// And here content script listens to our DOM script custom events
window.addEventListener('state-changed', function (e) {
    updateIcon();       //to get the Icon to update we need to inject a bit of code into the dom
});


function updateIcon() {
    if (document.location.href == 'https://www.facebook.com/') {
        ext.runtime.sendMessage({
            "newIconPath": 'Icons/icon-16.png'
        });
    } else {
        ext.runtime.sendMessage({
            "newIconPath": 'Icons/icon-16-inactive.png'
        });
    }
}

updateIcon();
var lastScrollTop = 0;
window.onscroll = function (e) {
var st = window.pageYOffset || window.scrollTop;
    if (st > lastScrollTop) {
        scrollHandler();
    }
        lastScrollTop = st;
 }


var scrollIndex = 0;
var nextScrollGoal = 50;

scrollHandler();
//whenever a certain threshold is reached the FB-Feed will be sent to the background script to be analysed using the config
function scrollHandler() {
    scrollIndex += 1;
    if (scrollIndex >= nextScrollGoal) {
        nextScrollGoal += 50;
        
        ext.runtime.sendMessage({ action: 'process-feed', data: document.body.innerHTML, scrolledUntil:document.body.getBoundingClientRect().top *(-1)},function(result){
     });  
    }
}
 ext.runtime.sendMessage({ action: 'opened-facebook', data: document.body.innerHTML, scrolledUntil:scrollIndex},function(result){}); // messages the background page to update various data, like messages and config

ext.runtime.sendMessage({ action: 'process-feed', data: document.body.innerHTML, scrolledUntil:0},function(result){
     });  


