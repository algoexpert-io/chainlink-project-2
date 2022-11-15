// const { ethers, network, run, userConfig } = require("hardhat") // TODO remove import
const testnetConfigs = require("../testnets.config")

async function deployFortuneTeller(_, hre) {
    const { ethers, network, run, userConfig } = hre

    let VRFCoordinatorV2Mock
    let subscriptionId
    let vrfCoordinatorAddress

    const chainId = network.config.chainId
    const isLocalHostNetwork = chainId == 31337

    // If this is a local hardhat network, deploy Mock VRF Coordinator first.
    // Initialize variables used throughout this function.
    if (isLocalHostNetwork) {
        console.log("Local blockchain network detected.  Deploying Mock.")
        // Read more at https://docs.chain.link/docs/chainlink-vrf/
        const BASE_FEE = "100000000000000000"
        const GAS_PRICE_LINK = "1000000000" // 0.000000001 LINK per gas
        const FUND_AMOUNT = "1000000000000000000" // 1 eth.

        const VRFCoordinatorV2MockFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock")
        VRFCoordinatorV2Mock = await VRFCoordinatorV2MockFactory.deploy(BASE_FEE, GAS_PRICE_LINK)
        vrfCoordinatorAddress = VRFCoordinatorV2Mock.address

        // Create VRF Subscription
        const transaction = await VRFCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transaction.wait(1)
        subscriptionId = ethers.BigNumber.from(transactionReceipt.events[0].topics[1])

        // Fund VRF Subscription
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)

        console.log(`Subscription id ${subscriptionId} funded with ${FUND_AMOUNT} wei.`)
    } else {
        subscriptionId = testnetConfigs[chainId].subscriptionId
        vrfCoordinatorAddress = testnetConfigs[chainId].coordinatorAddress
    }

    if (!subscriptionId || !vrfCoordinatorAddress) {
        throw new Error("Missing configs for non localhost testnet")
    }

    console.log(`Deploying FortuneTeller to ${network.name}...`)

    const FortuneTellerFactory = await ethers.getContractFactory("FortuneTeller")
    const fortuneTellerContract = await FortuneTellerFactory.deploy(
        subscriptionId,
        vrfCoordinatorAddress
    )

    const waitBlockConfirmations = isLocalHostNetwork ? 1 : 3
    await fortuneTellerContract.deployTransaction.wait(waitBlockConfirmations)

    console.log(`FortuneTeller deployed to ${fortuneTellerContract.address} on ${network.name}`)

    // If on a live testnet, verify the FortuneTeller Contract.
    if (!isLocalHostNetwork && userConfig.etherscan.apiKey) {
        await run("verify:verify", {
            address: fortuneTellerContract.address,
            constructorArguments: [subscriptionId, vrfCoordinatorAddress],
        })
    }

    // Register the deployed Fortune Teller as a VRF Consumer on the Mock.
    if (isLocalHostNetwork) {
        VRFCoordinatorV2Mock.addConsumer(subscriptionId, fortuneTellerContract.address)
    }
}

// deployFortuneTeller().catch((error) => {
//     console.error(error)
//     process.exitCode = 1
// }) // TODO remove

module.exports = {
    deployFortuneTeller,
}
