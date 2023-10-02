pragma solidity ^0.8.9;

library math {
/**
      * @dev Compute the largest integer smaller than or equal to the cubic root of `n`
    */
    function floorCbrt(uint256 n) internal pure returns (uint256) { unchecked {
        uint256 x = 0;
        for (uint256 y = 1 << 255; y > 0; y >>= 3) {
            x <<= 1;
            uint256 z = 3 * x * (x + 1) + 1;
            if (n / y >= z) {
                n -= y * z;
                x += 1;
            }
        }
        return x;
    }}

    /**
      * @dev Compute the smallest integer larger than or equal to the cubic root of `n`
    */
    function ceilCbrt(uint256 n) internal pure returns (uint256) { unchecked {
        uint256 x = floorCbrt(n);
        return x ** 3 == n ? x : x + 1;
    }}
}