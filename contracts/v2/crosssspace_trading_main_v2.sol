pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../math.sol";
import "./crossspace_content_v2.sol";
import "./crossspace_user_v2.sol";

contract CrossSpaceTradingMain is Ownable {
    address public contentContractAddress;
    address public userContractAddress;

    // Author => Subject => (Holder => User Contract Balance)
    mapping(address => mapping(string => mapping(address => uint256))) public userContractBalance;

    constructor() {}

    function setContentContractAddress(address _contentContractAddress) public onlyOwner {
        contentContractAddress = _contentContractAddress;
    }

    function setUserContractAddress(address _userContractAddress) public onlyOwner {
        userContractAddress = _userContractAddress;
    }

    function getTotalBuyPriceDetails(address author, string calldata subject, uint256 amount) public view returns (uint256[] memory) {
         // Assert that the contract addresses are not null
        require(contentContractAddress != address(0), "Content contract address is null");
        require(userContractAddress != address(0), "User contract address is null");

        // Convert the contract address to the proper contract type
        CrossSpaceShareContentV2 contentContract = CrossSpaceShareContentV2(contentContractAddress);
        CrossSpaceShareUserV2 shareUserContract = CrossSpaceShareUserV2(userContractAddress);

        // We will calculate the fees for both contract and add them to the total price
        uint256 contentTotalBeforeFee = contentContract.getBuyPrice(author, subject, amount);
        uint256 contentTotalAfterFee = contentContract.getBuyPriceAfterFee(author, subject, amount);

         // We call the contract to get the amount of shares from the price and the total cost
        uint256 userShareAmountInWei = shareUserContract.getBuyAmountInWeiByValue(author, contentTotalBeforeFee); // We will use the same price to buy user share
        uint256 userShareFeeBeforeFee = shareUserContract.getBuyPrice(author, userShareAmountInWei);
        uint256 userShareFeeAfterFee = shareUserContract.getBuyPriceAfterFee(author, userShareAmountInWei);

        uint256 grandTotal = contentTotalAfterFee + userShareFeeAfterFee;

        uint256[] memory result = new uint256[](6);
        result[0] = contentTotalBeforeFee;
        result[1] = contentTotalAfterFee;
        result[2] = userShareAmountInWei;
        result[3] = userShareFeeBeforeFee;
        result[4] = userShareFeeAfterFee;
        result[5] = grandTotal;
        return result;
    }

    function getTotalSellPriceDetails(address author, string calldata subject, uint256 amountInWei) public view returns (uint256[] memory) {
        // Assert that the contract addresses are not null
        require(contentContractAddress != address(0), "Content contract address is null");
        require(userContractAddress != address(0), "User contract address is null");

        // Convert the contract address to the proper contract type
        CrossSpaceShareContentV2 contentContract = CrossSpaceShareContentV2(contentContractAddress);
        CrossSpaceShareUserV2 shareUserContract = CrossSpaceShareUserV2(userContractAddress);

         // Let's calculate the amount of user shares to sell for later
        uint256 userTotalShare = userContractBalance[author][subject][msg.sender];
        uint256 contentTotalBalance = contentContract.sharesBalance(author,subject,msg.sender);
        require(contentTotalBalance >= amountInWei, "Insufficient shares");
        uint256 userShareToSell = amountInWei * userTotalShare / contentTotalBalance; 


        // Let's calculate the fees for content
        uint256 contentTotalBeforeFee = contentContract.getSellPrice(author, subject, amountInWei);
        uint256 contentTotalAfterFee = contentContract.getSellPriceAfterFee(author, subject, amountInWei);

        // Let's calculate the fees for user
        uint256 userShareFeeBeforeFee = shareUserContract.getSellPrice(author, userShareToSell);
        uint256 userShareFeeAfterFee = shareUserContract.getSellPriceAfterFee(author, userShareToSell);

        uint256 grandTotal = contentTotalAfterFee + userShareFeeAfterFee;

        uint256[] memory result = new uint256[](6);
        result[0] = contentTotalBeforeFee;
        result[1] = contentTotalAfterFee;
        result[2] = userShareToSell;
        result[3] = userShareFeeBeforeFee;
        result[4] = userShareFeeAfterFee;
        result[5] = grandTotal;
        return result;
    }

     function buyShares(address author, string calldata subject, uint256 amount) public payable {
        // Assert that the contract addresses are not null
        require(contentContractAddress != address(0), "Content contract address is null");
        require(userContractAddress != address(0), "User contract address is null");

        // Convert the contract address to the proper contract type
        CrossSpaceShareContentV2 contentContract = CrossSpaceShareContentV2(contentContractAddress);
        CrossSpaceShareUserV2 shareUserContract = CrossSpaceShareUserV2(userContractAddress);

        // We will calculate the fees for both contract and add them to the total price
        uint256 contentTotalBeforeFee = contentContract.getBuyPrice(author, subject, amount);
        uint256 contentTotalAfterFee = contentContract.getBuyPriceAfterFee(author, subject, amount);

         // We call the contract to get the amount of shares from the price and the total cost
        uint256 userShareAmountInWei = shareUserContract.getBuyAmountInWeiByValue(author, contentTotalBeforeFee); // We will use the same price to buy user share
        uint256 userShareFeeAfterFee = shareUserContract.getBuyPriceAfterFee(author, userShareAmountInWei);

        uint256 grandTotal = contentTotalAfterFee + userShareFeeAfterFee;

        // Assert that the user sent enough funds
        require(msg.value >= grandTotal, "Not enough funds");

        // Buy the shares for the content contract
        contentContract.buyShares{value: contentTotalAfterFee}(author, subject, msg.sender, amount);

        // Buy the shares for the user contract
        // Save the amount of shares in the mapping
        userContractBalance[author][subject][msg.sender] = userContractBalance[author][subject][msg.sender] + userShareAmountInWei;

        // Transfer the funds to the user contract and call the buy shares function
        shareUserContract.buyShares{value: userShareFeeAfterFee}(author, msg.sender, userShareAmountInWei);
     }

     function sellShares(address author, string calldata subject, uint256 amountInWei) public payable {
        // Assert that the contract addresses are not null
        require(contentContractAddress != address(0), "Content contract address is null");
        require(userContractAddress != address(0), "User contract address is null");

        // Convert the contract address to the proper contract type
        CrossSpaceShareContentV2 contentContract = CrossSpaceShareContentV2(contentContractAddress);
        CrossSpaceShareUserV2 shareUserContract = CrossSpaceShareUserV2(userContractAddress);


         // Let's calculate the amount of user shares to sell for later
        uint256 userTotalShare = userContractBalance[author][subject][msg.sender];
        uint256 contentTotalBalance = contentContract.sharesBalance(author,subject,msg.sender);
        require(contentTotalBalance >= amountInWei, "Insufficient shares");
        uint256 userShareToSell = amountInWei * userTotalShare / contentTotalBalance;
        require(userShareToSell <= userTotalShare, "Insufficient user shares");

        // Sell
        contentContract.sellShares{value: msg.value}(author, subject, msg.sender, amountInWei);
        shareUserContract.sellShares(author, msg.sender, userShareToSell);
     }
}