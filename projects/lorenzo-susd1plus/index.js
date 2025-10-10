const { cachedGraphQuery } = require('../helper/cache');

const SUSD1PLUS_TOKEN_CONTRACT_ADDRESS_ETH = "0x1c290af93a0fD565E92E5e7d9045F35b1e9ef71d";
const SUSD1PLUS_TOKEN_CONTRACT_ADDRESS_BSC = "0x4F2760B32720F013E900DC92F65480137391199b";

const subgraphUrl = "https://lorenzo-api-stage.lorenzo-protocol.xyz/v1/graphql/otf";

const config = {
  ethereum: {
    contractAddr: SUSD1PLUS_TOKEN_CONTRACT_ADDRESS_ETH,
    query: `
      {
        tvlByChain(targetChainName: "ethereum") {
            targetChainName
            tokenName
            tvl
            readableTvl
        }
      }
    `,
  },
  bsc: {
    contractAddr: SUSD1PLUS_TOKEN_CONTRACT_ADDRESS_BSC,
    query: `
      {
        tvlByChain(targetChainName: "bnb") {
            targetChainName
            tokenName
            tvl
            readableTvl
        }
      }
    `,
  },
};

// susd1p to usd1
const TOKEN_MAPPINGS = {
  '0x1c290af93a0fD565E92E5e7d9045F35b1e9ef71d': '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d',
  '0x4F2760B32720F013E900DC92F65480137391199b': '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d',
}

/**
  * @param {import('@defillama/sdk').ChainApi} api - DefiLlama Chain API instance
  * @returns {Promise<import('@defillama/sdk').BalancesV1>} - The balances object containing token balances
  */
async function tvl(api) {
  const chain = api.chain;
  const { contractAddr, query } = config[chain];

  const data = await cachedGraphQuery(`lorenzo-protocol-susd1plus/${chain}`, subgraphUrl, query);
  const tvlValue = data?.tvlByChain?.tvl;

  if (tvlValue) {
    const targetToken = TOKEN_MAPPINGS[contractAddr] || contractAddr;
    api.add(targetToken, tvlValue);
  }

  return api.getBalances();
}

module.exports = {
  methodology: "Lorenzo sUSD1+ is a vault that represents tokenized real-world assets. The protocol maintains a Net Asset Value (NAV) that reflects the current value of the underlying asset portfolio per token.",
  ethereum: {
    tvl,
  },
  bsc: {
    tvl,
  }
};
