// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";

interface IFortuneSeeker {
    function fulfillFortune(string memory _fortune) external;
}

contract FortuneTeller is VRFConsumerBaseV2, ConfirmedOwner {
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);

    string[] fortunes = [
        "A beautiful, smart, and loving person will be coming into your life.",
        "A faithful friend is a strong defense.",
        "You are going to be a blockchain developer.",
        "A golden egg of opportunity falls into your lap this month.",
        "A hunch is creativity trying to tell you something.",
        "All EVM error messages are designed to build your character.",
        "A short pencil is usually better than a long memory any day.",
        "A soft voice may be awfully persuasive.",
        "All your hard work will soon pay off.",
        "Because you demand more from yourself, others respect you deeply.",
        "Better ask twice than lose yourself once.",
        "You will learn patience from Smart Contracts."
    ];

    string public lastReturnedFortune;

    struct RequestStatus {
        bool fulfilled; // whether the request has been successfully fulfilled
        bool exists; // whether a requestId exists
        uint256[] randomWords;
    }

    /* requestId --> requestStatus */
    mapping(uint256 => RequestStatus) public s_requests;
    VRFCoordinatorV2Interface COORDINATOR;

    // Your VRF subscription ID.
    uint64 s_subscriptionId;

    // past requests Id.
    uint256[] public requestIds;
    uint256 public lastRequestId;

    // The gas lane to use, which specifies the maximum gas price to bump to.
    // For a list of available gas lanes on each network,
    // see https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/#configurations
    bytes32 keyHash =
        0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61;

    // Depends on the number of requested values that you want sent to the
    // fulfillRandomWords() function. Storing each word costs about 20,000 gas,
    // so 100,000 is a safe default for this example contract. Test and adjust
    // this limit based on the network that you select, the size of the request,
    // and the processing of the callback request in the fulfillRandomWords()
    // function.
    uint32 callbackGasLimit = 100000;

    // The default is 3, but we set to 1 for faster dev.
    uint16 requestConfirmations = 1;

    // For this example, retrieve 1 random value per request.
    // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
    uint32 numWords = 1;

    constructor(uint64 subscriptionId, address VRFCoordinator)
        // Fuji VRFCoordinator 0x2eD832Ba664535e5886b75D64C46EB9a228C2610
        VRFConsumerBaseV2(VRFCoordinator)
        ConfirmedOwner(msg.sender)
    {
        COORDINATOR = VRFCoordinatorV2Interface(VRFCoordinator);
        s_subscriptionId = subscriptionId;
    }

    // Assumes the subscription is funded sufficiently.
    function requestRandomWords()
        external
        onlyOwner
        returns (uint256 requestId)
    {
        // Will revert if subscription is not set and funded.
        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        s_requests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false
        });
        requestIds.push(requestId);
        lastRequestId = requestId;
        emit RequestSent(requestId, numWords);
        return requestId;
    }

    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        require(s_requests[_requestId].exists, "request not found");
        s_requests[_requestId].fulfilled = true;
        s_requests[_requestId].randomWords = _randomWords;
        emit RequestFulfilled(_requestId, _randomWords);
    }

    function getRequestStatus(uint256 _requestId)
        external
        view
        returns (bool fulfilled, uint256[] memory randomWords)
    {
        require(s_requests[_requestId].exists, "request not found");
        RequestStatus memory request = s_requests[_requestId];
        return (request.fulfilled, request.randomWords);
    }

    function seekFortune() external payable {
        require(
            msg.value >= 0.001 ether,
            "Insufficient payment to the fortune teller"
        );

        require(lastRequestId != 0, "No requests fulfilled as yet");

        string memory fortune = getFortune();
        IFortuneSeeker seeker = IFortuneSeeker(msg.sender);
        seeker.fulfillFortune(fortune);
    }

    function getFortune() public returns (string memory) {
        string memory fortune = fortunes[
            s_requests[lastRequestId].randomWords[0] % fortunes.length
        ];

        lastReturnedFortune = fortune;
        return fortune;
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function withdrawBalance() public payable onlyOwner {
        (bool sent, ) = msg.sender.call{value: address(this).balance}("");
        require(sent, "Failed to send Ether in withdraw");
    }
}
