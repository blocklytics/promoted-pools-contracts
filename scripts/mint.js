const HDWalletProvider = require("@truffle/hdwallet-provider")
const web3 = require('web3')
const axios = require('axios')
const PRIVATE_KEY = process.env.PRIVATE_KEY
const INFURA_KEY = process.env.INFURA_KEY
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS
const OWNER_ADDRESS = process.env.OWNER_ADDRESS
const NETWORK = process.env.NETWORK
const NUM_PROMOTED_POOLS = 1

if (!PRIVATE_KEY || !INFURA_KEY || !OWNER_ADDRESS || !NETWORK) {
    console.error("Please set a PRIVATE_KEY, infura key, owner, network, and contract address.")
    return
}

const BASE_URL = "https://promoted-pools.herokuapp.com/"
const STORAGE_BUCKET_URL = "https://storage.googleapis.com/promoted-pools/meta/"
const TOKEN_VALIDITY_PERIOD = 1209600;

const http = axios.create({
    baseURL: BASE_URL
});

const META = {
    "name": "Pools.fyi Promoted Pool",
    "description": "The owner of this token is granted the right to promote a pool on https://pools.fyi, subject to the following:<br>TERMS AND CONDITIONS<br>1. Contact hello@blocklytics.org to initiate the redemption process.<br>2. Scheduling will be handled on a first-come, first-served basis. Schedule early to avoid disappointment!<br>3. The promoted pool will be displayed for a period of time as determined by the individual token's attributes.<br>4. Redemption rights for the token expire as determined by the individual token's attributes.<br>5. Where feasible, Blocklytics Ltd will enable an \"Add Liquidity\" feature for the promoted pool<br>6. Blocklytics Ltd reserves the right to refuse redemption and/or change the promoted pool.<br>7. Blocklytics Ltd will endeavour to refund a token redeemer in case redemption is not possible or the promoted pool was not advertised for the full period.",
    "external_url": "https://pools.fyi"
}

const NFT_ABI = [{
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      }, {
        "name": "_startTime",
        "type": "uint256"
      }, {
        "name": "_endTime",
        "type": "uint256"
      }
    ],
    "name": "mintTo",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
}, {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
}, {
    "constant": true,
    "inputs": [{
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
    }],
    "name": "tokenURI",
    "outputs": [{
        "internalType": "string",
        "name": "",
        "type": "string"
    }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
}]

async function createTokenMetadata(tokenId, startTime, endTime) {
    let metadata = META;
    metadata.image = STORAGE_BUCKET_URL + tokenId + "/blocklytics-cool.png"
    metadata.attributes = [
        {
            "trait_type": "token_id",
            "value": tokenId.toString()
        },
        {
            "trait_type": "promotion_begins",
            "display_type": "date", 
            "value": startTime
        }, 
        {
            "trait_type": "promotion_ends",
            "display_type": "date",
            "value": endTime
        }
    ]
    return http.post('create/' + tokenId, metadata)
}

async function main() {
    let startTime = 1582588800
    const provider = new HDWalletProvider(PRIVATE_KEY, `https://${NETWORK}.infura.io/v3/${INFURA_KEY}`)
    const web3Instance = new web3(
        provider
    )

    if (NFT_CONTRACT_ADDRESS) {
        const nftContract = new web3Instance.eth.Contract(NFT_ABI, NFT_CONTRACT_ADDRESS, { gasLimit: "1000000" })
        let totalSupply = await nftContract.methods.totalSupply().call({ from: OWNER_ADDRESS });
        let currentTokenId = parseInt(totalSupply)

        // Promoted Pools issued directly to the owner.
        for (var i = 0; i < NUM_PROMOTED_POOLS; i++) {
            let endTime = startTime + TOKEN_VALIDITY_PERIOD;
            console.log("Minting new promoted pool...")
            let mintResult = await nftContract.methods.mintTo(OWNER_ADDRESS, startTime, endTime).send({ from: OWNER_ADDRESS });
            console.log("Minted Promoted Pool NFT. Transaction: " + mintResult.transactionHash)
            currentTokenId++
            let metadataResult = await createTokenMetadata(currentTokenId, startTime, endTime)
            if(metadataResult.status && metadataResult.status == 200){
                console.log("Token metadata successfully created.");
                let tokenURIResult = await nftContract.methods.tokenURI(currentTokenId).call({ from: OWNER_ADDRESS });
                console.log("Token metadata URL: " + tokenURIResult)
                if (NETWORK == "mainnet" || NETWORK == "live") {
                    console.log("View on OpenSea: https://opensea.io/assets/" + NFT_CONTRACT_ADDRESS + "/" + currentTokenId)
                } else {
                    console.log("View on OpenSea: https://" + NETWORK + ".opensea.io/assets/" + NFT_CONTRACT_ADDRESS + "/" + currentTokenId)
                }
            } else {
                console.log("There was an error creating token metadata.")
            }
            startTime = endTime + 1;
            console.log("----------------------------------------------------------------------------------")
        }
    }
    process.exit(0);
}

main()