require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config({ path: __dirname + "/.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY;
// const ETHSCAN_API_KEY = process.env.ETHSCAN_API_KEY;

const MUMBAI_API_KEY = process.env.MUMBAI_API_KEY;
// const ROPSTEN_API_KEY = process.env.ROPSTEN_API_KEY;
// const GOERLI_API_KEY = process.env.GOERLI_API_KEY;
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.7.3",
      },
      {
        version: "0.8.9",
      },
    ],
  },
  networks: {
    hardhat: {
      gasPrice: 0,
      initialBaseFeePerGas: 0,
    },
    // ropsten: {
    //   url: `https://eth-ropsten.alchemyapi.io/v2/${ROPSTEN_API_KEY}`,
    //   accounts: [`${PRIVATE_KEY}`],
    // },
    // goerli: {
    //   url: `https://eth-goerli.alchemyapi.io/v2/${GOERLI_API_KEY}`,
    //   accounts: [`${PRIVATE_KEY}`],
    // },
    polygonMumbai: {
      chainId: 80001,
      url: `https://polygon-mumbai.g.alchemy.com/v2/${MUMBAI_API_KEY}`,
      accounts: [`${PRIVATE_KEY}`],
    },
    polygon: {
      chainId: 137,
      url: `https://polygon-mainnet.g.alchemy.com/v2/${POLYGON_API_KEY}`,
      accounts: [`${PRIVATE_KEY}`],
    },
  },

  etherscan: {
    apiKey: {
      // ropsten: ETHSCAN_API_KEY,
      // goerli: ETHSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
    },
  },
};
