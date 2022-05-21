/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages. Ideally should be split into several scripts but I'm short on time and am lazy.
 *
 * @author 
 * Alan Zhang
 */
var rhit = rhit || {};

rhit.FB_COLLECTION_POSTS = "Posts";
rhit.FB_KEY_TITLE = "title";
rhit.FB_KEY_TYPE = "type";
rhit.FB_KEY_DESCRIPTION = "description";
rhit.FB_KEY_DATE_START = "dateStart";
rhit.FB_KEY_DATE_END = "dateEnd";
rhit.FB_KEY_IMAGE_URL = "imageUrl";
rhit.FB_KEY_LAST_TOUCHED = "lastTouched";
rhit.FB_KEY_AUTHOR = "author";
rhit.FB_KEY_LOCATION_FROM = "locationFrom";
rhit.FB_KEY_LOCATION_TO = "locationTo";
rhit.FB_KEY_NUM_PEOPLE = "numPeople";

rhit.FB_COLLECTION_USERS = "Users";
rhit.FB_KEY_EMAIL = "email";
rhit.FB_KEY_NAME = "name";
rhit.FB_KEY_PHONE = "phone";
rhit.FB_KEY_PHOTO_URL = "photoUrl";

rhit.FB_KEYS_URL = "https://us-central1-rideposts.cloudfunctions.net/keys";

rhit.fbAccountManager = null;
rhit.fbAuthManager = null;
rhit.fbPostManager = null;
rhit.fbSinglePostManager = null;
rhit.fbCarpoolManager = null;

// From https://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro
function htmlToElement(html) {
	var template = document.createElement('template');
	html = html.trim();
	template.innerHTML = html;
	return template.content.firstChild;
}

function setKeys() {
	let keys = fetch(rhit.FB_KEYS_URL)
		.then(response => response.json())
		.then(data => {
			rhit.ROSEFIRE_KEY = data["ROSEFIRE"];
			rhit.GMAP_KEY = data["GMAP"];
		})
	return keys;
}

rhit.AccountPageController = class {
	constructor() {

	}
}

