pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./strings.sol";

contract CrossSpaceShareV1 is Ownable {
    using strings for *;

    address public protocolFeeDestination;
    uint256 public protocolFeePercent = 50000000000000000;
    uint256 public subjectFeePercent = 50000000000000000;

    constructor() {
        protocolFeeDestination = _msgSender();
    }

    event Trade(address trader, address author, string subject, bool isBuy, uint256 shareAmount, uint256 ethAmount, uint256 protocolEthAmount, uint256 subjectEthAmount, uint256 supply);

    // Subject => (Holder => Balance)
    mapping(string => mapping(address => uint256)) public sharesBalance;

    // Subject => Supply
    mapping(string => uint256) public sharesSupply;

    // Holder => (Subect => Balance)
    mapping(address => mapping(bytes32 => uint256)) public holderBalance;

    function setFeeDestination(address _feeDestination) public onlyOwner {
        protocolFeeDestination = _feeDestination;
    }

    function setProtocolFeePercent(uint256 _feePercent) public onlyOwner {
        protocolFeePercent = _feePercent;
    }

    function setSubjectFeePercent(uint256 _feePercent) public onlyOwner {
        subjectFeePercent = _feePercent;
    }

    function getPrice(uint256 supply, uint256 amount) public pure returns (uint256) {
        uint256 sum1 = supply == 0 ? 0 : (supply - 1)* (supply) * (2 * (supply - 1) + 1) / 6;
        uint256 sum2 =  (supply + amount - 1) * (supply + amount) * (2 * (supply + amount - 1 ) + 1) / 6;
        uint256 summation = sum2 - sum1;
        return summation * 1 ether / 16000;
    }

    function getBuyPrice(string calldata subject, uint256 amount) public view returns (uint256) {
        return getPrice(sharesSupply[subject], amount);
    }

    function getSellPrice(string calldata subject, uint256 amount) public view returns (uint256) {
        return getPrice(sharesSupply[subject] - amount, amount);
    }

    function getBuyPriceAfterFee(string calldata subject, uint256 amount) public view returns (uint256) {
        uint256 price = getBuyPrice(subject, amount);
        uint256 protocolFee = price * protocolFeePercent / 1 ether;
        uint256 subjectFee = price * subjectFeePercent / 1 ether;
        return price + protocolFee + subjectFee;
    }

    function getSellPriceAfterFee(string calldata subject, uint256 amount) public view returns (uint256) {
        uint256 price = getSellPrice(subject, amount);
        uint256 protocolFee = price * protocolFeePercent / 1 ether;
        uint256 subjectFee = price * subjectFeePercent / 1 ether;
        return price - protocolFee - subjectFee;
    }

    function buyShares(string memory subject, uint256 amount) public payable {
        strings.slice memory authorAddress = subject.toSlice().split(":".toSlice());
        address author = parseAddr(authorAddress.toString());
        uint256 supply = sharesSupply[subject];
        require(supply > 0 || author == msg.sender, "Only the shares' subject owner can buy the first share");
        uint256 price = getPrice(supply, amount);
        uint256 protocolFee = price * protocolFeePercent / 1 ether;
        uint256 subjectFee = price * subjectFeePercent / 1 ether;
        require(msg.value >= price + protocolFee + subjectFee, "Insufficient payment");
        sharesBalance[subject][msg.sender] = sharesBalance[subject][msg.sender] + amount;
        sharesSupply[subject] = supply + amount;
        // holderBalance[msg.sender][subject] = holderBalance[msg.sender][subject] + amount;
        emit Trade(msg.sender, author, subject, true, amount, price, protocolFee, subjectFee, supply + amount);
        (bool success1, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success2, ) = author.call{value: subjectFee}("");
        require(success1 && success2, "Unable to send funds");
    }

    function sellShares(string memory subject, uint256 amount) public payable {
        strings.slice memory authorAddress = subject.toSlice().split(":".toSlice());
        address author = parseAddr(authorAddress.toString());
        uint256 supply = sharesSupply[subject];
        require(supply > amount, "Cannot sell the last share");
        uint256 price = getPrice(supply - amount, amount);
        uint256 protocolFee = price * protocolFeePercent / 1 ether;
        uint256 subjectFee = price * subjectFeePercent / 1 ether;
        require(sharesBalance[subject][msg.sender] >= amount, "Insufficient shares");
        sharesBalance[subject][msg.sender] = sharesBalance[subject][msg.sender] - amount;
        sharesSupply[subject] = supply - amount;
        // holderBalance[msg.sender][subject] = holderBalance[msg.sender][subject] - amount;
        emit Trade(msg.sender, author, subject, false, amount, price, protocolFee, subjectFee, supply - amount);
        (bool success1, ) = msg.sender.call{value: price - protocolFee - subjectFee}("");
        (bool success2, ) = protocolFeeDestination.call{value: protocolFee}("");
        (bool success3, ) = author.call{value: subjectFee}("");
        require(success1 && success2 && success3, "Unable to send funds");
    }

    function parseAddr(string memory _a) private pure returns (address _parsedAddress) {
        bytes memory tmp = bytes(_a);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        
        // Skip the '0x' prefix (so, start from 2 to 41)
        for (uint i = 2; i < 42; i += 2) {
            iaddr *= 256;
            
            // Convert characters to bytes and then to uint160
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            
            // Convert to the expected integer value (e.g., 'a' -> 10)
            if (b1 >= 97) {
                b1 -= 87;
            } else if (b1 >= 65) {
                b1 -= 55;
            } else {
                b1 -= 48;
            }
            
            if (b2 >= 97) {
                b2 -= 87;
            } else if (b2 >= 65) {
                b2 -= 55;
            } else {
                b2 -= 48;
            }
            
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }
}