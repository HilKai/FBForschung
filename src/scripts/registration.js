import ext from "./utils/ext";
import storage from "./utils/storage";
var axios = require('axios');
var CryptoJS = require("crypto-js");
import { sha3_512 } from 'js-sha3';


//when the save button is clicked, all the data will be passed to a register request, the password is already encrypted
var optionsLink = document.querySelector(".js-save");
optionsLink.addEventListener("click", function(e) {
    e.preventDefault();
	var password = document.getElementById('password').value,
		password2 = document.getElementById('password2').value;
	if(password == password2) {
		var hashedPass = sha3_512(password);
		var human = document.getElementById('mother').value +
				   document.getElementById('father').value +
				   document.getElementById('user').value +
				   document.getElementById('birthday').value +
				   document.getElementById('hair').value +
				   document.getElementById('eye').value;
		storage.set({identifier_password:hashedPass,identifier_human:human}, function() {
				ext.runtime.sendMessage({ action: 'register' }, function(result) {
          //console.log(result);
						if(result.worked == true){
							window.location.href = "https://www.facebook.com/";
						} 
					});
			});
	} else {
		alert('Die beiden eingegebenen Passwörter stimmen nicht überein.');
	}
})

//initially show step 1
document.querySelector(".stepwise.step1").style.display = 'block';
//handle next links
document.querySelector("a.step1").addEventListener("click", function(e) {
		e.preventDefault();
	    document.querySelector(".stepwise.step1").style.display = 'none';
		document.querySelector(".stepwise.step2").style.display = 'block';
	});
document.querySelector("a.step2").addEventListener("click", function(e) {
		e.preventDefault();
		if(confirm('Nur zur Sicherheit: Sie sind jetzt bei Facebook eingeloggt?')) {
            document.querySelector(".stepwise.step2").style.display = 'none';
			document.querySelector(".stepwise.step3").style.display = 'block';
		}
	});
document.querySelector("a.step3").addEventListener("click", function(e) {
		e.preventDefault();
		var human = document.getElementById('mother').value +
				   document.getElementById('father').value +
				   document.getElementById('user').value +
				   document.getElementById('birthday').value +
				   document.getElementById('hair').value +
				   document.getElementById('eye').value;
		if(human.length > 3) {
            document.querySelector(".stepwise.step3").style.display = 'none';
			document.querySelector(".stepwise.step4").style.display = 'block';
		} else {
			alert('Bitte füllen Sie mindestens vier Felder aus, um eine eindeutige Identifizierung sicherzustellen.');
		}
	});