rhit.FbAccountManager = class {
	constructor() {
		this._collectionRef = firebase.firestore().collection(rhit.FB_COLLECTION_USERS);
		this._document = null;
		this._unsubscribe = null;
	}

	addNewUserMaybe(uid, name, photoUrl, email, phone) {
		const userRef = this._collectionRef.doc(uid);
		return userRef.get().then((document) => {
			if (document.exists) {
				console.log("User already exists.  Do nothing");
				return false;
			} else {
				console.log("Creating the user!");
				return userRef.set({
					[rhit.FB_KEY_NAME]: name,
					[rhit.FB_KEY_PHOTO_URL]: photoUrl,
					[rhit.FB_KEY_EMAIL]: email,
					[rhit.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now()
				}).then(() => {
					return true;
				});
			}
		});
	}

	beginListening(uid, changeListener) {
		const userRef = this._collectionRef.doc(uid);
		this._unsubscribe = userRef.onSnapshot((doc) => {
			if (doc.exists) {
				this._document = doc;
				console.log('doc.data() :', doc.data());
				if (changeListener) {
					changeListener();
				}
			} else {
				console.log("This User object does not exist! (that's bad)");
			}
		});
	}

	stopListening() {
		this._unsubscribe();
	}

	uploadPhotoToStorage(file) {
		const metadata = {
			"content-type": file.type
		};
		const storageRef = firebase.storage().ref().child(rhit.FB_COLLECTION_USERS).child(rhit.fbAuthManager.uid);

		// const nextAvailableKey = firebase.storage().ref().child(rhit.FB_COLLECTION_USERS).push({}).key;
		// const storageRef = firebase.storage().ref().child(rhit.FB_COLLECTION_USERS).child(nextAvailableKey);

		storageRef.put(file, metadata).then((uploadSnapshot) => {
			console.log("Upload is complete!", uploadSnapshot);
			storageRef.getDownloadURL().then((downloadURL) => {
				console.log("File available at", downloadURL);
				rhit.fbAccountManager.updatePhotoUrl(downloadURL);
			});
		});
		console.log("Uploading", file.name);
	}

	updatePhotoUrl(photoUrl) {
		const userRef = this._collectionRef.doc(rhit.fbAuthManager.uid);
		userRef.update({
				[rhit.FB_KEY_PHOTO_URL]: photoUrl
			})
			.then(() => {
				console.log("Document successfully updated with photoUrl!");
			})
			.catch(function (error) {
				console.error("Error updating document: ", error);
			});
	}

	updateName(name) {
		const userRef = this._collectionRef.doc(rhit.fbAuthManager.uid);
		return userRef.update({
				[rhit.FB_KEY_NAME]: name
			})
			.then(() => {
				console.log("Document successfully updated with name!");
			})
			.catch(function (error) {
				console.error("Error updating document: ", error);
			});
	}

	updateEmail(email) {
		const userRef = this._collectionRef.doc(rhit.fbAuthManager.uid);
		return userRef.update({
				[rhit.FB_KEY_EMAIL]: email
			})
			.then(() => {
				console.log("Document successfully updated with email!");
			})
			.catch(function (error) {
				console.error("Error updating document: ", error);
			});
	}

	updatePhone(phone) {
		const userRef = this._collectionRef.doc(rhit.fbAuthManager.uid);
		return userRef.update({
				[rhit.FB_KEY_PHONE]: phone
			})
			.then(() => {
				console.log("Document successfully updated with phone!");
			})
			.catch(function (error) {
				console.error("Error updating document: ", error);
			});
	}

	get name() {
		return this._document.get(rhit.FB_KEY_NAME);
	}

	get photoUrl() {
		return this._document.get(rhit.FB_KEY_PHOTO_URL);
	}

	get phone() {
		return this._document.get(rhit.FB_KEY_PHONE);
	}
}

rhit.CarpoolPageController = class {
	constructor() {
		setKeys().then(() => {
			rhit.initMap();
		});

		document.querySelector("#fab").addEventListener("click", (event) => {
			window.location.href = `/createpost.html`;
		})

		rhit.fbPostManager.beginListening(this.updateView.bind(this));
	}

	updateView() {
		const newList = htmlToElement('<div class="list-group" id="requestsBody"></div>');
		for (let i = 0; i < rhit.fbPostManager.length; i++) {
			const post = rhit.fbPostManager.getPostAtIndex(i);
			if (post.type == "Carpool") {
				const newLI = this._createLI(post);
				post.onclick = () => {
					rhit.fbCarpoolManager.calcRoute(post.locationFrom, post.locationTo)
				}
				newList.appendChild(newLI);
			}
		}

		const oldList = document.querySelector("#requestsBody");
		oldList.removeAttribute("id");
		oldList.hidden = true;
		oldList.parentElement.appendChild(newList);
	}

	_createLI(post) {
		return htmlToElement(`<a class="list-group-item">
		<div class="bmd-list-group-col">
		  <p class="list-group-item-heading">To ${post.locationTo}</p>
		  <p class="list-group-item-text">${post.numPeople} people</p>
		</div>
	  </a>`)
	}
}

rhit.FbCarpoolManager = class {
	constructor(directionsService, directionsRenderer) {
		this._directionsService = directionsService;
		this._directionsRenderer = directionsRenderer;
	}

	calcRoute(end, waypoints) {
		let start = null;
		var request = {};

		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					start = {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					};

					request = {
						query: 'Chavas',
						locationBias: start,
						fields: ['name', 'geometry'],
					};
					map.setCenter(pos);
				},
				() => {
					handleLocationError(true, infoWindow, map.getCenter());
				}
			);
		} else {
			// Browser doesn't support Geolocation
			handleLocationError(false, infoWindow, map.getCenter());
			request = {
				query: 'Chavas',
				locationBias: rhitLocation,
				fields: ['name', 'geometry'],
			};
		}

		var service = new google.maps.places.PlacesService(map);

		service.findPlaceFromQuery(request, function (results, status) {
			if (status === google.maps.places.PlacesServiceStatus.OK) {
				for (var i = 0; i < results.length; i++) {
					createMarker(results[i]);
				}
				map.setCenter(results[0].geometry.location);
				calcRoute(rhitLocation, results[0].geometry.location, directionsService, directionsRenderer);
			}
		});

		var request = {
			origin: start,
			destination: end,
			waypoints: waypoints,
			optimizeWaypoints: true,
			travelMode: 'DRIVING'
		};
		this._directionsService.route(request, function (result, status) {
			if (status == 'OK') {
				console.log(result);
				this._directionsRenderer.setDirections(result);
			}
		});
	}
}

