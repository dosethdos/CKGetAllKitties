var kittyContractMethods = require('./kittyContract.js');
var fs = require('fs');

var startBlock = 4600000;
var step = 500;
var nbBlockSave = 10000;
var dicKitties = {};
var lastBlockSave = 0;
var currentLastBlock = 0;
var filePath = 'allKitties.txt';

var getAllKitties = function getAllKitties(fPath = filePath) {
	filePath = fPath;
	loadAndSaveKitties(startBlock, step);
}

exports.getAllKitties = getAllKitties;

var getKitties = function getKitties() {
	return dicKitties;
}

exports.getKitties = getKitties;

var getKitty = function getKitty(kittyId) {
	return dicKitties[kittyId];
}

exports.getKitty = getKitty;

function loadAndSaveKitties(sBlock, stp) {
	fs.readFile(filePath, (err, data) => {
		if(!err) {
			let dataDic = JSON.parse(data);

			if(Object.values(dataDic).length > 1) {
				lastBlockSave = dataDic.lastBlock;
				sBlock = lastBlockSave + 1;
				dicKitties = dataDic.kitties;
			}
		}
		console.log('Starting to fetch informations at block : '+sBlock);
		saveEventsKitties(sBlock, stp);
	});
}

function saveEventsKitties(sBlock, step) {
	console.log('startBlock : '+sBlock);
	kittyContractMethods.currentBlockNumber()
	.then(blockNumber => {
		console.log('currentBlock : '+blockNumber);
		if(sBlock >= blockNumber) {
			console.log('WebSockets events !');
			nbBlockSave = 10;
			kittyContractMethods.kittyCurrentEvents(sBlock, (event) => {
				let lastBlock = event.blockNumber;
				updateKittiesWithEvents([event], lastBlock);
			});
			kittyContractMethods.kittyCurrentSalesEvents(sBlock, (event) => {
				let lastBlock = event.blockNumber;
				updateKittiesWithEvents([event], lastBlock);
			});
			kittyContractMethods.kittyCurrentSiringEvents(sBlock, (event) => {
				let lastBlock = event.blockNumber;
				updateKittiesWithEvents([event], lastBlock, true);
			});
		} else {
			let eBlock = sBlock + step;
			if(eBlock > blockNumber) {
				eBlock = blockNumber;
			}
			kittyContractMethods.kittyEventsFromTo(sBlock, eBlock)
			.then(events => {
				if(notEmptyArray(events)) {
					let lastEvent = events.slice().pop();
					let lastBlock = lastEvent.blockNumber;

					updateKittiesWithEvents(events, lastBlock);
				}
			})
			.then(() => {
				kittyContractMethods.kittySalesEventsFromTo(sBlock, eBlock)
				.then(salesEvents => {
					if(notEmptyArray(salesEvents)) {
						let lastEvent = salesEvents.slice().pop();
						let lastBlock = lastEvent.blockNumber;

						updateKittiesWithEvents(salesEvents, lastBlock);
					}
				});
			})
			.then(() => {
				kittyContractMethods.kittySiringEventsFromTo(sBlock, eBlock)
				.then(siringEvents => {
					if(notEmptyArray(siringEvents)) {
						let lastEvent = siringEvents.slice().pop();
						let lastBlock = lastEvent.blockNumber;

						updateKittiesWithEvents(siringEvents, lastBlock, true);
					}

					let nextStartBlock = eBlock+1;
					saveEventsKitties(nextStartBlock, step);
				});
			})
			.catch(console.log.bind(console));
		}
	});
}

function updateKittiesWithEvents(events, lastBlock, isSiring = false) {
	console.log('Updating Kitties.')
	events.forEach(e => {
		let event = e.returnValues;
		if(e.event == "Birth") {
			let kittyId = event.kittyId;
			let matronId = event.matronId;
			let sireId = event.sireId;
			let genes = event.genes;

			if(kittyId != undefined && kittyId > 0 && genes != undefined) {
				let generation = 0;

				if(matronId != 0 && sireId != 0) {
					let matron = dicKitties[matronId];
					matron.cooldownIndex += 1;
					matron.isGestating = false;
					matron.siringWithId = 0;
					matron.siredBlock = e.blockNumber;
					dicKitties[matronId] = matron;

					let sire = dicKitties[sireId];
					sire.cooldownIndex += 1;
					sire.siringWithId = 0;
					sire.siredBlock = e.blockNumber;
					dicKitties[sireId] = sire;

					let maxGen = Math.max(matron.generation, sire.generation);
					generation = maxGen+1;
				}

				let cooldownIndex = Math.floor(generation/2);

				let dicKitty = {
					id : kittyId,
					birthBlock : e.blockNumber,
					matronId : matronId,
					sireId : sireId,
					generation : generation,
					genes : genes,
					cooldownIndex : cooldownIndex,
					isGestating : false,
					siringWithId : 0,
					siringBlock: 0,
					siredBlock: 0,
					auction : {}
				};

				dicKitties[kittyId] = dicKitty;
			}
		} else {
			let kittyId = event.tokenId;
			if(kittyId != "undefined" && kittyId > 0) {
				let kittyInfos = dicKitties[kittyId];
				if(kittyInfos != "undefined") {
					// Transfer
					if(e.event == "Transfer") {
						let toAddress = event.to;
						if(toAddress != undefined) {
							let kittyOwners = kittyInfos.owners;
							if(notEmptyArray(kittyOwners)) {
								kittyOwners.push(toAddress);
							} else {
								kittyOwners = [toAddress];
							}
							dicKitties[kittyId].owners = kittyOwners;
						}
					}
					// Pregnant
					else if(e.event == "Pregnant") {
						let matronId = event.matronId;
						let sireId = event.sireId;

						if(matronId != 0 && sireId != 0) {
							let matron = dicKitties[matronId];
							matron.isGestating = true;
							matron.siringWithId = sireId;
							matron.siringBlock = e.blockNumber;
							matron.siredBlock = 0;
							dicKitties[matronId] = matron;

							let sire = dicKitties[sireId];
							sire.siringWithId = matronId;
							sire.siringBlock = e.blockNumber;
							sire.siredBlock = 0;
							dicKitties[sireId] = sire;
						}
					}
					// Auction Created (Sale + Sire)
					else if(e.event == "AuctionCreated") {
						let auction = {
							startingPrice : event.startingPrice,
							endingPrice : event.endingPrice,
							duration : event.duration,
							block : e.blockNumber,
							isSiring : isSiring
						};
						dicKitties[kittyId].auction = auction;
					}
					// Auction Successful
					else if(e.event == "AuctionSuccessful") {
						dicKitties[kittyId].auction = {};
					}
					// Auction Successful
					else if(e.event == "AuctionCancelled") {
						dicKitties[kittyId].auction = {};
					}
				}
			}
		}
	});

	if(lastBlock < currentLastBlock) {
		lastBlock = currentLastBlock;
	} else {
		currentLastBlock = lastBlock;
	}

	if(lastBlock - lastBlockSave > nbBlockSave) {
		console.log('Saving file at block : '+lastBlock);
		lastBlockSave = lastBlock;
		let saveDictionary = {
			lastBlock : lastBlock,
			kitties : dicKitties
		};

		fs.writeFile(filePath, JSON.stringify(saveDictionary), (err) => {
			if (err) throw err;
		});
	}
}

function notEmptyArray(array) {
	return (typeof array != "undefined" && array != null && array.length != null && array.length > 0);
}

