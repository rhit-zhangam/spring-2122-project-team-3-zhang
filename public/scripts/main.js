/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author 
 * Alan Zhang
 */

var rhit = rhit || {};

rhit.fbAccountManager = null;
rhit.fbAuthManager = null;
rhit.fbCarpoolManager = null;

rhit.AccountPageController = class {
	constructor() {

	}
}

rhit.FbAccountManager = class {
	constructor(uid) {
		this._uid = uid;
	}
}

rhit.CarpoolPageController = class {
	constructor() {
		initMap;
	}
}

rhit.FbCarpoolManager = class {
	constructor(uid) {
		this._uid = uid;
	}
}

rhit.LoginPageController = class {
	constructor() {
		document.querySelector("#rosefireButton").onclick = (event) => {
			rhit.fbAuthManager.signIn();
		};
	}
}

rhit.FbAuthManager = class {
	constructor() {
		this._user = null;
	}

	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			changeListener();
		});
	}

	signIn() {
		Rosefire.signIn("2500b0b8-eb28-464c-8bc5-0db71700aed3", (err, rfUser) => {
			if (err) {
				console.log("Rosefire error!", err);
				return;
			}
			console.log("Rosefire success!", rfUser);

			firebase.auth().signInWithCustomToken(rfUser.token).catch((error) => {
				if (error.code === 'auth/invalid-custom-token') {
					console.log("The token you provided is not valid.");
				} else {
					console.log("signInWithCustomToken error", error.message);
				}
			});
		});
	}

	signOut() {
		firebase.auth().signOut().catch((error) => {
			console.log("Sign out error");
			// An error happened.
		});
	}

	get isSignedIn() {
		return !!this._user;
	}

	get uid() {
		return this._user.uid;
	}
}


rhit.checkForRedirects = function () {
	if (document.querySelector("#loginPage") && rhit.fbAuthManager.isSignedIn) {
		window.location.href = "/bulletin.html";
	}
	if (!document.querySelector("#loginPage") && !rhit.fbAuthManager.isSignedIn) {
		window.location.href = "/";
	}
};

rhit.initializePage = function () {
	const urlParams = new URLSearchParams(window.location.search);
	if (document.querySelector("#accountPage")) {
		console.log("You are on the account page.");
		rhit.fbAccountManager = new rhit.FbAccountManager(rhit.FbAuthManager.uid);
		new rhit.AccountPageController();
	}

	if (document.querySelector("#carpoolPage")) {
		console.log("You are on the carpool page.");
		rhit.fbCarpoolManager = new rhit.FbCarpoolManager(rhit.FbAuthManager.uid);
		new rhit.CarpoolPageController();
	}

	if (document.querySelector("#loginPage")) {
		console.log("You are on the login page.");
		new rhit.LoginPageController();
	}
};



// Note: Requires browser permission for location
// For directions, refer here: https://developers.google.com/maps/documentation/javascript/directions#DisplayingResults
let map, infoWindow;

function initMap() {
	var directionsService = new google.maps.DirectionsService();
	var directionsRenderer = new google.maps.DirectionsRenderer();
	var rhit_location = new google.maps.LatLng(39.4833, -87.3241);
	var mapOptions = {
		zoom: 12,
		center: rhit_location,
	}

	var map = new google.maps.Map(document.getElementById("map"), mapOptions);
	directionsRenderer.setMap(map);
	infoWindow = new google.maps.InfoWindow();

	const locationButton = document.createElement("button");

	locationButton.textContent = "Pan to Current Location";
	locationButton.classList.add("custom-map-control-button");
	map.controls[google.maps.ControlPosition.TOP_CENTER].push(locationButton);
	locationButton.addEventListener("click", () => {
		// Try HTML5 geolocation.
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const pos = {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					};

					infoWindow.setPosition(pos);
					infoWindow.setContent("Location found.");
					infoWindow.open(map);
					map.setCenter(pos);
				},
				() => {
					handleLocationError(true, infoWindow, map.getCenter());
				}
			);
		} else {
			// Browser doesn't support Geolocation
			handleLocationError(false, infoWindow, map.getCenter());
		}
	});
}

function handleLocationError(browserHasGeolocation, infoWindow, pos) {
	infoWindow.setPosition(pos);
	infoWindow.setContent(
		browserHasGeolocation ?
		"Error: The Geolocation service failed." :
		"Error: Your browser doesn't support geolocation."
	);
	infoWindow.open(map);
}

window.initMap = initMap;

/* Main */
/** function and class syntax examples */
rhit.main = function () {
	console.log("Ready");

	rhit.fbAuthManager = new rhit.FbAuthManager();
	rhit.fbAuthManager.beginListening((params) => {
		console.log("auth change callback fired.");
		rhit.checkForRedirects();
		rhit.initializePage();
	});
};

rhit.main();