const { ethers, network, run } = require("hardhat")
const { time } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")

const chainId = network.config.chainId
const isLocalHostNetwork = chainId == 31337

// Helper Function to Fund Contract at A Given Address.
const addEtherToContractAt = async (address, etherValBigNum) => {
    const deployer = (await ethers.getSigners())[0]

    // Add funds to the FortuneSeeker
    const tx = {
        to: address,
        value: etherValBigNum,
    }
    return await deployer.sendTransaction(tx)
}

!isLocalHostNetwork
    ? describe.skip
    : describe("Dev Network Integration Tests", async () => {
          let VRFCoordinatorV2Mock,
              subscriptionId,
              vrfCoordinatorAddress,
              deployer,
              fortuneTellerContract,
              fortuneSeekerContract

          const UPDATE_INTERVAL_SEC = 10 // 10s update intervals

          beforeEach(async () => {
              // Deploy VRF Cooridinator Mock.
              /**
               * @dev Read more at https://docs.chain.link/docs/chainlink-vrf/
               */
              const BASE_FEE = "100000000000000000"
              const GAS_PRICE_LINK = "1000000000" // 0.000000001 LINK per gas
              const FUND_AMOUNT = "1000000000000000000" // 1 eth.

              const VRFCoordinatorV2MockFactory = await ethers.getContractFactory(
                  "VRFCoordinatorV2Mock"
              )
              VRFCoordinatorV2Mock = await VRFCoordinatorV2MockFactory.deploy(
                  BASE_FEE,
                  GAS_PRICE_LINK
              )
              vrfCoordinatorAddress = VRFCoordinatorV2Mock.address

              const transaction = await VRFCoordinatorV2Mock.createSubscription()
              const transactionReceipt = await transaction.wait(1)
              subscriptionId = ethers.BigNumber.from(transactionReceipt.events[0].topics[1])

              await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)

              // Deploy FortuneTeller
              deployer = (await ethers.getSigners())[0]

              const FortuneTellerFactory = await ethers.getContractFactory("FortuneTeller")
              fortuneTellerContract = await FortuneTellerFactory.connect(deployer).deploy(
                  subscriptionId,
                  vrfCoordinatorAddress
              )

              await VRFCoordinatorV2Mock.addConsumer(subscriptionId, fortuneTellerContract.address)

              // // Deploy FortuneSeeker
              const FortuneSeekerFactory = await ethers.getContractFactory("FortuneSeeker")
              fortuneSeekerContract = await FortuneSeekerFactory.connect(deployer).deploy(
                  fortuneTellerContract.address,
                  UPDATE_INTERVAL_SEC
              )
          })

          describe("Fortune Teller", async () => {
              it("Trigger Coordinator to emit event ", async () => {
                  await expect(fortuneTellerContract.requestRandomWords()).to.emit(
                      VRFCoordinatorV2Mock,
                      "RandomWordsRequested"
                  )
              })

              it("should request random words and receive result", async () => {
                  await fortuneTellerContract.requestRandomWords()
                  const requestId = await fortuneTellerContract.lastRequestId()

                  // simulate callback from the oracle network
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(
                          requestId,
                          fortuneTellerContract.address
                      )
                  ).to.emit(fortuneTellerContract, "RequestFulfilled")

                  const [fulfilled, randomWords] = await fortuneTellerContract.getRequestStatus(
                      requestId
                  )
                  const randomBigNum = randomWords[0] // Index 0, since we're only asking for 1 random word.

                  expect(fulfilled).to.be.true
                  expect(randomBigNum.gt(ethers.constants.Zero)).to.be.true
              })

              it("should revert on insufficient payment", async () => {
                  await expect(
                      fortuneTellerContract.seekFortune({
                          value: ethers.utils.parseEther("0.000001"),
                      })
                  ).to.be.revertedWith("Insufficient payment to the fortune teller")

                  const contractBalance = await fortuneTellerContract.getContractBalance()
                  expect(contractBalance.toString()).to.equal("0")
              })

              it("should revert if no random number has been requested before", async () => {
                  const payment = ethers.utils.parseEther("0.001")

                  await expect(
                      fortuneTellerContract.seekFortune({
                          value: payment,
                      })
                  ).to.be.revertedWith("No requests fulfilled as yet")

                  const contractBalance = await fortuneTellerContract.getContractBalance()
                  expect(contractBalance.toString()).to.equal("0")
              })

              it("should increase the contract's balance & return fortune correctly", async () => {
                  // Arrange. Request VRF request and simulate oracle fulfillment.
                  await fortuneTellerContract.requestRandomWords()
                  const requestId = await fortuneTellerContract.lastRequestId()

                  // simulate callback from the oracle network
                  await VRFCoordinatorV2Mock.fulfillRandomWords(
                      requestId,
                      fortuneTellerContract.address
                  )

                  // Assert on FortuneSeeker having empty fortune string
                  let currentFortune = await fortuneSeekerContract.fortune()
                  expect(currentFortune).to.equal("")

                  // Fund FortuneSeeker.
                  await addEtherToContractAt(
                      fortuneSeekerContract.address,
                      ethers.utils.parseEther("2", "ether")
                  )

                  // Act & Assert on payments for FortuneTeller from FortuneSeeker
                  const paymentToFortuneTeller = ethers.utils.parseEther("0.001")
                  await fortuneSeekerContract.seekFortune()

                  const fortuneTellerBalance = await fortuneTellerContract.getContractBalance()
                  expect(fortuneTellerBalance.toString()).to.equal(
                      paymentToFortuneTeller.toString()
                  )

                  // Assert fortune telling on both contracts
                  currentFortune = await fortuneSeekerContract.fortune()
                  expect(currentFortune).not.to.equal("")

                  let returnedFortune = await fortuneTellerContract.lastReturnedFortune()
                  expect(returnedFortune).to.equal(currentFortune)
              })
          })

          describe("Fortune Seeker", async () => {
              it("should emit event with correct amount on receiving ether ", async () => {
                  const value = ethers.utils.parseEther("0.5", "ether")

                  const fundTx = await addEtherToContractAt(fortuneSeekerContract.address, value)
                  const receipt = await fundTx.wait()
                  const emittedLogData = receipt.logs[0].data

                  const decoder = ethers.utils.defaultAbiCoder
                  // Uint because the "ReceivedFunding" Event only emits the value of the funding amount.
                  const decoded = decoder.decode(["uint"], emittedLogData)

                  expect(decoded.toString()).to.equal(value.toString())
              })

              it("should call checkUpkeep and be returned false ", async () => {
                  const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
                  const { upkeepNeeded } = await fortuneSeekerContract.callStatic.checkUpkeep(
                      checkData
                  )

                  expect(upkeepNeeded).to.be.false
              })

              it("performUpkeep should revert if upkeep conditions not met", async () => {
                  // Act and Assert. Run performUpkeep without any funding in FortuneSeeker.
                  const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
                  await expect(fortuneSeekerContract.performUpkeep(checkData)).to.be.revertedWith(
                      "Upkeep conditions not met"
                  )

                  // Surpass the time interval, but no funding still.
                  await time.increase(UPDATE_INTERVAL_SEC + 1)

                  await expect(fortuneSeekerContract.performUpkeep(checkData)).to.be.revertedWith(
                      "Upkeep conditions not met"
                  )
              })

              it("should successfully call performUpkeep after interval elapses ", async () => {
                  // Arrange. Request VRF request and simulate oracle fulfillment.
                  await fortuneTellerContract.requestRandomWords()
                  const requestId = await fortuneTellerContract.lastRequestId()

                  await addEtherToContractAt(
                      fortuneSeekerContract.address,
                      ethers.utils.parseEther("2", "ether")
                  )

                  // simulate callback from the oracle network
                  await VRFCoordinatorV2Mock.fulfillRandomWords(
                      requestId,
                      fortuneTellerContract.address
                  )

                  const fortune = await fortuneSeekerContract.fortune()
                  expect(fortune).to.equal("")

                  // Act. Run PerformUpkeep on the FortuneSeeker
                  await time.increase(UPDATE_INTERVAL_SEC + 1)

                  const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
                  const upkeepTx = await fortuneSeekerContract.performUpkeep(checkData)
                  await upkeepTx.wait(1)

                  // Assert.
                  const updatedFortune = await fortuneSeekerContract.fortune()
                  expect(updatedFortune).to.not.equal("")
              })
          })

          describe("Utils", async () => {
              it("should withdraw balance from fortuneSeeker", async () => {
                  const seekerContractStartingBal = await fortuneSeekerContract.getContractBalance()

                  expect(seekerContractStartingBal.toString()).to.equal("0")

                  const fundAmount = ethers.utils.parseEther("1", "ether")
                  await addEtherToContractAt(fortuneSeekerContract.address, fundAmount)
                  const interimSeekerBalance = await fortuneSeekerContract.getContractBalance()

                  expect(interimSeekerBalance.toString()).to.equal(fundAmount.toString())

                  await fortuneSeekerContract.withdrawBalance() // fortuneSeeker is already connected to Deployer account.
                  const closingSeekerBal = await fortuneSeekerContract.getContractBalance()
                  expect(closingSeekerBal.toString()).to.equal("0")
              })
          })
      })
