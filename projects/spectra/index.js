const { getLogs } = require("../helper/cache/getLogs");
const abi = require("./abi.json");
const config = require("./config.json");
const sdk = require("@defillama/sdk");
const { staking } = require("../helper/staking.js")

// staking - SPECTRA token
const SPECTRA = "0x64fcc3a02eeeba05ef701b7eed066c6ebd5d4e51"
const veSPECTRA = "0x6a89228055c7c28430692e342f149f37462b478b"

module.exports = {
  methodology: `All deposited underlying in Spectra Principal Tokens and all underlying supplied as liquidity in Spectra Markets`,
  hallmarks: [
    [1717074000, "V2 Launch"]
  ],
};

const curvePoolDeployedTopic =
  "0x3c7b686d948efcba31c9cfd1aeae78faac70fe0c1ed90d151d49c75e85027a91";
const ptDeployedTopic =
  "0xcf50c3e7162cc35f5befd4f0379ddd760d499ca96330c9ae8faa4059919caaee";

Object.keys(config).forEach((chain) => {
  const { factory, fromBlock } = config[chain];
  module.exports[chain] = {
    tvl: async (api) => {
      const marketData = await getMarkets(api);
      const marketBatchCalls = marketData.map((market) => ({
        target: market[0],
        params: 0,
        abi: abi.markets.balances,
      }));

      const pts = await getPTs(api);
      const ptIBTCalls = pts.map((pt) => ({
        target: pt,
        abi: abi.pt.getIBT,
      }));

      const [ibtsInMarket, ptIbts] = await Promise.all([
        api.batchCall(marketBatchCalls),
        api.batchCall(ptIBTCalls),
      ]);

      const ptIBTBalanceCalls = ptIbts.map((ibt, i) => ({
        target: ibt,
        params: pts[i],
        abi: abi.pt.balanceOf,
      }));
      const ibtBalances = await api.batchCall(ptIBTBalanceCalls);

      const poolIBTBalances = marketData.reduce((acc, market, i) => {
        const ibt = market[1];
        const balance = sdk.util.convertToBigInt(ibtsInMarket[i]);
        acc[ibt] = (acc[ibt] || 0n) + balance;
        return acc;
      }, {});

      const ptIBTBalances = ptIbts.reduce((acc, ibt, i) => {
        const balance = sdk.util.convertToBigInt(ibtBalances[i]);
        acc[ibt] = (acc[ibt] || 0n) + balance;
        return acc;
      }, {});

      const allIBTBalances = { ...poolIBTBalances };
      for (const [ibt, balance] of Object.entries(ptIBTBalances)) {
        allIBTBalances[ibt] = (allIBTBalances[ibt] || 0n) + balance;
      }

      const assetCalls = Object.keys(allIBTBalances).map((ibt) => ({
        target: ibt,
        abi: abi.vault.asset,
      }));

      const assetBalanceCalls = Object.entries(allIBTBalances).map(
        ([ibt, balance]) => ({
          target: ibt,
          params: balance,
          abi: abi.vault.convertToAsset,
        })
      );

      const [assets, assetBalances] = await Promise.all([
        api.batchCall(assetCalls),
        api.batchCall(assetBalanceCalls),
      ]);

      const assetsWithBalances = assets.map((asset, i) => [
        asset,
        sdk.util.convertToBigInt(assetBalances[i]),
      ]);

      assetsWithBalances.forEach(([asset, balance]) => {
        api.add(asset, balance);
      });

      return api.getBalances();
    },
  };

  async function getMarkets(api) {
    const logs = await getLogs({
      api,
      target: factory,
      topic: curvePoolDeployedTopic,
      eventAbi:
        "event CurvePoolDeployed(address indexed poolAddress, address indexed ibt, address indexed pt)",
      onlyArgs: true,
      fromBlock: fromBlock,
      extraKey: "markets",
    });
    return logs.map((i) => [i.poolAddress, i.ibt]);
  }

  async function getPTs(api) {
    const logs = await getLogs({
      api,
      target: factory,
      topic: ptDeployedTopic,
      eventAbi:
        "event PTDeployed(address indexed pt, address indexed poolCreator)",
      onlyArgs: true,
      fromBlock: fromBlock,
      extraKey: "pts",
    });
    return logs.map((i) => i.pt);
  }
});

module.exports.base.staking = staking(veSPECTRA, SPECTRA)