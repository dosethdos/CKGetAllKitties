var kittyContractMethods = require('./kittyContract.js');
var fs = require('fs');

var startBlock = 4600000;
var step = 500;
var nbBlockSave = 10;
var dicKitties = {};
var lastBlockSave = 0;
var filePath = 'allKitties.txt';

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
		saveTransfersKitties(sBlock, stp);
	});
}

function saveTransfersKitties(sBlock, step) {
	kittyContractMethods.currentBlockNumber()
	.then(blockNumber => {
		if(sBlock >= blockNumber) {
			kittyContractMethods.kittyCurrentEvents(sBlock, (event) => {
				let eventValues = event.returnValues;
				let lastBlock = event.blockNumber;
				updateKittiesWithEvents([event], lastBlock);
			});
		} else {
			let eBlock = sBlock + step;
			kittyContractMethods.kittyEventsFromTo(sBlock, eBlock)
			.then(events => {
				if(notEmptyArray(events)) {
					let lastEvent = events.slice().pop();
					let lastBlock = lastEvent.blockNumber;
					let eventsValues = events.map(e => e.returnValues);

					updateKittiesWithEvents(events, lastBlock);
				}

				let nextStartBlock = eBlock+1;
				saveTransfersKitties(nextStartBlock, step);
			})
			.catch(console.log.bind(console));
		}
	});
}

function updateKittiesWithEvents(events, lastBlock) {
	console.log('Updating Kitties.')
	events.forEach(e => {
		let event = e.returnValues;
		if(e.event == "Birth") {
			let kittyId = event.kittyId;
			let matronId = event.matronId;
			let sireId = event.sireId;
			let genes = event.genes;

			if(kittyId != "undefined" && kittyId > 0 && genes != "undefined") {
				let generation = 0;

				if(matronId != 0 && sireId != 0) {
					let matron = dicKitties[matronId];
					let sire = dicKitties[sireId];
					let maxGen = Math.max(matron.generation, sire.generation);
					generation = maxGen+1;
				}

				let dicKitty = {
					id : kittyId,
					matronId : matronId,
					sireId : sireId,
					generation : generation,
					genes : genes
				};

				dicKitties[kittyId] = dicKitty;
			}
		} else if(e.event == "Transfer") {
			let kittyId = event.tokenId;
			let toAddress = event.to;
			if(kittyId != "undefined" && kittyId > 0 && toAddress != "undefined") {
				let kittyInfos = dicKitties[kittyId];
				if(kittyInfos != "undefined") {
					let kittyOwners = kittyInfos.owners;
					if(notEmptyArray(kittyOwners)) {
						kittyOwners.push(toAddress);
					} else {
						kittyOwners = [toAddress];
					}
					dicKitties[kittyId].owners = kittyOwners;
				}
			}
		}
	});

	if(lastBlock - lastBlockSave > nbBlockSave) {
		console.log('Saving file.');
		lastBlockSave = lastBlock;
		let saveDictionary = {
			lastBlock : lastBlock,
			kitties : dicKitties
		};

		fs.writeFile(filePath, JSON.stringify(saveDictionary, null, 2), (err) => {
			if (err) throw err;
		});
	}
}

function notEmptyArray(array) {
	return (typeof array != "undefined" && array != null && array.length != null && array.length > 0);
}

loadAndSaveKitties(startBlock, step);