rhit.CreatePostPageController = class {
	constructor() {
		this._imageUrl = "";
		document.querySelector("#submitImage").onclick = (event) => {
			document.querySelector("#fileInput").click();
		};

		document.querySelector("#fileInput").addEventListener("change", (event) => {
			const file = event.target.files[0]
			console.log(`Received file named ${file.name}`);
			const storageRef = firebase.storage().ref().child(`postImages/${file.name}`);
			storageRef.put(file).then((uploadTaskSnapshot) => {
				console.log("The file has been uploaded!");

				storageRef.getDownloadURL().then((downloadUrl) => {
					this._imageUrl = downloadUrl;
				});
			});
			console.log("Uploading the file");
		});

		document.querySelector("#inputType").onchange = (param) => {
			var typeElement = document.querySelector("#inputType");
			const type = typeElement.options[typeElement.selectedIndex].text;
			if (type == "Carpool") {
				console.log("Carpool");
				var otherPrompts = document.querySelectorAll(".other-prompt");
				otherPrompts.forEach((e) => {
					e.style.display = "none";
				});
				var carpoolPrompts = document.querySelectorAll(".carpool-prompt");
				carpoolPrompts.forEach((e) => {
					e.style.display = "block";
				});
			} else {
				console.log("other");
				var otherPrompts = document.querySelectorAll(".other-prompt");
				otherPrompts.forEach((e) => {
					e.style.display = "block";
				});
				var carpoolPrompts = document.querySelectorAll(".carpool-prompt");
				carpoolPrompts.forEach((e) => {
					e.style.display = "none";
				});
			}
		}

		document.querySelector("#submitAddPost").addEventListener("click", (event) => {
			const title = document.querySelector("#inputTitle").value;
			var typeElement = document.querySelector("#inputType");
			const type = typeElement.options[typeElement.selectedIndex].text;
			const imageUrl = this._imageUrl;
			var drp = $('#inputDate').data('daterangepicker');
			const startDate = firebase.firestore.Timestamp.fromDate(new Date(drp.startDate._d));
			const endDate = firebase.firestore.Timestamp.fromDate(new Date(drp.endDate._d));
			const description = document.querySelector("#inputDescription").value;
			const locationFrom = document.querySelector("#inputLocationFrom").value;
			const locationTo = document.querySelector("#inputLocationTo").value;
			const numPeople = parseInt(document.querySelector("#inputNumPeople").value);

			rhit.fbPostManager.add(title, type, description, startDate, endDate, imageUrl, locationFrom, locationTo, numPeople);
		});

		document.querySelector("#submitCancelAddPost").addEventListener("click", (event) => {
			window.location.href = `/bulletin.html`;
		})
	}
}

rhit.BulletinBoardPageController = class {
	constructor() {
		document.querySelector("#fab").addEventListener("click", (event) => {
			window.location.href = `/createpost.html`;
		})

		rhit.fbPostManager.beginListening(this.updateList.bind(this));

		// TODO: add filtered views if there's time
	}

	updateList() {
		const newList = htmlToElement('<div id="postListContainer"></div>');
		for (let i = 0; i < rhit.fbPostManager.length; i++) {
			const post = rhit.fbPostManager.getPostAtIndex(i);
			const newCard = this._createCard(post);
			newCard.onclick = (event) => {
				window.location.href = `/post.html?id=${post.id}`;
			};
			newList.appendChild(newCard);
		}

		const oldList = document.querySelector("#postListContainer");
		oldList.removeAttribute("id");
		oldList.hidden = true;
		oldList.parentElement.appendChild(newList);
	}

	_createCard(post) {
		return htmlToElement(`<div class="card" style="width: 18rem;">
		<img class="card-img-top" src="${post.imageUrl}" alt="${post.title}">
		<div class="card-body">
		  <h5 class="card-title">${post.title}</h5>
		  <p class="card-text">${post.description}</p>
		</div>
	  </div>`);
	}
}

