import ext from "./utils/ext";
import storage from "./utils/storage";
var axios = require('axios');
var CryptoJS = require("crypto-js");
import { sha3_512 } from 'js-sha3';


//when the save button is clicked, all the data will be passed to a register request, the password is already encrypted
var optionsLink = document.querySelector(".js-save");
optionsLink.addEventListener("click", function(e) {
    e.preventDefault();
    var hashedPass = sha3_512(document.getElementById('password').value);
    var human = document.getElementById('mother').value +
                           document.getElementById('father').value +
                           document.getElementById('user').value +
                           document.getElementById('birthday').value +
                           document.getElementById('hair').value +
                           document.getElementById('eye').value;
  storage.set({identifier_password:hashedPass,identifier_human:human},function(){
     ext.runtime.sendMessage({ action: 'register' },function(result){
        if (result.worked == true){
            close();
        } else {
            alert('Etwas ist schief gegangen.')
        }
     });    
});
})



