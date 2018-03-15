import ext from "./utils/ext";

var axios = require('axios');
var CryptoJS = require("crypto-js");
var interactionSelectors = [];



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
        ext.runtime.sendMessage({"action":"updateIcon",
            "facebookopen": 'true'
        });
    } else {
        ext.runtime.sendMessage({"action":"updateIcon",
            "facebookopen": 'false'
        });
    }
}
updateIcon();
function getAttribute(attribute, domNode){
      if (attribute.startsWith("attr-")){
          return domNode.getAttribute(attribute.substr(5,attribute.length-5));
      } else{
          if (attribute.startsWith("data-")){
              var dataObjStr = attribute.substr(5,attribute.length-5);
              return domNode.dataset[dataObjStr];
          } else {
              if (attribute.startsWith("static-")){
                  var dataObjStr = attribute.substr(7,attribute.length-7);
                  return domNode.dataset.dataObjStr;
              } else {
                  switch (attribute) {
                      case 'text':
                          return domNode.innerText;
                          break;
                      case 'html':
                        return domNode.innerHTML;
                          break;
                      case 'exists':
                          return  true;
                          break;

                          default:
                          break;
                  }
              }
          }
      }
}


var lastScrollTop = 0;
window.onscroll = function (e) {
var st = window.pageYOffset || window.scrollTop;
    if (st > lastScrollTop) {
        scrollHandler();
    }
        lastScrollTop = st;
 }


var scrollIndex = 0;
var nextScrollGoal = 1;

scrollHandler();
//whenever a certain threshold is reached the FB-Feed will be sent to the background script to be analysed using the config
function scrollHandler() {

    scrollIndex += 1;
    if (scrollIndex >= nextScrollGoal) {
        nextScrollGoal += 50;

        ext.runtime.sendMessage({ action: 'process-feed', data: document.body.innerHTML, scrolledUntil:document.body.getBoundingClientRect().top *(-1)},function(result){
     });
     ext.runtime.sendMessage({action:'getInteractionSelectors'},function(res){
       interactionSelectors = res;
     });
    for (var i=0; i< interactionSelectors.length;i++){
      var posts = document.querySelectorAll(interactionSelectors[i].parentCss);
      for (var u=0;u< posts.length; u++){
        var res = posts[u].querySelectorAll(interactionSelectors[i].css);
        for (var e = 0; e < res.length; e++) {
            res[e].setAttribute('parentID', posts[u].id);
            res[e].setAttribute('configColumn',interactionSelectors[i].configColumn);
            res[e].setAttribute('attributeSelector',interactionSelectors[i].attribute);
            res[e].addEventListener(interactionSelectors[i].event, function(event) {
                var parentID = event.target.attributes["parentID"].value;
                var configColumn = event.target.attributes["configColumn"].value;
                var attributeSelector = event.target.attributes['attributeSelector'].value;
                var attribute = getAttribute(attributeSelector,event.target);
                var interaction = {'action': 'interaction',
                                          'id':parentID,
                                          'column':configColumn,
                                          'attribute':attribute};

                ext.runtime.sendMessage( interaction,function(result){
                });
            });
        }
      }
    }
  }

}
 ext.runtime.sendMessage({ action: 'opened-facebook', data: document.body.innerHTML, scrolledUntil:scrollIndex},function(result){
 }); // messages the background page to update various data, like messages and config
ext.runtime.sendMessage({ action: 'process-feed', data: document.body.innerHTML, scrolledUntil:0},function(result){
     });
ext.runtime.sendMessage({action:'getInteractionSelectors'},function(res){
       interactionSelectors = res;
});