rhit.FbPostManager = class {
	constructor(uid) {
		this._uid = uid;
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_POSTS);
		this._unsubscribe = null;
	}

	add(title, type, description, dateStart, dateEnd, imageUrl, locationFrom, locationTo, numPeople) {
		this._ref.add({
				[rhit.FB_KEY_TITLE]: title,
				[rhit.FB_KEY_TYPE]: type,
				[rhit.FB_KEY_DESCRIPTION]: description,
				[rhit.FB_KEY_DATE_START]: dateStart,
				[rhit.FB_KEY_DATE_END]: dateEnd,
				[rhit.FB_KEY_IMAGE_URL]: imageUrl,
				[rhit.FB_KEY_NUM_PEOPLE]: numPeople,
				[rhit.FB_KEY_LOCATION_FROM]: locationFrom,
				[rhit.FB_KEY_LOCATION_TO]: locationTo,
				[rhit.FB_KEY_AUTHOR]: rhit.fbAuthManager.uid,
				[rhit.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now(),
			})
			.then(function (docRef) {
				console.log("Document written with ID: ", docRef.id);
				window.location.href = "/bulletin.html"
			})
			.catch(function (error) {
				console.error("Error adding document: ", error);
			});
	}

	beginListening(changeListener) {
		let query = this._ref.orderBy(rhit.FB_KEY_LAST_TOUCHED, "desc").limit(50);
		if (this._uid) {
			query = query.where(rhit.FB_KEY_AUTHOR, "==", this._uid);
		}

		this._unsubscribe = query.onSnapshot((querySnapshot) => {
			console.log("Board update:");

			this._documentSnapshots = querySnapshot.docs;
			changeListener();
		});
	}

	stopListening() {
		this._unsubscribe();
	}

	getPostAtIndex(index) {
		const docSnapshot = this._documentSnapshots[index];
		const post = new rhit.Post(docSnapshot.id,
			docSnapshot.get(rhit.FB_KEY_TITLE),
			docSnapshot.get(rhit.FB_KEY_TYPE),
			docSnapshot.get(rhit.FB_KEY_DESCRIPTION),
			docSnapshot.get(rhit.FB_KEY_DATE_START),
			docSnapshot.get(rhit.FB_KEY_DATE_END),
			docSnapshot.get(rhit.FB_KEY_IMAGE_URL),
			docSnapshot.get(rhit.FB_KEY_LOCATION_FROM),
			docSnapshot.get(rhit.FB_KEY_LOCATION_TO),
			docSnapshot.get(rhit.FB_KEY_NUM_PEOPLE),
			docSnapshot.get(rhit.FB_KEY_LAST_TOUCHED),
			docSnapshot.get(rhit.FB_KEY_AUTHOR));
		return post;
	}

	get length() {
		return this._documentSnapshots.length;
	}

}

rhit.Post = class {
	constructor(id, title, type, description, dateStart, dateEnd, imageUrl, locationFrom, locationTo, numPeople, lastTouched, author) {
		this.id = id;
		this.title = title;
		this.type = type;
		this.description = description;
		this.dateStart = dateStart;
		this.dateEnd = dateEnd;
		this.imageUrl = imageUrl;
		this.locationFrom = locationFrom;
		this.locationTo = locationTo;
		this.numPeople = numPeople;
		this.lastTouched = lastTouched;
		this.author = author;
	}
}

