require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config()

const { deployFortuneTeller } = require("./Tasks/deployFortuneTeller")
const { deployFortuneSeeker } = require("./Tasks/deployFortuneSeeker")

const FUJI_RPC_URL = process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc"
const PRIVATE_KEY = process.env.PRIVATE_KEY

// Your API key for the relevant block explorer.
const BLOCKEXPLORER_KEY = process.env.FUJI_SNOWTRACE_API_KEY || "Your etherscan API key"
const REPORT_GAS = process.env.REPORT_GAS || false

task("deploy-seeker", "deploys FortuneSeeker.sol")
    .addParam("fortuneteller", "Fortune Teller's Contract Address")
    .setAction(async (args, hre) => {
        await deployFortuneSeeker(args, hre).catch((error) => {
            console.error(error)
            process.exitCode = 1
        })
    })

task("deploy-teller", "deploys fortuneTeller.sol").setAction(async (args, hre) => {
    await deployFortuneTeller(args, hre).catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
})

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.7",
            },
            {
                version: "0.6.6",
            },
            {
                version: "0.4.24",
            },
        ],
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            hardfork: "merge",
            chainId: 31337,
        },
        localhost: {
            chainId: 31337,
        },
        fuji: {
            url: FUJI_RPC_URL,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            chainId: 43113,
        },
    },
    etherscan: {
        // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
        apiKey: BLOCKEXPLORER_KEY,
    },
    gasReporter: {
        enabled: REPORT_GAS,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    contractSizer: {
        runOnCompile: false,
        only: [
            "APIConsumer",
            "AutomationCounter",
            "NFTFloorPriceConsumerV3",
            "PriceConsumerV3",
            "RandomNumberConsumerV2",
        ],
    },
    paths: {
        sources: "./contracts",
        tests: "./tests",
        cache: "./build/cache",
        artifacts: "./build/artifacts",
    },
    mocha: {
        timeout: 200000, // 200 seconds max for running tests
    },
}
