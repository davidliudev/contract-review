pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../math.sol";

contract CrossSpaceShareUserV2 is Ownable {

    address parentProtocolAddress;
    address public protocolFeeDestination;
    uint256 public protocolFeePercent = 500;
    uint256 public subjectFeePercent = 500;
    uint256 public constant PERCENT_BASE = 10000;
    uint256 public constant PRICE_DIVIDER = 32000;

    constructor() {
        protocolFeeDestination = _msgSender();
    }

    event TradeUser(address trader, address author, bool isBuy, uint256 shareAmountInWei, uint256 maticAmount, uint256 protocolMaticAmount, uint256 subjectMaticAmount, uint256 supplyInWei);

    // Author => (Holder => Balance)
    mapping(address => mapping(address => uint256)) public sharesBalanceInWei;

    // Author => SupplyInWei
    mapping(address => uint256) public sharesSupplyInWei;

    function setFeeDestination(address _feeDestination) public onlyOwner {
        protocolFeeDestination = _feeDestination;
    }

    function setParentProtocolAddress(address _parentProtocolAddress) public onlyOwner {
        parentProtocolAddress = _parentProtocolAddress;
    }

    function setProtocolFeePercent(uint256 _feePercent) public onlyOwner {
        protocolFeePercent = _feePercent;
    }

    function setSubjectFeePercent(uint256 _feePercent) public onlyOwner {
        subjectFeePercent = _feePercent;
    }

    function getPrice(uint256 supplyInWei, uint256 amountInWei) public pure returns (uint256) {
        uint256 price = (amountInWei * (amountInWei*amountInWei + 3*amountInWei* supplyInWei + 3*supplyInWei*supplyInWei));
        uint256 normalizedPrice = price * 1 ether / PRICE_DIVIDER / 3e54;
        return normalizedPrice;
    }

    function getBuyPrice(address author, uint256 amountInWei) public view returns (uint256) {
        return getPrice(sharesSupplyInWei[author], amountInWei);
    }

    function getSellPrice(address author, uint256 amountInWei) public view returns (uint256) {
        return getPrice(sharesSupplyInWei[author] - amountInWei, amountInWei);
    }

    function getAmountInWeiByValue(uint256 supplyInWei, uint256 priceInWei) public pure returns (uint256) {
        uint256 np =priceInWei* 3e54 * PRICE_DIVIDER / 1 ether;
        uint256 a = math.floorCbrt(np + supplyInWei * supplyInWei * supplyInWei) - supplyInWei;

        return a;
    }

     function getBuyPriceAfterFee(address author, uint256 amount) public view returns (uint256) {
        uint256 price = getBuyPrice(author, amount);
        uint256 protocolFee = price * protocolFeePercent / PERCENT_BASE;
        uint256 subjectFee = price * subjectFeePercent / PERCENT_BASE;
        return price + protocolFee + subjectFee;
    }

    function getSellPriceAfterFee(address author, uint256 amount) public view returns (uint256) {
        uint256 price = getSellPrice(author, amount);
        uint256 protocolFee = price * protocolFeePercent / PERCENT_BASE;
        uint256 subjectFee = price * subjectFeePercent / PERCENT_BASE;
        return price - protocolFee - subjectFee;
    }

    function getBuyAmountInWeiByValue(address author, uint256 priceInWei) public view returns (uint256) {
        return getAmountInWeiByValue(sharesSupplyInWei[author], priceInWei); 
    }

    function buyShares(address author, address sender, uint256 amountInWei) public payable {
        // Require the caller to be the parent protocol
        require(msg.sender == parentProtocolAddress, "Caller is not the parent protocol");

        uint256 supplyInWei = sharesSupplyInWei[author];
        uint256 price = getPrice(supplyInWei, amountInWei);
        uint256 protocolFee = price * protocolFeePercent / PERCENT_BASE;
        uint256 subjectFee = price * subjectFeePercent / PERCENT_BASE;
        require(msg.value >= price + protocolFee + subjectFee, "Insufficient payment");
        sharesBalanceInWei[author][sender] = sharesBalanceInWei[author][sender] + amountInWei;
        sharesSupplyInWei[author] = supplyInWei + amountInWei;
        emit TradeUser(sender, author, true, amountInWei, price, protocolFee, subjectFee, amountInWei + amountInWei);
        (bool success1, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success2, ) = author.call{value: subjectFee}("");
        require(success1 && success2, "Unable to send funds");
    }

    function sellShares(address author, address sender, uint256 amountInWei) public payable {
         // Require the caller to be the parent protocol
        require(msg.sender == parentProtocolAddress, "Caller is not the parent protocol");

        uint256 supplyInWei = sharesSupplyInWei[author];
        require(supplyInWei >= amountInWei, "Cannot sell exceeding shares supply");
        uint256 price = getPrice(supplyInWei - amountInWei, amountInWei);
        uint256 protocolFee = price * protocolFeePercent / PERCENT_BASE;
        uint256 subjectFee = price * subjectFeePercent / PERCENT_BASE;
        require(sharesBalanceInWei[author][sender] >= amountInWei, "Insufficient shares");
        sharesBalanceInWei[author][sender] = sharesBalanceInWei[author][sender] - amountInWei;
        sharesSupplyInWei[author] = supplyInWei - amountInWei;
        emit TradeUser(sender, author, false, amountInWei, price, protocolFee, subjectFee, supplyInWei - amountInWei);
        (bool success1, ) = sender.call{value: price - protocolFee - subjectFee}("");
        (bool success2, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success3, ) = author.call{value: subjectFee}("");
        require(success1 && success2 && success3, "Unable to send funds");
    }
}