rhit.PostPageController = class {
	constructor() {
		this._imageUrl = null;
		document.querySelector("#submitImage").onclick = (event) => {
			document.querySelector("#fileInput").click();
		};

		document.querySelector("#fileInput").addEventListener("change", (event) => {
			const file = event.target.files[0]
			console.log(`Received file named ${file.name}`);
			const storageRef = firebase.storage().ref().child(`postImages/${file.name}`);
			storageRef.put(file).then((uploadTaskSnapshot) => {
				console.log("The file has been uploaded!");

				storageRef.getDownloadURL().then((downloadUrl) => {
					this._imageUrl = downloadUrl;
				});
			});
			console.log("Uploading the file");
		});

		document.querySelector("#submitEditPost").onclick = (event) => {
			const description = document.querySelector("#inputDescription").value;
			rhit.fbSinglePostManager.update(description, this._imageUrl);
		}

		$("#editPostDialog").on("show.bs.modal", (e) => {
			document.querySelector("#inputDescription").value = rhit.fbSinglePostManager.description;
		});
		$("#editPostDialog").on("shown.bs.modal", (e) => {
			document.querySelector("#inputDescription").focus();
		});

		document.querySelector("#submitDeletePost").onclick = (event) => {
			rhit.fbSinglePostManager.delete().then(() => {
				console.log("Document successfully deleted");
				window.location.href = "/bulletin.html";
			}).catch((error) => {
				console.error("Error removing document: ", error);
			});
		};

		rhit.fbSinglePostManager.beginListening(this.updateView.bind(this));
	}

	updateView() {
		document.querySelector("#postImage").src = rhit.fbSinglePostManager.imageUrl;
		document.querySelector("#postImage").alt = rhit.fbSinglePostManager.title;
		document.querySelector("#postTitle").innerHTML = rhit.fbSinglePostManager.title;
		document.querySelector("#postDescription").innerHTML = rhit.fbSinglePostManager.description;

		if (rhit.fbSinglePostManager.author == rhit.fbAuthManager.uid) {
			document.querySelector("#menuEdit").style.display = "flex";
			document.querySelector("#menuDelete").style.display = "flex";
		}
	}
}

rhit.FbSinglePostManager = class {
	constructor(postId) {
		this._documentSnapshot = {};
		this._unsubscribe = null;
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_POSTS).doc(postId);
		console.log(`Listening to ${this._ref.path}`);
	}

	beginListening(changeListener) {
		this._unsubscribe = this._ref.onSnapshot((doc) => {
			if (doc.exists) {
				console.log("Document data: ", doc.data());
				this._documentSnapshot = doc;
				changeListener();
			} else {
				console.log("No such document!");
			}
		});
	}

	stopListening() {
		this._unsubscribe();
	}

	update(description, imageUrl) {
		if (imageUrl) {
			this._ref.update({
					[rhit.FB_KEY_DESCRIPTION]: description,
					[rhit.FB_KEY_IMAGE_URL]: imageUrl,
					[rhit.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now(),
				})
				.then(() => {
					console.log("Document successfully updated!");
				})
				.catch((error) => {
					console.error("Error updating document: ", error);
				});
		} else {
			this._ref.update({
					[rhit.FB_KEY_DESCRIPTION]: description,
					[rhit.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now(),
				})
				.then(() => {
					console.log("Document successfully updated!");
				})
				.catch((error) => {
					console.error("Error updating document: ", error);
				});
		}

	}

	updatePhotoUrl(photoUrl) {
		this._ref.update({
				[rhit.FB_KEY_PHOTO_URL]: photoUrl,
			})
			.then(() => {
				console.log("Document successfully updated!");
			})
			.catch(function (error) {
				console.error("Error updating document: ", error);
			});
	}

	delete() {
		return this._ref.delete();
	}

	get imageUrl() {
		return this._documentSnapshot.get(rhit.FB_KEY_IMAGE_URL);
	}

	get title() {
		return this._documentSnapshot.get(rhit.FB_KEY_TITLE);
	}

	get description() {
		return this._documentSnapshot.get(rhit.FB_KEY_DESCRIPTION);
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
		this._name = "";
		this._photoUrl = null;
		this._email = "";
	}

	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			changeListener();
		});
	}

	signIn() {
		setKeys().then(() => {
			Rosefire.signIn(rhit.ROSEFIRE_KEY, (err, rfUser) => {
				if (err) {
					console.log("Rosefire error!", err);
					return;
				}
				console.log("Rosefire success!", rfUser);
				this._name = rfUser.name;
				this._u
				firebase.auth().signInWithCustomToken(rfUser.token).catch((error) => {
					if (error.code === 'auth/invalid-custom-token') {
						console.log("The token you provided is not valid.");
					} else {
						console.log("signInWithCustomToken error", error.message);
					}
				});
			});
		});
	}

	signOut() {
		firebase.auth().signOut().catch((error) => {
			console.log("Sign out error");
		});
	}

	get isSignedIn() {
		return !!this._user;
	}

	get uid() {
		return this._user.uid;
	}

	get name() {
		return this._name || this._user.displayName;
	}

	get photoUrl() {
		return this._photoUrl || this._user.photoURL;
	}

	get email() {
		return this._email || this._user.email;
	}
}

