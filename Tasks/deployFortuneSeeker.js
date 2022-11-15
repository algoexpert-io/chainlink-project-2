const testnetConfigs = require("../testnets.config")

// @dev args contain hardhat task parameters.
// Reference: https://hardhat.org/hardhat-runner/docs/advanced/create-task#creating-a-task
// No mocks required for Chainlink Automation as the target functions can be invoked
// programmatically at will.
async function deployFortuneSeeker(args, hre) {
    const { ethers, network, run, userConfig } = hre

    const chainId = network.config.chainId
    const isLocalHostNetwork = chainId == 31337

    const UPDATE_INTERVALS_SEC = 10 // 10s update intervals

    // instantiate Fortune Seeker.
    const FortuneSeekerFactory = await ethers.getContractFactory("FortuneSeeker")
    const fortuneSeekerContract = await FortuneSeekerFactory.deploy(
        args.fortuneteller,
        UPDATE_INTERVALS_SEC
    )

    const waitBlockConfirmations = isLocalHostNetwork ? 1 : 3

    await fortuneSeekerContract.deployTransaction.wait(waitBlockConfirmations)

    console.log(`FortuneSeeker deployed to ${fortuneSeekerContract.address} on ${network.name}`)

    // If on a live testnet, verify the FortuneTeller Contract.
    if (!isLocalHostNetwork && userConfig.etherscan.apiKey) {
        await run("verify:verify", {
            address: fortuneSeekerContract.address,
            constructorArguments: [args.fortuneteller, UPDATE_INTERVALS_SEC],
        })
    }
}

module.exports = {
    deployFortuneSeeker,
}
