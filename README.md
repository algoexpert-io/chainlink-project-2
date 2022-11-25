## PROJECT #2 Overview
There are two contracts. We start with `FortuneTeller.sol` which uses [Chainlink VRF](https://docs.chain.link/vrf/v2/introduction/), and then do `FortuneSeeker.sol` which uses [Chainlink Automation](https://docs.chain.link/chainlink-automation/introduction/).  You can access the [Chainlink Documentation here](docs.chain.link).

You will need to have the native token for the blockchain test network you use.  This project is configured to be deployed and run on the Avalanche Fuji testnet, but you can deploy the code on any EVM network that is [supported by Chainlink](https://docs.chain.link/chainlink-automation/supported-networks/)


### `FortuneTeller.sol`
This contract implements functions that seek a cryptographically verifiable (i.e. provably random) number from the Chainlink Oracle Networks VRF (Verifiable Random Function) service.

Once that Random Number is stored in the contract's storage, we can call `seekFortune()` which uses that random number to random fortune from a stored array of fortunes.

The contract is designed such that it can be invoked by another smart contract, and uses an interface to callback that contract with the fortune. When being called by the client contract it expects to get paid before it will tell a fortune.

You will need to [register a VRF subscription](https://vrf.chain.link/) and [fund it with LINK tokens](https://faucets.chain.link/) to compensate the Chainlink Decentralized Oracles for them to do the computation work required to generate and submit a cryptographically provable random number.


### `FortuneSeeker.sol`
This contract is a "client" to `FortuneTeller`. It calls `FortuneTeller` and pays it some Eth. Therefore this contract must store a balance.

This contract also implements the interface required to be automatically callable by Chainlink's Automation service - a decentralized oracle network that automates the execution of specified functions in your smart contract.  The contract to be automated is called an "Upkeep", and you must [register and fund your Upkeep here](https://automation.chain.link/).

You can have a time based (cron-like) automation schedule or you can have custom logic that tells the Chainlink Decentralized Network whether or not your contract needs to have its target function invoked.  We use the custom logic approach in this project.

As long as `FortuneTeller` is invoked to generate new random numbers, `FortuneSeeker` will receive a different (except by coincidence) Fortune from `FortuneTeller` - the frequency depends on the `interval` that you tell the Chainlink Automation Network you want your contract invoked, and will continue for so long as `FortuneSeeker` can pay `FortuneTeller` and for so long as your Chainlink Automation Upkeep registration has enough LINK balance.


## Getting started
- Install the NPM packages
- Fill in the Environment Variables needed in `hardhat.config.js` to connect your wallet, and other API keys.
- Run `yarn hardhat test` to run the tests.
- Run `yarn hardhat` to see the Hardhat Tasks available.  Two custom tasks: `deploy-teller` and `deploy-seeker` have been included in `hardhat.config.js`


## Tooling used
- Hardhat
- JavaScript/ NodeJs
- Metamask Browser Wallet
- Avalanche Fuji Network
- Chainlink Decentralized Oracle Services

## Resources & Support
While BlockchainExpert maintains this repo, you can also contact the author on [LinkedIn](https://linkedin.com/in/zubinpratap) and [Twitter.](https://twitter.com/@zubinpratap)

You can access further [Chainlink Resources and Content here.](https://chain.link/)