rhit.SideNavController = class {
	constructor() {
		const boardItem = document.querySelector("#menuBulletinBoard");
		if (boardItem) {
			boardItem.onclick = (event) => {
				window.location.href = "/bulletin.html";
			};
		}

		const carpoolItem = document.querySelector("#menuCarpools");
		if (carpoolItem) {
			carpoolItem.onclick = (event) => {
				window.location.href = `/carpool.html`;
			};
		}

		const accountItem = document.querySelector("#menuAccount");
		if (accountItem) {
			accountItem.onclick = (event) => {
				window.location.href = `/account.html`;
			};
		}

		const signOutItem = document.querySelector("#menuSignOut");
		if (signOutItem) {
			signOutItem.onclick = (event) => {
				rhit.fbAuthManager.signOut();
			};
		}
	}
}

rhit.createUserIfNeeded = function () {
	return new Promise((resolve, reject) => {
		if (!rhit.fbAuthManager.isSignedIn) {
			resolve(false);
			return;
		}
		if (!document.querySelector("#loginPage")) {
			resolve(false);
			return;
		}
		rhit.fbAccountManager.addNewUserMaybe(
			rhit.fbAuthManager.uid,
			rhit.fbAuthManager.name,
			rhit.fbAuthManager.photoUrl,
			rhit.fbAuthManager.email).then((wasUserAdded) => {
			resolve(wasUserAdded);
		});
	})
}

rhit.checkForRedirects = function () {
	if (document.querySelector("#loginPage") && rhit.fbAuthManager.isSignedIn) {
		window.location.href = "/bulletin.html";
	}
	if (!document.querySelector("#loginPage") && !rhit.fbAuthManager.isSignedIn) {
		window.location.href = "/";
	}
}

rhit.initializePage = function () {
	const urlParams = new URLSearchParams(window.location.search);
	new rhit.SideNavController();
	if (document.querySelector("#accountPage")) {
		console.log("You are on the account page.");
		rhit.fbAccountManager = new rhit.FbAccountManager(rhit.FbAuthManager.uid);
		new rhit.AccountPageController();
	}
	if (document.querySelector("#carpoolPage")) {
		console.log("You are on the carpool page.");
		rhit.fbPostManager = new rhit.FbPostManager(rhit.FbAuthManager.uid);
		new rhit.CarpoolPageController();
	}

	if (document.querySelector("#loginPage")) {
		console.log("You are on the login page.");
		new rhit.LoginPageController();
	}

	if (document.querySelector("#bulletinPage")) {
		console.log("You are on the bulletin page.");
		rhit.fbPostManager = new rhit.FbPostManager(rhit.FbAuthManager.uid);
		new rhit.BulletinBoardPageController();
	}
	if (document.querySelector("#createPostPage")) {
		console.log("You are on the create post page.");
		rhit.fbPostManager = new rhit.FbPostManager(rhit.FbAuthManager.uid);
		new rhit.CreatePostPageController();
	}

	const postId = urlParams.get("id");

	if (document.querySelector("#postPage")) {
		if (!postId) {
			window.location.href = "/bulletin.html";
		} else {
			rhit.fbSinglePostManager = new rhit.FbSinglePostManager(postId);
			new rhit.PostPageController();
		}
	}
}

