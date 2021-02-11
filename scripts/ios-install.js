const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const { https } = require('follow-redirects');
const isMac = /^darwin/.test(process.platform);
const Q = require('q');
let csdkDirectory;

if (!isMac) {
	console.log('iOS development is only supported on Mac OS X system, cowardly refusing to install the plugin');
} else {
	var commands = {
		rm: "rm",
		rmRF: "rm -rf",
		cp: "cp",
		mv: "mv",
		touch: "touch"
	};

	var paths = {
		"ConnectSDK_Framework": "https://github.com/kdgm/Connect-SDK-iOS-KDGM/releases/download/2.0.0/ConnectSDK.framework.zip",
		"GoogleCastSDK_URL": "https://developers.google.com/cast/downloads/GoogleCastSDK-2.7.1-Release-ios-default.zip",
		"GoogleCast_Framework": "./csdk_tmp/GoogleCastSDK-2.7.1-Release/GoogleCast.framework"
	};

	function safePath(unsafePath, quoted) {
		safe_path = path.join(process.cwd(), "./platforms/ios/", unsafePath);
		if (quoted) { return "\'" + safe_path + "\'"; } else { return safe_path; };
	};

	function iOSInstall() {}

	iOSInstall.prototype.steps = [
		"createTemporaryDirectory",
		"downloadConnectSDK",
		"downloadGoogleCastSDK",
		"cleanup"
	];

	iOSInstall.prototype.start = function () {
		console.log("Starting ConnectSDK iOS install");
		var self = this;

		self.executeStep(0);
	};

	iOSInstall.prototype.executeStep = function (step) {
		var self = this;
		if (step < this.steps.length) {
			var promise = this[this.steps[step]]();
			promise.then(function () {
				self.executeStep(step + 1);
			}, function (err) {
				console.log("Encountered an error, reverting install steps");
				console.error(err);
				self.revertStep(step);
			});
		} else {
			console.log("ConnectSDK iOS install finished");
		}
	};

	iOSInstall.prototype.revertStep = function (step) {
		var self = this;
		if (this.currentStep < this.steps.length) {
			var promise = this["revert_" + this.steps[step]]();
			promise.then(function () {
				self.revertStep(step - 1);
			}, function () {
				console.error("An error occured while reverting the install.");
			});
		} else {
			console.log("ConnectSDK iOS install reverted");
		}
	};

	iOSInstall.prototype.createTemporaryDirectory = function () {
		console.log('createTemporaryDirectory');
		return Q.nfcall(fs.readdir, safePath("./", false))
			.then(function (files) {
			for (var i = 0; i < files.length; i++) {
				if (files[i].indexOf('.xcodeproj') !== -1) {
					csdkDirectory = "./" + files[i].substring(0, files[i].indexOf('.xcodeproj')) + "/Plugins/cordova-plugin-connectsdk";
					return Q.nfcall(fs.mkdir, safePath('./csdk_tmp', false));
				}
			}
			return Q.reject("Could not find ConnectSDK plugin directory");
		});
	};

	iOSInstall.prototype.revert_createTemporaryDirectory = function () {
		return Q.nfcall(exec, commands.rmRF + " " + safePath("./csdk_tmp", true));
	};

	iOSInstall.prototype.downloadConnectSDK = function () {
		var deferred = Q.defer();
		console.log("Downloading ConnectSDK from: " + paths.ConnectSDK_Framework);
		var file = fs.createWriteStream(safePath("./csdk_tmp/ConnectSDK.framework.zip", false));
		https.get(paths.ConnectSDK_Framework, function(response) {
			response.pipe(file).on('close', function () {
				console.log('Extracting ConnectSDK');
				Q.nfcall(exec, "unzip -q " + safePath('./csdk_tmp/ConnectSDK.framework.zip', true) + " -d " + safePath('./csdk_tmp', true))
				.then(function () {
					return Q.nfcall(exec, commands.rm + " " + safePath(csdkDirectory + "/ConnectSDK.framework", true));
				})
				.then(function () {
					return Q.nfcall(exec, commands.mv + " " + safePath("./csdk_tmp/ConnectSDK.framework", true) + " " + safePath(csdkDirectory + "/ConnectSDK.framework", true));
				})
				.then(function () {
					deferred.resolve();
				})
				.catch(function (err) {
					deferred.reject(err);
				});
			});
		}).on('error', function (err) {
			deferred.reject(err);
		});

		return deferred.promise;
	};

	iOSInstall.prototype.revert_downloadConnectSDK = function () {
		console.log('revert_downloadConnectSDK')
		return Q.nfcall(exec, commands.rm + " " + safePath(csdkDirectory + "/ConnectSDK.framework", true))
			.then(function () {
			return Q.nfcall(exec, commands.touch + " " + safePath(csdkDirectory + "/ConnectSDK.framework", true));
		});
	};


	iOSInstall.prototype.downloadGoogleCastSDK = function () {
		var deferred = Q.defer();
		console.log("Downloading GoogleCast SDK");
		var file = fs.createWriteStream(safePath("./csdk_tmp/GoogleCastSDK.zip", false));
		https.get(paths.GoogleCastSDK_URL, function(response) {
			response.pipe(file).on('close', function () {
				console.log('Extracting GoogleCast SDK');
				Q.nfcall(exec, "unzip -q " + safePath("./csdk_tmp/GoogleCastSDK.zip", true) + " -d " + safePath('./csdk_tmp', true))
					.then(function () {
					return Q.nfcall(exec, commands.rm + " " + safePath(csdkDirectory + "/GoogleCast.framework", true));
				})
					.then(function () {
					return Q.nfcall(exec, commands.mv + " " + safePath(paths.GoogleCast_Framework, true) + " " + safePath(csdkDirectory + "/GoogleCast.framework", true));
				})
					.then(function () {
					deferred.resolve();
				})
					.catch(function (err) {
					deferred.reject(err);
				});
			});
		}).on('error', function (err) {
			deferred.reject(err);
		});

		return deferred.promise;
	};

	iOSInstall.prototype.revert_downloadGoogleCastSDK = function () {
		return Q.nfcall(exec, commands.rm + safePath(csdkDirectory + "/GoogleCast.framework", true))
			.then(function () {
			return Q.nfcall(exec, commands.touch + safePath(csdkDirectory + "/GoogleCast.framework", true));
		});
	};

	iOSInstall.prototype.cleanup = function () {
		console.log("Cleaning up");
		return this.revert_createTemporaryDirectory();
	};

	iOSInstall.prototype.revert_cleanup = function () {
		return Q.resolve();
	};

	new iOSInstall().start();
}
