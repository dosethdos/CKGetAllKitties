var kittiesOfOwner = function kittiesOfOwner(owner, kitties) {
	let arrayKeyKitties = Object.keys(kitties);
	let arrayTokens = arrayKeyKitties.filter( idxKitty => {
		let kitty = kitties[idxKitty];
		let arrayOwners = kitty.owners;
		if(arrayOwners != undefined) {
			let copyArrayOwners = arrayOwners.slice();
			let lastOwner = copyArrayOwners.pop();
			if(notEmptyDictionary(kitty.auction)) {
				lastOwner = copyArrayOwners.pop();
			}
			return lastOwner.toLowerCase() == owner.toLowerCase();
		} else {
			return false;
		}
	});
	return arrayTokens;
}

exports.kittiesOfOwner = kittiesOfOwner;

function notEmptyDictionary(dictionary) {
	return (typeof dictionary != "undefined" && dictionary != null && Object.values(dictionary).length != null && Object.values(dictionary).length > 0)
}