// Note: requires browser permissions to locate
let map, infoWindow;

rhit.initMap = function () {
	var script = document.createElement('script');
	script.src = `https://maps.googleapis.com/maps/api/js?key=${rhit.GMAP_KEY}&libraries=places&callback=initMap`;
	script.async = true;
	window.initMap = function () {
		var directionsService = new google.maps.DirectionsService();
		var directionsRenderer = new google.maps.DirectionsRenderer();
		var rhitLocation = {
			lat: 39.4833,
			lng: -87.3241
		};
		var mapOptions = {
			zoom: 12,
			center: rhitLocation,
			streetViewControl: false,
			zoomControl: false,
			mapTypeControl: false,
			disableDefaultUI: true
		}

		var map = new google.maps.Map(document.getElementById("map"), mapOptions);
		directionsRenderer.setMap(map);
		directionsRenderer.setPanel(
			document.getElementById("sidebar")
		);
		// const control = document.getElementById("floating-panel");
		// const onChangeHandler = function () {
		// 	calculateAndDisplayRoute(directionsService, directionsRenderer);
		// };

		// Default location bias
		var request = {
			query: 'Chavas',
			locationBias: rhitLocation,
			fields: ['name', 'geometry'],
		};

		// Location bias according to current location
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const pos = {
						lat: position.coords.latitude,
						lng: position.coords.longitude,
					};

					request = {
						query: 'Chavas',
						locationBias: pos,
						fields: ['name', 'geometry'],
					};
					map.setCenter(pos);
				},
				() => {
					handleLocationError(true, infoWindow, map.getCenter());
				}
			);
		} else {
			// Browser doesn't support Geolocation
			handleLocationError(false, infoWindow, map.getCenter());
			request = {
				query: 'Chavas',
				locationBias: rhitLocation,
				fields: ['name', 'geometry'],
			};
		}

		var service = new google.maps.places.PlacesService(map);

		service.findPlaceFromQuery(request, function (results, status) {
			if (status === google.maps.places.PlacesServiceStatus.OK) {
				for (var i = 0; i < results.length; i++) {
					createMarker(results[i]);
				}
				map.setCenter(results[0].geometry.location);
				calcRoute(rhitLocation, results[0].geometry.location, directionsService, directionsRenderer);
			}
		});
	};
	document.head.appendChild(script);
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

function createMarker(place) {
	if (!place.geometry || !place.geometry.location) return;

	const marker = new google.maps.Marker({
		map,
		position: place.geometry.location,
	});

	google.maps.event.addListener(marker, "click", () => {
		infowindow.setContent(place.name || "");
		infowindow.open(map);
	});
}

function calcRoute(start, end, directionsService, directionsRenderer, waypoints) {
	var request = {
		origin: start,
		destination: end,
		waypoints: waypoints,
		optimizeWaypoints: true,
		travelMode: 'DRIVING'
	};
	directionsService.route(request, function (result, status) {
		if (status == 'OK') {
			console.log(result);
			directionsRenderer.setDirections(result);
		}
	});
}

/* Main */
/** function and class syntax examples */
rhit.main = function () {
	console.log("Ready");
	rhit.fbAccountManager = new rhit.FbAccountManager();
	rhit.fbAuthManager = new rhit.FbAuthManager();
	rhit.fbAuthManager.beginListening((params) => {
		console.log("isSignedIn = ", rhit.fbAuthManager.isSignedIn);
		rhit.createUserIfNeeded().then((isUserNew) => {
			console.log('isUserNew :>> ', isUserNew);
			if (isUserNew) {
				window.location.href = "/account.html";
				return;
			}
			rhit.checkForRedirects();
			rhit.initializePage();
		});
	});
};

rhit.main();