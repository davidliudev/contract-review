pragma solidity ^0.8.9;
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// All admin functions are proposed in this contract and then executed in the CrossSpaceTradingMain/Content/User contracts
// The owner of CrossSpaceTradingMain/Content/User contracts should be set to this contract
// This contract should be deployed first, then the CrossSpaceTradingMain/Content/User contracts should be deployed with this contract address as the constructor parameter

contract CrossSpaceTradingAdminTimelockContract is Ownable, TimelockController {
    enum ActionType{ SCHEDULE, EXECUTE, CANCEL }

    bytes32 public constant MISSING_ROLE = keccak256("MISSING_ROLE"); // Nobody should have this role

    constructor(uint256 _minDelay, address[] memory _proposers, address[] memory _executors, address[] memory cancellers, address adminWallet) TimelockController(_minDelay, _proposers, _executors, adminWallet) {
        // grant cancel role to cancellers
        for (uint256 i = 0; i < cancellers.length; i++) {
            _grantRole(CANCELLER_ROLE, cancellers[i]);
        }

        // Grant self all roles since in _doAction we check if the sender has the role
        _setupRole(PROPOSER_ROLE, address(this));
        _setupRole(EXECUTOR_ROLE, address(this));
        _setupRole(CANCELLER_ROLE, address(this));
    }

    // For all below functions since they are all related to the setting of "states" and thus idempotent, we don't have to use salt at all (originally for duplication prevention purposes)
    function _doAction(address targetAddress, bytes memory payload, ActionType action) private {
         // Check action type
        if (action == ActionType.SCHEDULE) {
            // Schedule the transaction
            this.schedule(targetAddress, 0, payload, bytes32(0),bytes32(0), getMinDelay());
        } else if (action == ActionType.EXECUTE) {
            // Execute the transaction
            this.execute(targetAddress, 0, payload, bytes32(0),bytes32(0));
        } else if (action == ActionType.CANCEL) {
            // Since we don't use salt, we can just calculate the id on the fly
            bytes32 id = this.hashOperation(targetAddress, 0, payload, bytes32(0), bytes32(0));

            // Cancel the transaction
            cancel(id);
        }
    }

    // ===== Content contract related =====
    function setContentContractParentProtocolAddress(address contentContractAddress, address parentProtocolAddress, ActionType action) public onlyRoleOrOpenRoleForActionType(action) {
        bytes memory functionCalldata =  abi.encodeWithSignature("setParentProtocolAddress(address)",[parentProtocolAddress]);
       _doAction(contentContractAddress, functionCalldata, action);
    }

    function setContentContractProtocolFeeDestination(address contentContractAddress, address protocolFeeDestination, ActionType action) public onlyRoleOrOpenRoleForActionType(action) {
        bytes memory functionCalldata =  abi.encodeWithSignature("setFeeDestination(address)",[protocolFeeDestination]);
       _doAction(contentContractAddress, functionCalldata, action);
    }

    function setContentContractProtocolFeePercent(address contentContractAddress, uint256 protocolFeePercent, ActionType action) public onlyRoleOrOpenRoleForActionType(action) {
        bytes memory functionCalldata =  abi.encodeWithSignature("setProtocolFeePercent(uint256)",[protocolFeePercent]);
       _doAction(contentContractAddress, functionCalldata, action);
    }

    function setContentContractSubjectFeePercent(address contentContractAddress, uint256 subjectFeePercent, ActionType action) public onlyRoleOrOpenRoleForActionType(action) {
        bytes memory functionCalldata =  abi.encodeWithSignature("setSubjectFeePercent(uint256)",[subjectFeePercent]);
       _doAction(contentContractAddress, functionCalldata, action);
    }

    // ===== User contract related =====
    function setUserContractParentProtocolAddress(address userContractAddress, address parentProtocolAddress, ActionType action) public onlyRoleOrOpenRoleForActionType(action) {
        bytes memory functionCalldata =  abi.encodeWithSignature("setParentProtocolAddress(address)",[parentProtocolAddress]);
       _doAction(userContractAddress, functionCalldata, action);
    }

    function setUserContractProtocolFeeDestination(address userContractAddress, address protocolFeeDestination, ActionType action) public onlyRoleOrOpenRoleForActionType(action) {
        bytes memory functionCalldata =  abi.encodeWithSignature("setFeeDestination(address)",[protocolFeeDestination]);
       _doAction(userContractAddress, functionCalldata, action);
    }

    function setUserContractProtocolFeePercent(address userContractAddress, uint256 protocolFeePercent, ActionType action) public onlyRoleOrOpenRoleForActionType(action) {
        bytes memory functionCalldata =  abi.encodeWithSignature("setProtocolFeePercent(uint256)",[protocolFeePercent]);
       _doAction(userContractAddress, functionCalldata, action);
    }

    function setUserContractSubjectFeePercent(address userContractAddress, uint256 subjectFeePercent, ActionType action) public onlyRoleOrOpenRoleForActionType(action) {
        bytes memory functionCalldata =  abi.encodeWithSignature("setSubjectFeePercent(uint256)",[subjectFeePercent]);
       _doAction(userContractAddress, functionCalldata, action);
    }

    // Custom modifier for access control that follows the ActionType
    modifier onlyRoleOrOpenRoleForActionType(ActionType actionType) {
        bytes32 role = actionType == ActionType.EXECUTE ? EXECUTOR_ROLE :
            actionType == ActionType.CANCEL ? CANCELLER_ROLE :
            actionType == ActionType.SCHEDULE ? PROPOSER_ROLE :
            MISSING_ROLE;
        require(role != MISSING_ROLE, "Invalid action type");

        if (!hasRole(role, address(0))) {
            _checkRole(role, _msgSender());
        }
        _;
    }

}